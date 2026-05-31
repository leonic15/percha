import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { captureServerEvent } from "@/lib/posthog/server";
import { checkAiRateLimit, recordAiUsage, rateLimitResponse } from "@/lib/ai/usage";
import { geminiGenerateContent, hasGeminiApiKey, GEMINI_FLASH_LITE } from "@/lib/gemini/client";
import { logger } from "@/lib/utils/logger";
import { detectImageMimeType } from "@/lib/upload/validation";

/**
 * POST /api/prendas/analizar
 * Analiza una imagen de prenda con Gemini 2.5 Flash-Lite.
 * Devuelve metadatos sugeridos: nombre, categoría, color, estaciones, ocasiones, estilos, descripción.
 *
 * Seguridad: GEMINI_API_KEY solo server-side, nunca con NEXT_PUBLIC_.
 * Analytics: eventos ia_analisis_iniciado / ia_analisis_completado / ia_analisis_fallido → PostHog.
 */


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

  if (!hasGeminiApiKey()) {
    logger.error("[prendas/analizar] GEMINI_API_KEY no configurada", { endpoint: "prendas/analizar" });
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

  // H-17: detectar tipo real por magic bytes
  const mimeType = await detectImageMimeType(imagen);
  if (!mimeType) {
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
    const geminiRes = await geminiGenerateContent(GEMINI_FLASH_LITE, payload);

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      logger.error("[prendas/analizar] Gemini HTTP error", { endpoint: "prendas/analizar", status: geminiRes.status });
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
      logger.error("[prendas/analizar] No JSON in Gemini response", { endpoint: "prendas/analizar" });
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
    logger.error("[prendas/analizar] Error", { endpoint: "prendas/analizar" }, err instanceof Error ? err : undefined);
    await captureServerEvent(user.id, "ia_analisis_fallido", {
      motivo:      "exception",
      duracion_ms: Date.now() - inicioMs,
    });
    return NextResponse.json({ error: "ai_error" }, { status: 502 });
  }
}
