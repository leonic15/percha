import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { captureServerEvent } from "@/lib/posthog/server";
import { checkAiRateLimit, recordAiUsage, rateLimitResponse } from "@/lib/ai/usage";

/**
 * POST /api/prendas/analizar
 * Analiza una imagen de prenda con Gemini 2.5 Flash-Lite.
 * Devuelve metadatos sugeridos: nombre, categoría, color, estaciones, ocasiones, estilos, descripción.
 *
 * Seguridad: GEMINI_API_KEY solo server-side, nunca con NEXT_PUBLIC_.
 * Analytics: eventos ia_analisis_iniciado / ia_analisis_completado / ia_analisis_fallido → PostHog.
 */

const GEMINI_MODEL = "gemini-2.5-flash-lite";
const GEMINI_URL   = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const PROMPT = `Sos un experto en moda. Analizá esta imagen de una prenda de ropa.

Devolvé ÚNICAMENTE un objeto JSON válido (sin markdown, sin texto adicional, sin bloques de código) con exactamente estos campos:

{
  "nombre": "nombre descriptivo de la prenda en español argentino, 3-5 palabras",
  "categoria_slug": "el slug más apropiado de esta lista exacta: tops, pantalones-y-shorts, vestidos-y-faldas, calzado, abrigos-y-chaquetas, ropa-interior-y-pijamas, accesorios, otros",
  "color_nombre": "nombre del color principal en español (ej: Blanco, Azul marino, Camel)",
  "color_hex": "#hexadecimal del color principal",
  "estaciones": ["una o más de exactamente estas opciones: primavera, verano, otoño, invierno, todo_el_año"],
  "ocasiones": ["una o más de exactamente estas opciones: casual, trabajo, formal, deporte, salida"],
  "estilos": ["uno o más de exactamente estas opciones: casual, clasico, deportivo, elegante, bohemio, urbano"],
  "descripcion": "descripción de 2-3 oraciones en español sobre la prenda: tipo de prenda, material estimado, silueta, cómo combinarla"
}

Solo respondé con el JSON puro.`;

// ── Tipos ──────────────────────────────────────────────────────────────────────

export interface GarmentAnalysis {
  nombre:        string;
  categoria_slug: string;
  color_nombre:  string;
  color_hex:     string;
  estaciones:    string[];
  ocasiones:     string[];
  estilos:       string[];
  descripcion:   string;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_session" }, { status: 401 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[prendas/analizar] GEMINI_API_KEY no configurada");
    return NextResponse.json({ error: "ai_no_config" }, { status: 500 });
  }

  // ── Rate limiting (H-03) ───────────────────────────────────────────────────
  const rl = await checkAiRateLimit(user.id, "analisis_prenda");
  if (!rl.allowed) return rateLimitResponse(rl.retryAfter);

  // Leer imagen del FormData
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const imagen = formData.get("imagen") as File | null;
  if (!imagen || imagen.size === 0) {
    return NextResponse.json({ error: "imagen_requerida" }, { status: 400 });
  }

  // Validar tipo MIME
  const allowedMimes = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];
  const mimeType     = imagen.type || "image/jpeg";
  if (!allowedMimes.includes(mimeType)) {
    return NextResponse.json({ error: "tipo_imagen_invalido" }, { status: 400 });
  }

  // Convertir a base64
  const bytes  = await imagen.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");

  // Construir payload para Gemini
  const payload = {
    contents: [
      {
        parts: [
          { text: PROMPT },
          { inline_data: { mime_type: mimeType, data: base64 } },
        ],
      },
    ],
    generationConfig: {
      temperature:     0.1,
      topK:            1,
      topP:            1,
      maxOutputTokens: 512,
    },
  };

  // ── PostHog: análisis iniciado ────────────────────────────────────────────
  const inicioMs = Date.now();
  await captureServerEvent(user.id, "ia_analisis_iniciado", {
    mime_type: mimeType,
  });

  try {
    const geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("[prendas/analizar] Gemini HTTP error:", geminiRes.status, errText);
      await captureServerEvent(user.id, "ia_analisis_fallido", {
        motivo:       "gemini_http_error",
        status_code:  geminiRes.status,
        duracion_ms:  Date.now() - inicioMs,
      });
      return NextResponse.json({ error: "ai_error" }, { status: 502 });
    }

    const geminiData = await geminiRes.json();
    const rawText: string =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    // Extraer JSON del texto (Gemini a veces añade texto alrededor)
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[prendas/analizar] No JSON in Gemini response:", rawText);
      await captureServerEvent(user.id, "ia_analisis_fallido", {
        motivo:      "parse_error",
        duracion_ms: Date.now() - inicioMs,
      });
      return NextResponse.json({ error: "ai_parse_error" }, { status: 502 });
    }

    const analysis: GarmentAnalysis = JSON.parse(jsonMatch[0]);

    // ── PostHog: análisis completado ───────────────────────────────────────
    const tokensUsados: number | null =
      geminiData?.usageMetadata?.totalTokenCount ?? null;
    const costoEstimado = tokensUsados ? tokensUsados * 0.000000075 : null;

    // Registrar uso en ai_usage (service role — H-01: habilita tracking + rate limit)
    await recordAiUsage(user.id, "analisis_prenda", { tokens: tokensUsados, costo: costoEstimado });

    await captureServerEvent(user.id, "ia_analisis_completado", {
      duracion_ms:     Date.now() - inicioMs,
      tokens_usados:   tokensUsados,
      costo_estimado:  costoEstimado,
      categoria_slug:  analysis.categoria_slug,
    });

    return NextResponse.json(analysis);

  } catch (err) {
    console.error("[prendas/analizar] Error:", err);
    await captureServerEvent(user.id, "ia_analisis_fallido", {
      motivo:      "exception",
      duracion_ms: Date.now() - inicioMs,
    });
    return NextResponse.json({ error: "ai_error" }, { status: 502 });
  }
}
