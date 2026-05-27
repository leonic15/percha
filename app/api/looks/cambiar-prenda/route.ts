import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Prenda } from "@/lib/database.types";
import type { PrendaResult, ClimaData } from "@/app/api/looks/generar/route";

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

const GEMINI_MODEL = "gemini-2.5-flash-lite";
const GEMINI_URL   = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const TIMEOUT_MS   = 15_000;

interface CambiarPrendaBody {
  prenda_id_a_reemplazar: string;
  prendas_actuales:       string[];
  ocasion:                string;
  contexto?:              string;
  clima?:                 ClimaData;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_session" }, { status: 401 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[looks/cambiar-prenda] GEMINI_API_KEY no configurada");
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
    console.error("[looks/cambiar-prenda] DB error:", gError);
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

  // ── 5. Construir lista de candidatas ─────────────────────────────────────────
  const candidatasLines = candidatas
    .map((g) => {
      const cat  = g.category_id ? (categoryMap[g.category_id] ?? "Otro") : "Otro";
      const desc = g.ia_descripcion ? ` — ${g.ia_descripcion.slice(0, 100)}` : "";
      return `ID:${g.id} | ${g.nombre} (${cat}, ${g.color_principal ?? "neutro"})${desc}`;
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

Quiere reemplazar una prenda. Debés elegir la MEJOR alternativa de esta lista de prendas disponibles que:
1. Sea compatible visualmente y en estilo con las prendas que ya están en el look
2. Sea apropiada para la ocasión "${body.ocasion}"
3. Prefentemente de una categoría similar a la que se reemplaza

CANDIDATAS DISPONIBLES (${candidatas.length} prendas):
${candidatasLines}

Si ninguna prenda de la lista es compatible con el look actual, respondé con:
{"no_alternatives": true, "razon": "breve explicación en español"}

Si encontrás una buena alternativa, respondé ÚNICAMENTE con un JSON válido, sin markdown:
{"prenda_id": "id_exacto_de_la_prenda_elegida"}`;

  // ── 6. Llamar a Gemini ───────────────────────────────────────────────────────
  let rawText = "";
  let tokensUsados: number | null = null;

  try {
    const controller = new AbortController();
    const tid        = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature:     0.5,
          topK:            20,
          topP:            0.9,
          maxOutputTokens: 128,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(tid);

    if (!geminiRes.ok) {
      const errBody = await geminiRes.json().catch(() => ({})) as {
        error?: { details?: { retryDelay?: string }[] };
      };
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
    console.error("[looks/cambiar-prenda] Gemini call error:", err);
    return NextResponse.json({ error: "ai_error" }, { status: 502 });
  }

  // ── 7. Parsear respuesta ─────────────────────────────────────────────────────
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("[looks/cambiar-prenda] No JSON in response:", rawText);
    return NextResponse.json({ error: "ai_parse_error" }, { status: 502 });
  }

  let aiResult: { prenda_id?: string; no_alternatives?: boolean; razon?: string };
  try {
    aiResult = JSON.parse(jsonMatch[0]);
  } catch {
    return NextResponse.json({ error: "ai_parse_error" }, { status: 502 });
  }

  // Sin alternativas según la IA
  if (aiResult.no_alternatives) {
    return NextResponse.json(
      { error: "no_alternatives", message: aiResult.razon ?? "No hay alternativas compatibles en tu guardarropas." },
      { status: 422 }
    );
  }

  // ── 8. Validar que el ID elegido existe en las candidatas ────────────────────
  const validCandidateIds = new Set(candidatas.map((g) => g.id));
  if (!aiResult.prenda_id || !validCandidateIds.has(aiResult.prenda_id)) {
    console.error("[looks/cambiar-prenda] ID inválido o no en candidatas:", aiResult.prenda_id);
    return NextResponse.json({ error: "ai_invalid_id" }, { status: 502 });
  }

  const nuevaPrenda = candidatas.find((g) => g.id === aiResult.prenda_id)!;

  // ── 9. Firmar URL de imagen ──────────────────────────────────────────────────
  let signedUrl: string | null = null;
  if (nuevaPrenda.imagen_url) {
    const { data: signed } = await supabase.storage
      .from("prendas")
      .createSignedUrls([nuevaPrenda.imagen_url], 3600);
    if (signed?.[0]?.signedUrl) signedUrl = signed[0].signedUrl;
  }

  // ── 10. Registrar uso en ai_usage ────────────────────────────────────────────
  await supabase.from("ai_usage").insert({
    user_id:        user.id,
    tipo:           "cambio_prenda",
    tokens_usados:  tokensUsados,
    costo_estimado: tokensUsados ? tokensUsados * 0.000000075 : null,
  });

  // ── 11. Responder ────────────────────────────────────────────────────────────
  const prendaNuevaResult: PrendaResult = {
    id:        nuevaPrenda.id,
    nombre:    nuevaPrenda.nombre,
    categoria: nuevaPrenda.category_id ? (categoryMap[nuevaPrenda.category_id] ?? "Otro") : "Otro",
    color:     nuevaPrenda.color_principal ?? "neutro",
    signedUrl,
  };

  return NextResponse.json({ prenda_nueva: prendaNuevaResult });
}
