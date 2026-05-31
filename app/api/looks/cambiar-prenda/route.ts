import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Prenda } from "@/lib/database.types";
import type { PrendaResult, ClimaData } from "@/app/api/looks/generar/route";
import { checkAiRateLimit, recordAiUsage, rateLimitResponse } from "@/lib/ai/usage";
import { geminiGenerateContent, hasGeminiApiKey, GEMINI_FLASH_LITE } from "@/lib/gemini/client";
import { logger } from "@/lib/utils/logger";

/**
 * POST /api/looks/cambiar-prenda
 *
 * Reemplaza una prenda específica de un look con una alternativa elegida por IA.
 * No cambia el resto del look — solo la prenda indicada.
 *
 * Body:
 *   prenda_id_a_reemplazar  string   — ID de la prenda que el usuario quiere cambiar
 *   prendas_actuales        string[] — IDs de las otras prendas del look (sin la que se reemplaza)
 *   ocasion                 string   — ocasión del look original
 *   contexto?               string   — contexto libre del look original
 *   clima?                  ClimaData
 *
 * Respuesta exitosa:
 *   prenda_nueva  PrendaResult — la prenda alternativa
 *
 * Respuesta sin alternativas:
 *   error: "no_alternatives"  — 422
 */

const TIMEOUT_MS = 15_000;
const MAX_CANDIDATAS = 30;

export const maxDuration = 25;

interface CambiarPrendaBody {
  prenda_id_a_reemplazar: string;
  prendas_actuales:       string[];
  ocasion:                string;
  contexto?:              string;
  clima?:                 ClimaData;
  descripcion_look_actual?: string;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_session" }, { status: 401 });

  if (!hasGeminiApiKey()) {
    logger.error("[looks/cambiar-prenda] GEMINI_API_KEY no configurada", { endpoint: "looks/cambiar-prenda" });
    return NextResponse.json({ error: "ai_no_config" }, { status: 500 });
  }

  let body: CambiarPrendaBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (!body.prenda_id_a_reemplazar || !body.ocasion) {
    return NextResponse.json({ error: "params_requeridos" }, { status: 400 });
  }

  // ── Rate limiting (H-03) ───────────────────────────────────────────────────
  const rl = await checkAiRateLimit(user.id, "cambio_prenda");
  if (!rl.allowed) return rateLimitResponse(rl.retryAfter);

  // ── 1. Traer todas las prendas del guardarropas ──────────────────────────────
  const { data: garmentsData, error: gError } = await supabase
    .from("prendas")
    .select(
      "id, nombre, color_principal, estaciones, estilos, ocasiones, etiquetas, ia_descripcion, category_id, imagen_url"
    )
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .limit(100);

  if (gError) {
    logger.error("[looks/cambiar-prenda] DB error", { endpoint: "looks/cambiar-prenda" }, gError instanceof Error ? gError : undefined);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  if (!garmentsData || garmentsData.length === 0) {
    return NextResponse.json(
      { error: "no_garments" },
      { status: 422 }
    );
  }

  // ── 2. Excluir la prenda a reemplazar y las que ya están en el look ──────────
  // Las candidatas son prendas que NO están en el look actual (ni la que se reemplaza)
  const excluirSet = new Set([body.prenda_id_a_reemplazar, ...body.prendas_actuales]);
  const candidatas = (garmentsData as Prenda[]).filter((g) => !excluirSet.has(g.id));

  if (candidatas.length === 0) {
    return NextResponse.json(
      { error: "no_alternatives", message: "No hay otras prendas en tu guardarropas para reemplazar esta." },
      { status: 422 }
    );
  }

  // ── 3. Resolver categorías ───────────────────────────────────────────────────
  const allIds     = [...garmentsData] as Prenda[];
  const categoryIds = [...new Set(allIds.map((g) => g.category_id).filter(Boolean))] as number[];
  const categoryMap: Record<number, string> = {};

  if (categoryIds.length > 0) {
    const { data: cats } = await supabase
      .from("categories")
      .select("id, nombre")
      .in("id", categoryIds);
    if (cats) {
      for (const c of cats as { id: number; nombre: string }[]) {
        categoryMap[c.id] = c.nombre;
      }
    }
  }

  // ── 3b. Encontrar la prenda a reemplazar y su categoría ─────────────────────
  const prendaAReemplazar = (garmentsData as Prenda[]).find(
    (g) => g.id === body.prenda_id_a_reemplazar
  );
  const catIdAReemplazar  = prendaAReemplazar?.category_id ?? null;
  const categoriaNombre   = catIdAReemplazar
    ? (categoryMap[catIdAReemplazar] ?? "Otro")
    : "Otro";

  // Priorizar candidatas del mismo grupo; si hay al menos 3, usar solo esas
  const mismaCategoria  = candidatas.filter(
    (g) => catIdAReemplazar !== null && g.category_id === catIdAReemplazar
  );
  const candidatasParaIA = mismaCategoria.length >= 3 ? mismaCategoria : candidatas;

  // ── 4. Describir el look actual (las prendas que se quedan) ─────────────────
  const prendasEnLook = (garmentsData as Prenda[]).filter((g) =>
    body.prendas_actuales.includes(g.id)
  );

  const lookLines = prendasEnLook
    .map((g) => {
      const cat = g.category_id ? (categoryMap[g.category_id] ?? "Otro") : "Otro";
      return `  - ${g.nombre} (${cat}, ${g.color_principal ?? "neutro"})`;
    })
    .join("\n");

  // ── 5. Construir lista de candidatas (máx MAX_CANDIDATAS) ───────────────────
  // Usamos índices secuenciales (no UUIDs) para que la IA no tenga que
  // reproducir UUIDs exactos, lo que causaba hallucination y 502.
  const candidatasSlice = candidatasParaIA.slice(0, MAX_CANDIDATAS);
  const candidatasLines = candidatasSlice
    .map((g, i) => {
      const cat  = g.category_id ? (categoryMap[g.category_id] ?? "Otro") : "Otro";
      const desc = g.ia_descripcion ? ` — ${g.ia_descripcion.slice(0, 100)}` : "";
      return `${i + 1}. ${g.nombre} (${cat}, ${g.color_principal ?? "neutro"})${desc}`;
    })
    .join("\n");

  const weatherLine = body.clima
    ? `Clima: ${body.clima.temperatura}°C, ${body.clima.condicion}.`
    : "Clima: no disponible.";

  const prompt = `Sos una estilista experta. Un usuario tiene este look armado para la ocasión "${body.ocasion}":

PRENDAS ACTUALES DEL LOOK:
${lookLines || "  (ninguna — el look está vacío excepto la prenda a reemplazar)"}

${body.contexto ? `Contexto adicional: ${body.contexto}` : ""}
${weatherLine}

Quiere reemplazar una prenda de categoría "${categoriaNombre}". Debés elegir la MEJOR alternativa de esta lista que:
1. Sea de la misma categoría "${categoriaNombre}" (o muy similar)
2. Sea compatible visualmente y en estilo con las prendas que ya están en el look
3. Sea apropiada para la ocasión "${body.ocasion}"

CANDIDATAS DISPONIBLES (${candidatasSlice.length} prendas):
${candidatasLines}

Si ninguna prenda de la lista es compatible con el look actual, respondé con:
{"no_alternatives": true, "razon": "máximo 8 palabras en español"}

Si encontrás una alternativa, respondé ÚNICAMENTE con un JSON válido, sin markdown:
{
  "numero": N,
  "combina_bien": true o false,
  "advertencia": "si combina_bien es false: breve razón de incompatibilidad (máx 12 palabras). Si combina_bien es true: null",
  "descripcion_actualizada": "2-3 oraciones en español describiendo cómo funciona el look completo con la nueva prenda"
}
donde N es el número de la prenda elegida (1 a ${candidatasSlice.length}).`;

  // ── 6. Llamar a Gemini ───────────────────────────────────────────────────────
  let rawText = "";
  let tokensUsados: number | null = null;

  try {
    const controller = new AbortController();
    const tid        = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const geminiRes = await geminiGenerateContent(
      GEMINI_FLASH_LITE,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.5, topK: 20, topP: 0.9, maxOutputTokens: 200 },
      },
      { signal: controller.signal },
    );

    clearTimeout(tid);

    if (!geminiRes.ok) {
      const errBody = await geminiRes.json().catch(() => ({})) as {
        error?: { status?: string; details?: { retryDelay?: string }[] };
      };
      logger.error("[looks/cambiar-prenda] Gemini HTTP error", { endpoint: "looks/cambiar-prenda", status: geminiRes.status });
      if (geminiRes.status === 429) {
        const retryDelay   = errBody.error?.details?.find((d) => "retryDelay" in d)?.retryDelay ?? "60s";
        const retrySeconds = parseInt(retryDelay) || 60;
        return NextResponse.json({ error: "ai_quota", retry_after: retrySeconds }, { status: 429 });
      }
      return NextResponse.json({ error: "ai_error" }, { status: 502 });
    }

    const geminiData = await geminiRes.json();
    rawText      = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    tokensUsados = geminiData?.usageMetadata?.totalTokenCount ?? null;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      return NextResponse.json({ error: "ai_timeout" }, { status: 504 });
    }
    logger.error("[looks/cambiar-prenda] Gemini call error", { endpoint: "looks/cambiar-prenda" }, err instanceof Error ? err : undefined);
    return NextResponse.json({ error: "ai_error" }, { status: 502 });
  }

  // ── 7. Parsear respuesta ─────────────────────────────────────────────────────
  const jsonMatch = rawText.match(/\{[^{}]*\}/);
  if (!jsonMatch) {
    logger.error("[looks/cambiar-prenda] No JSON in response", { endpoint: "looks/cambiar-prenda" });
    return NextResponse.json({ error: "ai_parse_error" }, { status: 502 });
  }

  let aiResult: {
    numero?: number;
    no_alternatives?: boolean;
    razon?: string;
    combina_bien?: boolean;
    advertencia?: string | null;
    descripcion_actualizada?: string;
  };
  try {
    aiResult = JSON.parse(jsonMatch[0]);
  } catch {
    logger.error("[looks/cambiar-prenda] JSON parse error", { endpoint: "looks/cambiar-prenda" });
    return NextResponse.json({ error: "ai_parse_error" }, { status: 502 });
  }

  // Sin alternativas según la IA
  if (aiResult.no_alternatives) {
    return NextResponse.json(
      { error: "no_alternatives", message: aiResult.razon ?? "No hay alternativas compatibles en tu guardarropas." },
      { status: 422 }
    );
  }

  // ── 8. Validar que el índice elegido está dentro de rango ────────────────────
  const idx = typeof aiResult.numero === "number" ? aiResult.numero - 1 : -1;
  if (idx < 0 || idx >= candidatasSlice.length) {
    logger.error("[looks/cambiar-prenda] índice inválido", { endpoint: "looks/cambiar-prenda", numero: aiResult.numero, total: candidatasSlice.length });
    return NextResponse.json({ error: "ai_invalid_id" }, { status: 502 });
  }

  const nuevaPrenda = candidatasSlice[idx];

  // ── 9. Firmar URL de imagen ──────────────────────────────────────────────────
  let signedUrl: string | null = null;
  if (nuevaPrenda.imagen_url) {
    const { data: signed } = await supabase.storage
      .from("prendas")
      .createSignedUrls([nuevaPrenda.imagen_url], 3600);
    if (signed?.[0]?.signedUrl) signedUrl = signed[0].signedUrl;
  }

  // ── 10. Registrar uso en ai_usage (service role — H-01) ──────────────────────
  await recordAiUsage(user.id, "cambio_prenda", {
    tokens: tokensUsados,
    costo:  tokensUsados ? tokensUsados * 0.000000075 : null,
  });

  // ── 11. Responder ────────────────────────────────────────────────────────────
  const prendaNuevaResult: PrendaResult = {
    id:        nuevaPrenda.id,
    nombre:    nuevaPrenda.nombre,
    categoria: nuevaPrenda.category_id ? (categoryMap[nuevaPrenda.category_id] ?? "Otro") : "Otro",
    color:     nuevaPrenda.color_principal ?? "neutro",
    signedUrl,
  };

  return NextResponse.json({
    prenda_nueva:           prendaNuevaResult,
    combina_bien:           aiResult.combina_bien !== false,
    advertencia:            aiResult.advertencia ?? null,
    descripcion_actualizada: aiResult.descripcion_actualizada ?? null,
  });
}
