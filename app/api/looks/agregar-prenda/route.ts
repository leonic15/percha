import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Prenda } from "@/lib/database.types";
import type { PrendaResult, ClimaData } from "@/app/api/looks/generar/route";

/**
 * POST /api/looks/agregar-prenda
 *
 * Sugiere una prenda del guardarropas para agregar al look actual.
 * El usuario describe el tipo que quiere (ej: "buzo", "accesorio") y la IA
 * elige la mejor opción que combine con el look y mantenga el estilo.
 *
 * Body:
 *   prendas_actuales  string[]  — IDs de las prendas del look actual
 *   tipo_prenda       string    — tipo libre (ej: "buzo", "cinturón")
 *   ocasion           string    — ocasión del look
 *   contexto?         string
 *   clima?            ClimaData
 *   descripcion_look? string    — descripción IA del look para mantener el estilo
 *   nombre_look?      string
 *
 * Respuesta exitosa:
 *   prenda_nueva  PrendaResult
 *
 * Sin match:
 *   error: "no_match"  — 422
 */

const GEMINI_MODEL   = "gemini-2.5-flash-lite";
const GEMINI_URL     = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const TIMEOUT_MS     = 15_000;
const MAX_CANDIDATAS = 30;

export const maxDuration = 25;

interface AgregarPrendaBody {
  prendas_actuales:  string[];
  tipo_prenda:       string;
  ocasion:           string;
  contexto?:         string;
  clima?:            ClimaData;
  descripcion_look?: string;
  nombre_look?:      string;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_session" }, { status: 401 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[looks/agregar-prenda] GEMINI_API_KEY no configurada");
    return NextResponse.json({ error: "ai_no_config" }, { status: 500 });
  }

  let body: AgregarPrendaBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (!body.tipo_prenda?.trim() || !body.ocasion) {
    return NextResponse.json({ error: "params_requeridos" }, { status: 400 });
  }

  // ── 1. Traer prendas del guardarropas ────────────────────────────────────────
  const { data: garmentsData, error: gError } = await supabase
    .from("prendas")
    .select(
      "id, nombre, color_principal, estaciones, estilos, ocasiones, etiquetas, ia_descripcion, category_id, imagen_url"
    )
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .limit(100);

  if (gError) {
    console.error("[looks/agregar-prenda] DB error:", gError);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  if (!garmentsData || garmentsData.length === 0) {
    return NextResponse.json({ error: "no_garments" }, { status: 422 });
  }

  // ── 2. Excluir prendas ya en el look ────────────────────────────────────────
  const excluirSet = new Set(body.prendas_actuales ?? []);
  const candidatas = (garmentsData as Prenda[]).filter((g) => !excluirSet.has(g.id));

  if (candidatas.length === 0) {
    return NextResponse.json(
      { error: "no_match", message: "No hay más prendas disponibles en tu guardarropas." },
      { status: 422 }
    );
  }

  // ── 3. Resolver categorías ───────────────────────────────────────────────────
  const allGarments = garmentsData as Prenda[];
  const categoryIds = [...new Set(allGarments.map((g) => g.category_id).filter(Boolean))] as number[];
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

  // ── 4. Describir el look actual ──────────────────────────────────────────────
  const prendasEnLook = allGarments.filter((g) =>
    (body.prendas_actuales ?? []).includes(g.id)
  );

  const lookLines = prendasEnLook
    .map((g) => {
      const cat = g.category_id ? (categoryMap[g.category_id] ?? "Otro") : "Otro";
      return `  - ${g.nombre} (${cat}, ${g.color_principal ?? "neutro"})`;
    })
    .join("\n");

  // ── 5. Construir candidatas (máx MAX_CANDIDATAS) ─────────────────────────────
  const candidatasSlice = candidatas.slice(0, MAX_CANDIDATAS);
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

  const lookContext = body.descripcion_look
    ? `\nEstilo del look: "${body.descripcion_look}"`
    : "";

  const prompt = `Sos una estilista experta. Un usuario tiene este look armado para "${body.ocasion}":

LOOK ACTUAL${body.nombre_look ? ` "${body.nombre_look}"` : ""}:
${lookLines || "  (look vacío)"}${lookContext}

${body.contexto ? `Contexto: ${body.contexto}\n` : ""}${weatherLine}

El usuario quiere agregar una prenda de tipo: "${body.tipo_prenda}"

Elegí de la siguiente lista la prenda que:
1. Corresponda al tipo solicitado: "${body.tipo_prenda}"
2. Combine mejor con el look actual (colores, estilo, ocasión)
3. Sea apropiada para "${body.ocasion}"

PRENDAS DISPONIBLES (${candidatasSlice.length}):
${candidatasLines}

Si ninguna prenda corresponde al tipo "${body.tipo_prenda}" o no hay combinación posible, respondé con:
{"no_match": true, "razon": "máximo 8 palabras en español"}

Si encontrás una buena opción, respondé ÚNICAMENTE con JSON válido, sin markdown:
{"numero": N}
donde N es el número de la prenda elegida (1 a ${candidatasSlice.length}).`;

  // ── 6. Llamar a Gemini ───────────────────────────────────────────────────────
  let rawText    = "";
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
          temperature:     0.4,
          topK:            20,
          topP:            0.9,
          maxOutputTokens: 200,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(tid);

    if (!geminiRes.ok) {
      const errBody = await geminiRes.json().catch(() => ({})) as {
        error?: { status?: string; details?: { retryDelay?: string }[] };
      };
      console.error("[looks/agregar-prenda] Gemini HTTP error:", geminiRes.status, errBody);
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
    console.error("[looks/agregar-prenda] Gemini call error:", err);
    return NextResponse.json({ error: "ai_error" }, { status: 502 });
  }

  // ── 7. Parsear respuesta ─────────────────────────────────────────────────────
  const jsonMatch = rawText.match(/\{[^{}]*\}/);
  if (!jsonMatch) {
    console.error("[looks/agregar-prenda] No JSON in response:", rawText);
    return NextResponse.json({ error: "ai_parse_error" }, { status: 502 });
  }

  let aiResult: { numero?: number; no_match?: boolean; razon?: string };
  try {
    aiResult = JSON.parse(jsonMatch[0]);
  } catch {
    console.error("[looks/agregar-prenda] JSON parse error:", jsonMatch[0]);
    return NextResponse.json({ error: "ai_parse_error" }, { status: 502 });
  }

  if (aiResult.no_match) {
    return NextResponse.json(
      {
        error:   "no_match",
        message: aiResult.razon ?? "No hay ninguna prenda de ese tipo en tu guardarropas que combine con el look.",
      },
      { status: 422 }
    );
  }

  // ── 8. Validar índice ────────────────────────────────────────────────────────
  const idx = typeof aiResult.numero === "number" ? aiResult.numero - 1 : -1;
  if (idx < 0 || idx >= candidatasSlice.length) {
    console.error("[looks/agregar-prenda] índice inválido:", aiResult.numero, "de", candidatasSlice.length);
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
