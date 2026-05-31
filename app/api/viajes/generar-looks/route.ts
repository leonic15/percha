import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Prenda } from "@/lib/database.types";
import { TIPO_EVENTO, EVENTO_CONFIG, type TipoEvento, type ModoOptimizacion } from "@/lib/viajes/constants";
import type { PrendaResult } from "@/app/api/looks/generar/route";

/**
 * POST /api/viajes/generar-looks
 *
 * Genera todos los looks para un viaje en una única llamada a Gemini.
 * No persiste nada — el cliente guarda al confirmar el viaje.
 *
 * Body: GenerarViajeLooksBody
 * Respuesta: GenerarViajeLooksResult
 */

const GEMINI_MODEL = "gemini-2.5-flash-lite";
const GEMINI_URL   = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const TIMEOUT_MS   = 45_000;

// ── Tipos públicos ─────────────────────────────────────────────────────────────

export interface EventoWizard {
  tipo: TipoEvento;
  cantidad_looks: number;
}

export interface GenerarViajeLooksBody {
  destinos: { ciudad: string; pais: string }[];
  fecha_inicio: string;
  fecha_fin: string;
  modo_optimizacion: ModoOptimizacion;
  estilos: string[];
  eventos: EventoWizard[];
  prendas_incluir: string[];
  prendas_excluir: string[];
  // Modo regeneración: solo regenera 1 look específico
  regenerar?: {
    evento: TipoEvento;
    numero_en_evento: number;
    prendas_ya_seleccionadas: string[];
  };
}

export interface GeneratedViajeLook {
  evento: TipoEvento;
  numero_en_evento: number;
  nombre_sugerido: string;
  descripcion_look: string;
  prendas: string[];
  prendas_data: PrendaResult[];
}

export interface GenerarViajeLooksResult {
  looks: GeneratedViajeLook[];
  prendas_faltantes: string[];
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_session" }, { status: 401 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ai_no_config" }, { status: 500 });

  let body: GenerarViajeLooksBody;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }); }

  if (!body.eventos?.length) {
    return NextResponse.json({ error: "eventos_requeridos" }, { status: 400 });
  }

  // ── 1. Traer guardarropas ──────────────────────────────────────────────────
  const { data: garmentsRaw, error: gErr } = await supabase
    .from("prendas")
    .select("id, nombre, color_principal, estaciones, estilos, ocasiones, etiquetas, ia_descripcion, category_id, imagen_url, is_favorite")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .limit(120);

  if (gErr) return NextResponse.json({ error: "db_error" }, { status: 500 });
  if (!garmentsRaw?.length) {
    return NextResponse.json({ error: "no_garments" }, { status: 422 });
  }

  const excludeSet = new Set(body.prendas_excluir ?? []);
  const garments   = (garmentsRaw as Prenda[]).filter((g) => !excludeSet.has(g.id));

  // ── 2. Resolver categorías ─────────────────────────────────────────────────
  const catIds = [...new Set(garments.map((g) => g.category_id).filter(Boolean))] as number[];
  const catMap: Record<number, string> = {};
  if (catIds.length) {
    const { data: cats } = await supabase
      .from("categories")
      .select("id, nombre")
      .in("id", catIds);
    for (const c of (cats ?? []) as { id: number; nombre: string }[]) {
      catMap[c.id] = c.nombre;
    }
  }

  // ── 3. Perfil (género) ─────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from("profiles")
    .select("genero")
    .eq("id", user.id)
    .single();
  const genero = profile?.genero ?? null;

  // ── 4. Construir prompt ────────────────────────────────────────────────────
  const destinosStr = body.destinos.map((d) => `${d.ciudad}, ${d.pais}`).join(" → ");
  const duracionDias = Math.max(
    1,
    Math.round(
      (new Date(body.fecha_fin).getTime() - new Date(body.fecha_inicio).getTime()) /
        (1000 * 60 * 60 * 24)
    ) + 1
  );

  const modoDesc =
    body.modo_optimizacion === "maleta_liviana"
      ? "MALETA LIVIANA: priorizá prendas que combinen entre sí para reducir el total. Podés repetir prendas base (ej. el mismo jean) en distintos looks."
      : "ESTILO COMPLETO: cada look debe ser visualmente diferenciado. Minimizá la repetición de prendas, salvo accesorios o prendas muy neutras.";

  const estilosStr = body.estilos.length
    ? `Estilos preferidos para el viaje: ${body.estilos.join(", ")}.`
    : "Sin estilo preferido específico.";

  const incluirStr = body.prendas_incluir.length
    ? `Prendas que DEBEN aparecer en algún look (usar al menos una vez): ${body.prendas_incluir.join(", ")}.`
    : "";

  const generoLine =
    genero === "hombre"
      ? "Género: hombre. Usá terminología masculina (remera, pantalón, campera, etc.)."
      : genero === "mujer"
        ? "Género: mujer. Usá terminología femenina (blusa, falda, saco, vestido, etc.)."
        : "Género: no especificado. Usá terminología neutra.";

  const garmentLines = garments
    .map((g) => {
      const cat  = g.category_id ? (catMap[g.category_id] ?? "Otro") : "Otro";
      const fav  = g.is_favorite ? " [FAVORITA]" : "";
      const desc = g.ia_descripcion ? ` — ${g.ia_descripcion.slice(0, 100)}` : "";
      return `ID:${g.id} | ${g.nombre} (${cat}, ${g.color_principal ?? "neutro"})${fav}${desc}`;
    })
    .join("\n");

  // Qué looks generar
  const isRegen = !!body.regenerar;
  let eventosTarget: EventoWizard[];
  let regenContext = "";

  if (isRegen && body.regenerar) {
    eventosTarget = [{ tipo: body.regenerar.evento, cantidad_looks: 1 }];
    regenContext = body.regenerar.prendas_ya_seleccionadas.length
      ? `\nPrendas ya usadas en otros looks de este viaje (evitá repetirlas si es posible): ${body.regenerar.prendas_ya_seleccionadas.join(", ")}.`
      : "";
  } else {
    eventosTarget = body.eventos;
  }

  const eventosStr = eventosTarget
    .map((e) => {
      const cfg = EVENTO_CONFIG[e.tipo];
      return `- ${cfg.emoji} ${cfg.label} (${cfg.descripcion}): ${e.cantidad_looks} look${e.cantidad_looks > 1 ? "s" : ""}`;
    })
    .join("\n");

  const totalLooks = eventosTarget.reduce((s, e) => s + e.cantidad_looks, 0);

  const prompt = `Sos una estilista experta armando la maleta para un viaje.

DATOS DEL VIAJE:
- Destino(s): ${destinosStr}
- Fechas: del ${body.fecha_inicio} al ${body.fecha_fin} (${duracionDias} días)
- ${generoLine}
- ${estilosStr}

MODO DE OPTIMIZACIÓN:
${modoDesc}
${incluirStr ? `\n${incluirStr}` : ""}${regenContext}

EVENTOS A VESTIR:
${eventosStr}

GUARDARROPAS DISPONIBLE (${garments.length} prendas):
${garmentLines}

INSTRUCCIONES:
1. Generá exactamente ${totalLooks} look(s) según los eventos indicados.
2. Para cada look elegí entre 2 y 6 prendas de la lista anterior (usá los IDs exactos).
3. Priorizá coherencia estética, adecuación al evento y al género.
4. COMPOSICIÓN OBLIGATORIA por look:
   a) Siempre incluí parte inferior (pantalón, jean, short, falda) O prenda completa (vestido, mono).
   b) Siempre incluí parte superior (remera, blusa, buzo, camisa) y/o abrigo.
   c) Si hay abrigo exterior, incluí también una base debajo.
   d) No repitas 2 prendas del mismo grupo en el mismo look.
5. Los IDs de prendas DEBEN estar en la lista del guardarropas.
6. Si falta algo clave (calzado, bolso), listalo en prendas_faltantes.
7. El campo "evento" debe ser EXACTAMENTE uno de estos valores en minúsculas: trabajo, playa, outdoor, noche, paseos, deporte, formal.

Respondé ÚNICAMENTE con JSON válido, sin markdown ni texto extra:
{
  "looks": [
    {
      "evento": "trabajo",
      "numero_en_evento": 1,
      "nombre_sugerido": "nombre creativo 2-4 palabras",
      "descripcion_look": "2-3 oraciones estilo estilista",
      "prendas": ["id1", "id2", "id3"]
    }
  ],
  "prendas_faltantes": ["descripción de prenda faltante si aplica"]
}`;

  // ── 5. Llamar a Gemini ──────────────────────────────────────────────────────
  let rawText = "";
  let tokensUsados: number | null = null;

  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature:     0.75,
          topK:            40,
          topP:            0.95,
          maxOutputTokens: 2048,
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
        const retryDelay = errBody.error?.details?.find((d) => "retryDelay" in d)?.retryDelay ?? "60s";
        return NextResponse.json({ error: "ai_quota", retry_after: parseInt(retryDelay) || 60 }, { status: 429 });
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
    return NextResponse.json({ error: "ai_error" }, { status: 502 });
  }

  // ── 6. Parsear respuesta ────────────────────────────────────────────────────
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return NextResponse.json({ error: "ai_parse_error" }, { status: 502 });

  let aiResult: {
    looks: { evento: TipoEvento; numero_en_evento: number; nombre_sugerido: string; descripcion_look: string; prendas: string[] }[];
    prendas_faltantes: string[];
  };

  try { aiResult = JSON.parse(jsonMatch[0]); }
  catch { return NextResponse.json({ error: "ai_parse_error" }, { status: 502 }); }

  // ── 7. Validar IDs, normalizar eventos y firmar URLs ──────────────────────
  const validIds     = new Set(garments.map((g) => g.id));
  const validEventos = new Set<string>(TIPO_EVENTO);
  const imagePaths   = new Set<string>();

  const looksValidados = (aiResult.looks ?? [])
    .map((look) => ({ ...look, evento: (look.evento ?? "").toLowerCase() as TipoEvento }))
    .filter((look) => validEventos.has(look.evento))
    .map((look) => {
      const validPrendas = (look.prendas ?? []).filter((id) => validIds.has(id));
      validPrendas.forEach((id) => {
        const g = garments.find((g) => g.id === id);
        if (g?.imagen_url) imagePaths.add(g.imagen_url);
      });
      return { ...look, prendas: validPrendas };
    });

  const signedMap: Record<string, string> = {};
  if (imagePaths.size > 0) {
    const { data: signed } = await supabase.storage
      .from("prendas")
      .createSignedUrls([...imagePaths], 3600);
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) signedMap[s.path] = s.signedUrl;
    }
  }

  const looks: GeneratedViajeLook[] = looksValidados.map((look) => {
    const selected = garments.filter((g) => look.prendas.includes(g.id));
    const prendas_data: PrendaResult[] = selected.map((g) => ({
      id:        g.id,
      nombre:    g.nombre,
      categoria: g.category_id ? (catMap[g.category_id] ?? "Otro") : "Otro",
      color:     g.color_principal ?? "neutro",
      signedUrl: g.imagen_url ? (signedMap[g.imagen_url] ?? null) : null,
    }));
    return {
      evento:           look.evento,
      numero_en_evento: look.numero_en_evento ?? 1,
      nombre_sugerido:  look.nombre_sugerido ?? "Look de viaje",
      descripcion_look: look.descripcion_look ?? "",
      prendas:          look.prendas,
      prendas_data,
    };
  });

  // ── 8. Registrar uso ───────────────────────────────────────────────────────
  const costo = tokensUsados ? tokensUsados * 0.000000075 : null;
  await supabase.from("ai_usage").insert({
    user_id: user.id,
    tipo:    "generacion_look",
    tokens_usados: tokensUsados,
    costo_estimado: costo,
  });

  return NextResponse.json({
    looks,
    prendas_faltantes: aiResult.prendas_faltantes ?? [],
  } satisfies GenerarViajeLooksResult);
}
