import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { GarmentAnalysis } from "@/app/api/prendas/analizar/route";
import { geminiGenerateContent, hasGeminiApiKey, GEMINI_FLASH_LITE } from "@/lib/gemini/client";
import { logger } from "@/lib/utils/logger";

/**
 * POST /api/garments/[id]/analizar
 *
 * Relanza el análisis IA sobre una prenda ya guardada (LOOKSI-016).
 * La imagen se descarga desde Supabase Storage (sin client upload).
 *
 * Flujo:
 *  1. Valida sesión y propiedad de la prenda
 *  2. Descarga imagen desde Storage
 *  3. Llama a Gemini 2.5 Flash-Lite (misma lógica que /api/prendas/analizar)
 *  4. Escribe ia_analizada=true + ia_descripcion en la tabla prendas
 *  5. Registra en ai_usage
 *  6. Devuelve GarmentAnalysis
 *
 * Respuesta 200: GarmentAnalysis
 * Respuesta 422: { error: "sin_imagen" }  → la prenda no tiene foto en Storage
 */

const TIMEOUT_MS = 25_000;

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

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(
  _req: NextRequest,
  { params }: RouteContext,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_session" }, { status: 401 });

  if (!hasGeminiApiKey()) {
    logger.error("[garments/analizar] GEMINI_API_KEY no configurada", { endpoint: "garments/analizar" });
    return NextResponse.json({ error: "ai_no_config" }, { status: 500 });
  }

  const { id } = await params;

  // ── 1. Verificar propiedad y obtener imagen_url ───────────────────────────
  const { data: row, error: rowError } = await supabase
    .from("prendas")
    .select("id, user_id, imagen_url")
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();

  if (rowError || !row) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const prenda = row as { id: string; user_id: string; imagen_url: string | null };

  if (!prenda.imagen_url) {
    return NextResponse.json(
      { error: "sin_imagen", message: "Esta prenda no tiene imagen para analizar." },
      { status: 422 },
    );
  }

  // ── 2. Descargar imagen desde Supabase Storage ────────────────────────────
  const { data: fileData, error: dlError } = await supabase.storage
    .from("prendas")
    .download(prenda.imagen_url);

  if (dlError || !fileData) {
    logger.error("[garments/analizar] Error descargando imagen", { endpoint: "garments/analizar" }, dlError instanceof Error ? dlError : undefined);
    return NextResponse.json({ error: "imagen_no_disponible" }, { status: 502 });
  }

  // Detectar MIME del path (por extensión)
  const ext      = prenda.imagen_url.split(".").pop()?.toLowerCase() ?? "jpg";
  const mimeMap: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg",
    png: "image/png",  webp: "image/webp",
    avif: "image/avif", gif: "image/gif",
  };
  const mimeType = mimeMap[ext] ?? "image/jpeg";

  // ── 3. Convertir a base64 ─────────────────────────────────────────────────
  const arrayBuffer = await fileData.arrayBuffer();
  const base64      = Buffer.from(arrayBuffer).toString("base64");

  // ── 4. Llamar a Gemini ────────────────────────────────────────────────────
  let rawText       = "";
  let tokensUsados: number | null = null;

  try {
    const controller = new AbortController();
    const tid        = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const geminiRes = await geminiGenerateContent(
      GEMINI_FLASH_LITE,
      {
        contents: [{
          parts: [
            { text: PROMPT },
            { inline_data: { mime_type: mimeType, data: base64 } },
          ],
        }],
        generationConfig: { temperature: 0.1, topK: 1, topP: 1, maxOutputTokens: 512 },
      },
      { signal: controller.signal },
    );

    clearTimeout(tid);

    if (!geminiRes.ok) {
      logger.error("[garments/analizar] Gemini HTTP error", { endpoint: "garments/analizar", status: geminiRes.status });
      return NextResponse.json({ error: "ai_error" }, { status: 502 });
    }

    const geminiData = await geminiRes.json();
    rawText      = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    tokensUsados = geminiData?.usageMetadata?.totalTokenCount ?? null;

  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      return NextResponse.json({ error: "ai_timeout" }, { status: 504 });
    }
    logger.error("[garments/analizar] Gemini call error", { endpoint: "garments/analizar" }, err instanceof Error ? err : undefined);
    return NextResponse.json({ error: "ai_error" }, { status: 502 });
  }

  // ── 5. Parsear respuesta ──────────────────────────────────────────────────
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    logger.error("[garments/analizar] No JSON in Gemini response", { endpoint: "garments/analizar" });
    return NextResponse.json({ error: "ai_parse_error" }, { status: 502 });
  }

  let analysis: GarmentAnalysis;
  try {
    analysis = JSON.parse(jsonMatch[0]);
  } catch {
    return NextResponse.json({ error: "ai_parse_error" }, { status: 502 });
  }

  // ── 6. Actualizar la prenda en DB ─────────────────────────────────────────
  const { error: updateError } = await supabase
    .from("prendas")
    .update({
      ia_analizada:   true,
      ia_descripcion: analysis.descripcion ?? null,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (updateError) {
    logger.error("[garments/analizar] Error actualizando prenda", { endpoint: "garments/analizar" }, updateError instanceof Error ? updateError : undefined);
    // Devolvemos el resultado igual — el cliente puede mostrar la descripción
    // aunque no se haya persistido (non-fatal)
  }

  // ── 7. Registrar en ai_usage ──────────────────────────────────────────────
  await supabase.from("ai_usage").insert({
    user_id:        user.id,
    tipo:           "analisis_prenda",
    tokens_usados:  tokensUsados,
    costo_estimado: tokensUsados ? tokensUsados * 0.000000075 : null,
  });

  return NextResponse.json(analysis);
}
