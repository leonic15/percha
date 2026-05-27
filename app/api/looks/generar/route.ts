import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Prenda } from "@/lib/database.types";

/**
 * POST /api/looks/generar
 *
 * Genera un look con IA (Gemini 2.5 Flash-Lite) usando las prendas del guardarropas.
 * No envía imágenes — solo metadatos textuales (menor costo y latencia).
 *
 * Body:
 *   ocasion          string — requerido (ej: "Trabajo")
 *   contexto?        string — texto libre del usuario
 *   modo             "desde_cero" | "con_base"
 *   prenda_base_id?  string — ID de prenda base (solo si modo = "con_base")
 *   prendas_excluidas? string[] — IDs a excluir del look
 *   clima?           { temperatura: number; condicion: string }
 *
 * Respuesta:
 *   nombre_sugerido  string
 *   descripcion_look string
 *   prendas          string[]  — IDs validados del guardarropas
 *   prendas_data     PrendaResult[]
 *   prendas_faltantes string[]
 *   parametros       object
 */

const GEMINI_MODEL = "gemini-2.5-flash-lite";
const GEMINI_URL   = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const TIMEOUT_MS   = 20_000;

// ── Tipos públicos (reutilizados por el cliente) ───────────────────────────────

export interface ClimaData {
  temperatura:       number;
  temperatura_max?:  number;
  temperatura_min?:  number;
  sensacion_termica?: number;
  condicion:         string;
  weathercode?:      number;
  franjas?:          { mañana: number; tarde: number; noche: number };
}

export interface GenerarLookBody {
  ocasion:            string;
  contexto?:          string;
  modo:               "desde_cero" | "con_base";
  prenda_base_id?:    string;
  prendas_excluidas?: string[];
  clima?:             ClimaData;
}

export interface PrendaResult {
  id:        string;
  nombre:    string;
  categoria: string;
  color:     string;
  signedUrl: string | null;
}

export interface GenerarLookResult {
  nombre_sugerido:   string;
  descripcion_look:  string;
  prendas:           string[];
  prendas_data:      PrendaResult[];
  prendas_faltantes: string[];
  parametros: {
    ocasion:   string;
    contexto?: string;
    clima?:    ClimaData;
    modo:      string;
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_session" }, { status: 401 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[looks/generar] GEMINI_API_KEY no configurada");
    return NextResponse.json({ error: "ai_no_config" }, { status: 500 });
  }

  let body: GenerarLookBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (!body.ocasion) {
    return NextResponse.json({ error: "ocasion_requerida" }, { status: 400 });
  }

  // ── 1. Traer prendas del guardarropas ──────────────────────────────────────
  const { data: garmentsData, error: gError } = await supabase
    .from("prendas")
    .select(
      "id, nombre, color_principal, estaciones, estilos, ocasiones, etiquetas, ia_descripcion, category_id, imagen_url"
    )
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .limit(100);

  if (gError) {
    console.error("[looks/generar] DB error prendas:", gError);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  if (!garmentsData || garmentsData.length === 0) {
    return NextResponse.json(
      { error: "no_garments", message: "No tenés prendas en tu guardarropas." },
      { status: 422 }
    );
  }

  // Excluir prendas que el usuario no quiere
  const excludeSet = new Set(body.prendas_excluidas ?? []);
  const garments   = (garmentsData as Prenda[]).filter(
    (g) => !excludeSet.has(g.id)
  );

  // ── 2. Resolver categorías ─────────────────────────────────────────────────
  const categoryIds = [
    ...new Set(garments.map((g) => g.category_id).filter(Boolean)),
  ] as number[];

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

  // ── 3. Construir prompt para Gemini ────────────────────────────────────────
  const weatherLine = body.clima
    ? `Clima actual: ${body.clima.temperatura}°C, ${body.clima.condicion}.`
    : "Clima: no disponible (ignorar factor temperatura).";

  const garmentLines = garments
    .map((g) => {
      const cat  = g.category_id ? (categoryMap[g.category_id] ?? "Otro") : "Otro";
      const desc = g.ia_descripcion ? ` — ${g.ia_descripcion.slice(0, 120)}` : "";
      return `ID:${g.id} | ${g.nombre} (${cat}, ${g.color_principal ?? "neutro"})${desc}`;
    })
    .join("\n");

  const modeInstruction =
    body.modo === "con_base" && body.prenda_base_id
      ? `El look DEBE incluir obligatoriamente la prenda con ID:${body.prenda_base_id}. Completar con prendas que combinen.`
      : "Crear el look desde cero. La IA elige libremente las mejores prendas.";

  const prompt = `Sos una estilista experta. Armá un look cohesivo para esta persona.

PARÁMETROS:
- Ocasión: ${body.ocasion}
- ${body.contexto ? `Contexto: ${body.contexto}` : "Sin contexto adicional."}
- ${weatherLine}
- ${modeInstruction}

GUARDARROPAS DISPONIBLE (${garments.length} prendas):
${garmentLines}

INSTRUCCIONES:
1. Elegí entre 2 y 5 prendas de la lista anterior.
2. Priorizá: cohesión estética, adecuación a la ocasión, adaptación al clima.
3. Las prendas elegidas DEBEN estar en la lista (usá los IDs exactos).
4. Si el look está incompleto (ej: falta calzado, no hay en el guardarropas), listalo en prendas_faltantes.

Respondé ÚNICAMENTE con un JSON válido, sin markdown ni texto extra:
{
  "nombre_sugerido": "nombre creativo del look en español (2-4 palabras, ej: 'Sastre de oficina')",
  "descripcion_look": "2-3 oraciones en español, estilo estilista, explicando por qué estas prendas funcionan juntas y para qué contexto son ideales",
  "prendas": ["id1", "id2", "id3"],
  "prendas_faltantes": ["descripción de prenda faltante si aplica, ej: 'Calzado marrón o negro'"]
}`;

  // ── 4. Llamar a Gemini ──────────────────────────────────────────────────────
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
          temperature:     0.7,
          topK:            40,
          topP:            0.95,
          maxOutputTokens: 512,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(tid);

    if (!geminiRes.ok) {
      const errBody = await geminiRes.json().catch(() => ({})) as {
        error?: { status?: string; details?: { retryDelay?: string }[] };
      };
      console.error("[looks/generar] Gemini HTTP error:", geminiRes.status, errBody);

      if (geminiRes.status === 429) {
        // Extraer tiempo de retry del mensaje de Gemini si está disponible
        const retryDelay = errBody.error?.details?.find(
          (d) => "retryDelay" in d
        )?.retryDelay ?? "60s";
        const retrySeconds = parseInt(retryDelay) || 60;
        return NextResponse.json(
          { error: "ai_quota", retry_after: retrySeconds },
          { status: 429 }
        );
      }

      return NextResponse.json({ error: "ai_error" }, { status: 502 });
    }

    const geminiData = await geminiRes.json();
    rawText     = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    tokensUsados = geminiData?.usageMetadata?.totalTokenCount ?? null;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      return NextResponse.json({ error: "ai_timeout" }, { status: 504 });
    }
    console.error("[looks/generar] Gemini call error:", err);
    return NextResponse.json({ error: "ai_error" }, { status: 502 });
  }

  // ── 5. Parsear respuesta ───────────────────────────────────────────────────
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("[looks/generar] No JSON in response:", rawText);
    return NextResponse.json({ error: "ai_parse_error" }, { status: 502 });
  }

  let aiResult: {
    nombre_sugerido:   string;
    descripcion_look:  string;
    prendas:           string[];
    prendas_faltantes: string[];
  };

  try {
    aiResult = JSON.parse(jsonMatch[0]);
  } catch {
    console.error("[looks/generar] JSON parse error:", jsonMatch[0]);
    return NextResponse.json({ error: "ai_parse_error" }, { status: 502 });
  }

  // Validar que los IDs estén en nuestro guardarropas
  const validIds      = new Set(garments.map((g) => g.id));
  const validatedIds  = (aiResult.prendas ?? []).filter((id: string) => validIds.has(id));
  const selectedItems = garments.filter((g) => validatedIds.includes(g.id));

  // ── 6. Firmar URLs de las prendas seleccionadas ───────────────────────────
  const imagePaths = selectedItems
    .map((g) => g.imagen_url)
    .filter((u): u is string => Boolean(u));

  const signedMap: Record<string, string> = {};
  if (imagePaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from("prendas")
      .createSignedUrls(imagePaths, 3600);
    if (signed) {
      for (const s of signed) {
        if (s.path && s.signedUrl) signedMap[s.path] = s.signedUrl;
      }
    }
  }

  const prendasData: PrendaResult[] = selectedItems.map((g) => ({
    id:        g.id,
    nombre:    g.nombre,
    categoria: g.category_id ? (categoryMap[g.category_id] ?? "Otro") : "Otro",
    color:     g.color_principal ?? "neutro",
    signedUrl: g.imagen_url ? (signedMap[g.imagen_url] ?? null) : null,
  }));

  // ── 7. Registrar uso en ai_usage ──────────────────────────────────────────
  await supabase.from("ai_usage").insert({
    user_id:         user.id,
    tipo:            "generacion_look",
    tokens_usados:   tokensUsados,
    costo_estimado:  tokensUsados ? tokensUsados * 0.000000075 : null,
  });

  // ── 8. Responder ──────────────────────────────────────────────────────────
  const result: GenerarLookResult = {
    nombre_sugerido:   aiResult.nombre_sugerido  ?? "Mi look",
    descripcion_look:  aiResult.descripcion_look ?? "",
    prendas:           validatedIds,
    prendas_data:      prendasData,
    prendas_faltantes: aiResult.prendas_faltantes ?? [],
    parametros: {
      ocasion:   body.ocasion,
      contexto:  body.contexto,
      clima:     body.clima,
      modo:      body.modo,
    },
  };

  return NextResponse.json(result);
}
