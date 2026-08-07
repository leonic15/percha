import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createHash } from "crypto";
import { checkAiRateLimit, recordAiUsage } from "@/lib/ai/usage";
import { geminiPost, geminiGet, hasGeminiApiKey } from "@/lib/gemini/client";
import { logger } from "@/lib/utils/logger";

/**
 * POST /api/looks/generar-imagen — PERCHA-035
 *
 * Genera una imagen fotorrealista del usuario usando el outfit del look.
 * Requiere que el perfil tenga: body_photo_url, altura_cm, peso_kg, genero.
 *
 * Body: { look_id: string, escenario?: string, ocasion?: string }
 *
 * Flujo:
 * 1. Validar sesión y que el look pertenece al usuario
 * 2. Leer datos corporales del perfil (body_photo_url, altura_cm, peso_kg, genero)
 * 3. Obtener prendas del look con metadatos e imágenes
 * 4. Construir prompt + imágenes de referencia para Gemini
 * 5. Llamar a la API de generación de imágenes (Gemini multimodal preferido)
 * 6. Subir imagen resultado a Supabase Storage (bucket: look-images)
 * 7. Retornar la URL firmada de la imagen generada
 *
 * Rate limiting: máx 3 generaciones por usuario por día
 * Seguridad: GOOGLE_VERTEX_API_KEY nunca con NEXT_PUBLIC_
 */

export const maxDuration = 60;

const BUCKET_LOOK_IMAGES = "look-images";
const BUCKET_BODY_PHOTOS  = "body-photos";
const DAILY_LIMIT         = 3;
const MAX_PRENDA_IMAGES   = 4; // máximo de fotos de prendas a incluir como referencia

// Perf (H-14): cachea en memoria de proceso el primer modelo que respondió OK,
// para probarlo primero y evitar recorrer los 404 de modelos no disponibles en
// cada request (la mayoría de las keys solo tienen acceso a uno o dos modelos).
let cachedWorkingModel: string | null = null;

// ── Tipos ──────────────────────────────────────────────────────────────────────

export interface GenerarImagenRequest {
  /** Look ya guardado en DB */
  look_id?:  string;
  /** Prendas del look aún no guardado (alternativa a look_id) */
  prendas?:  string[];
  escenario?: string;
  ocasion?:   string;
}

export interface GenerarImagenResponse {
  imagen_url:  string;  // signed URL (1h) de la imagen generada
  path:        string;  // path en Storage para guardar con el look
}

interface RefImage {
  b64:  string;
  mime: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hashUserId(userId: string): string {
  return createHash("sha256").update(userId).digest("hex");
}

/**
 * Usa Gemini Flash para obtener una descripción física detallada de la foto corporal.
 * Se usa en AMBOS paths: como texto de refuerzo en el prompt multimodal,
 * y como descripción completa en el fallback de solo texto (Imagen 4).
 */
async function getPhysicalDescription(imageB64: string, imageMime: string): Promise<string> {
  try {
    const res = await geminiPost(
      "/models/gemini-2.0-flash-lite:generateContent",
      {
          contents: [{
            parts: [
              {
                text: `Describe this person's physical appearance in detail for a fashion photo generation prompt.
Include ALL of the following:
- Gender presentation
- Approximate age range (e.g. "late 20s", "mid 30s")
- Body build and proportions (e.g. "slender build", "athletic medium build", "curvy figure")
- Skin tone with specific descriptors (e.g. "light olive skin", "warm medium brown skin", "fair pale skin")
- Hair: exact color, length, texture, and style (e.g. "straight black hair to the shoulders", "curly auburn hair in a bun")
- Face shape and notable facial features
- Any distinctive physical characteristics

Write in third person. Be precise and detailed. Do not include names, nationality assumptions, or personal judgments.`,
              },
              { inline_data: { mime_type: imageMime, data: imageB64 } },
            ],
          }],
          generationConfig: { maxOutputTokens: 250 },
      },
      { signal: AbortSignal.timeout(10000) },
    );
    if (!res.ok) return "";
    const json = await res.json();
    return (json?.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined)?.trim() ?? "";
  } catch {
    return "";
  }
}

/** Descarga una URL y la devuelve como base64 + mime. Fail-open: retorna null si falla. */
async function fetchImageAsB64(url: string, timeoutMs = 6000): Promise<RefImage | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return {
      b64:  Buffer.from(buf).toString("base64"),
      mime: (res.headers.get("content-type") ?? "image/jpeg").split(";")[0].trim(),
    };
  } catch {
    return null;
  }
}

/**
 * Prompt enmarcado como EDICIÓN de foto (no generación libre).
 * imagen[0] = foto corporal del usuario  → imagen base a editar
 * imagen[1..N] = fotos de las prendas   → ropa nueva a aplicar
 *
 * Usar "editar" en lugar de "generar" hace que el modelo trate la imagen de
 * referencia como punto de partida y preserve la identidad de la persona.
 */
function buildPromptWithImages(opts: {
  genero:           string;
  alturaStr:        string;
  appearance:       string;
  prendas:          { nombre: string; color: string }[];
  escenario:        string;
  ocasion:          string;
  numPrendasImages: number;
}): string {
  const { alturaStr, appearance, prendas, escenario, ocasion, numPrendasImages } = opts;
  const prendasStr = prendas.map((p) => `${p.nombre} (${p.color})`).join(", ");
  const sceneStr   = escenario || ocasion || "urban outdoor";
  const clothingSource = numPrendasImages > 0
    ? `The clothing items are shown in Images 2–${numPrendasImages + 1}. Reproduce them exactly.`
    : "";

  return [
    `You are a professional photo editor. I am giving you a full-body reference photo of a real person (Image 1).`,
    ``,
    `EDIT TASK: Produce a photorealistic image of the person from Image 1 wearing different clothes. This is a clothing replacement — not a new photo of a different person.`,
    ``,
    `MANDATORY RULES — apply all of them without exception:`,
    `1. FACE: must be pixel-perfect identical to Image 1. Same facial structure, eyes, nose, lips, skin tone, expression.`,
    `2. HAIR: same color, length, texture and style as Image 1. Do not alter it.`,
    `3. BODY: same build, proportions and height (${alturaStr}) as Image 1. Do not make the person taller, thinner, or different.`,
    `4. ONLY the clothing changes. Every other aspect of the person stays exactly as in Image 1.`,
    appearance ? `5. Additional physical description for accuracy: ${appearance}` : ``,
    ``,
    `CLOTHING TO APPLY: ${prendasStr}. ${clothingSource}`,
    ``,
    `SCENE: ${sceneStr}.`,
    ``,
    `OUTPUT REQUIREMENTS: Full body, head to toe. Natural lighting. Photorealistic — not illustrated, not drawn. Editorial fashion quality.`,
  ].filter(Boolean).join("\n");
}

/** Prompt de texto puro como fallback cuando no hay imágenes de referencia disponibles. */
function buildTextOnlyPrompt(opts: {
  genero:      string;
  alturaStr:   string;
  pesoStr:     string;
  appearance:  string;
  prendas:     { nombre: string; categoria: string; color: string; estilos?: string[] }[];
  escenario:   string;
  ocasion:     string;
}): string {
  const { genero, alturaStr, pesoStr, appearance, prendas, escenario, ocasion } = opts;
  const pronombre  = genero === "hombre" ? "man" : genero === "mujer" ? "woman" : "person";
  const prendasStr = prendas
    .map((p) => `${p.nombre} (${p.categoria}, ${p.color}${p.estilos?.length ? ", " + p.estilos.join("/") : ""})`)
    .join("; ");
  const appearancePart = appearance ? ` ${appearance}.` : "";
  return `Photorealistic full-body editorial fashion photo. A ${pronombre}, ${alturaStr} tall, ${pesoStr}.${appearancePart} Wearing: ${prendasStr}. Setting: ${escenario || ocasion || "urban outdoor"}. Natural lighting, clean background, full body head to toe.`;
}

/** Lista los modelos de imagen disponibles para la key — solo para diagnóstico. */
async function listImageModels(): Promise<string[]> {
  try {
    const res = await geminiGet("/models?pageSize=200", { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const json = await res.json();
    type ModelEntry = { name: string; supportedGenerationMethods?: string[] };
    return ((json.models ?? []) as ModelEntry[])
      .filter((m) =>
        m.name.toLowerCase().includes("image") ||
        m.name.toLowerCase().includes("imagen") ||
        m.supportedGenerationMethods?.includes("predict"),
      )
      .map((m) => m.name);
  } catch {
    return [];
  }
}

/**
 * Genera imagen via Gemini/Imagen.
 *
 * Estrategia de modelos (en orden de preferencia):
 * Los modelos Gemini van primero porque soportan imágenes de referencia inline.
 * Imagen 3/4 se usa como último recurso (solo texto).
 */
async function callGeminiImageGen(opts: {
  promptText: string;      // fallback texto puro (para Imagen 3)
  promptFull: string;      // prompt con instrucciones de referencia (para Gemini con imágenes)
  refImages:  RefImage[];  // [foto_cuerpo, prenda_1, ..., prenda_N]
}): Promise<string> {
  const { promptText, promptFull, refImages } = opts;

  const CANDIDATES = [
    // Pro models primero: mayor capacidad de preservación de identidad
    { model: "gemini-3-pro-image",                        method: "generateContent", useImagen: false, supportsImages: true  },
    { model: "gemini-3-pro-image-preview",                method: "generateContent", useImagen: false, supportsImages: true  },
    { model: "gemini-3.1-flash-image",                    method: "generateContent", useImagen: false, supportsImages: true  },
    { model: "gemini-3.1-flash-image-preview",            method: "generateContent", useImagen: false, supportsImages: true  },
    { model: "gemini-2.0-flash-preview-image-generation", method: "generateContent", useImagen: false, supportsImages: true  },
    { model: "gemini-2.5-flash-image",                    method: "generateContent", useImagen: false, supportsImages: true  },
    // Imagen 4 — solo texto, último recurso
    { model: "imagen-4.0-generate-001",                   method: "predict",         useImagen: true,  supportsImages: false },
    { model: "imagen-4.0-ultra-generate-001",             method: "predict",         useImagen: true,  supportsImages: false },
    { model: "imagen-4.0-fast-generate-001",              method: "predict",         useImagen: true,  supportsImages: false },
  ];

  // Prioriza el último modelo que funcionó (si lo hay) para no recorrer 404s.
  const ordered = cachedWorkingModel
    ? [...CANDIDATES].sort((a, b) =>
        a.model === cachedWorkingModel ? -1 : b.model === cachedWorkingModel ? 1 : 0)
    : CANDIDATES;

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 45000);

  try {
    for (const { model, method, useImagen, supportsImages } of ordered) {
      let bodyObj: unknown;

      if (useImagen) {
        // Imagen 3: solo acepta texto como prompt
        bodyObj = {
          instances:  [{ prompt: promptText }],
          parameters: { sampleCount: 1, aspectRatio: "3:4", personGeneration: "allow_adult" },
        };
      } else if (supportsImages && refImages.length > 0) {
        // Gemini multimodal: prompt + imágenes de referencia inline.
        // TEXT+IMAGE permite que el modelo razone antes de generar,
        // lo que mejora la fidelidad al sujeto de referencia.
        const parts: object[] = [
          { text: promptFull },
          ...refImages.map((img) => ({
            inline_data: { mime_type: img.mime, data: img.b64 },
          })),
        ];
        bodyObj = {
          contents:         [{ parts }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
        };
      } else {
        // Gemini sin imágenes
        bodyObj = {
          contents:         [{ parts: [{ text: promptText }] }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
        };
      }

      const res = await geminiPost(`/models/${model}:${method}`, bodyObj, { signal: controller.signal });

      if (res.status === 404) {
        logger.info(`[generar-imagen] modelo no disponible: ${model}`, { endpoint: "looks/generar-imagen" });
        continue;
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        logger.warn(`[generar-imagen] modelo ${model} error ${res.status}`, { endpoint: "looks/generar-imagen", status: res.status });
        continue;
      }

      const json = await res.json();

      // Formato Imagen (predictions[])
      if (useImagen) {
        const b64 = json?.predictions?.[0]?.bytesBase64Encoded as string | undefined;
        if (b64) { cachedWorkingModel = model; return b64; }
        logger.warn(`[generar-imagen] modelo ${model} (Imagen) sin imagen en respuesta`, { endpoint: "looks/generar-imagen" });
        continue;
      }

      // Formato Gemini generateContent (parts[].inlineData)
      const parts: { inlineData?: { data: string } }[] =
        json?.candidates?.[0]?.content?.parts ?? [];
      const b64 = parts.find((p) => p.inlineData?.data)?.inlineData?.data;
      if (b64) { cachedWorkingModel = model; return b64; }

      logger.warn(`[generar-imagen] modelo ${model} sin imagen en respuesta`, { endpoint: "looks/generar-imagen" });
      continue;
    }

    const available = await listImageModels();
    logger.error("[generar-imagen] Ningún modelo disponible", { endpoint: "looks/generar-imagen", available });
    throw new Error("no_image_model_available");

  } finally {
    clearTimeout(timeoutId);
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_session" }, { status: 401 });

  if (!hasGeminiApiKey()) {
    return NextResponse.json(
      { error: "ai_no_config", message: "Servicio de generación de imágenes no disponible." },
      { status: 503 },
    );
  }

  let body: GenerarImagenRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { look_id, prendas: prendasIds, escenario = "", ocasion = "" } = body;
  if (!look_id && (!prendasIds || prendasIds.length === 0)) {
    return NextResponse.json({ error: "look_id_o_prendas_requerido" }, { status: 400 });
  }

  // ── 1. Resolver ocasión desde el look guardado (si existe) ───────────────
  let ocasionFromLook = "";
  if (look_id) {
    const { data: look, error: lookErr } = await supabase
      .from("looks")
      .select("id, parametros_generacion")
      .eq("id", look_id)
      .eq("user_id", user.id)
      .single();

    if (lookErr || !look) {
      return NextResponse.json({ error: "look_not_found" }, { status: 404 });
    }

    const params = look.parametros_generacion as Record<string, unknown>;
    ocasionFromLook = (params?.ocasion as string) || "";
  }

  // ── 2. Datos corporales del perfil ────────────────────────────────────────
  const { data: profile } = await supabase
    .from("profiles")
    .select("genero, altura_cm, peso_kg, body_photo_url")
    .eq("id", user.id)
    .single();

  if (!profile?.body_photo_url || !profile?.altura_cm || !profile?.peso_kg) {
    return NextResponse.json(
      { error: "perfil_incompleto", message: "Completá tu foto y datos corporales en el perfil para usar esta función." },
      { status: 422 },
    );
  }

  // ── 3. Rate limiting (H-01/H-03) ──────────────────────────────────────────
  // Cuenta vía service role (los INSERT de ai_usage también son service role,
  // antes fallaban en silencio por RLS → el límite nunca se aplicaba).
  const rl = await checkAiRateLimit(user.id, "generacion_imagen");
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error:       "rate_limit",
        retry_after: rl.retryAfter,
        message:     `Alcanzaste el límite de ${DAILY_LIMIT} imágenes por día. Volvé mañana.`,
      },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  // ── 4. Obtener foto de referencia corporal ────────────────────────────────
  const { data: signedUrlData, error: signedErr } = await supabase.storage
    .from(BUCKET_BODY_PHOTOS)
    .createSignedUrl(profile.body_photo_url, 600);

  if (signedErr || !signedUrlData?.signedUrl) {
    return NextResponse.json({ error: "body_photo_unavailable" }, { status: 500 });
  }

  const bodyPhotoRef = await fetchImageAsB64(signedUrlData.signedUrl, 8000);
  if (!bodyPhotoRef) {
    return NextResponse.json({ error: "body_photo_fetch_error" }, { status: 500 });
  }

  // ── 5. Obtener prendas con imagen_url ─────────────────────────────────────
  type PrendaInfo = { nombre: string; categoria: string; color: string; estilos: string[]; imagen_url: string | null };

  let prendasInfo: PrendaInfo[] = [];

  if (look_id) {
    const { data: lookPrendas, error: lookPrendasError } = await supabase
      .from("look_prendas")
      .select("prenda_id, prendas(nombre, color_principal, estilos, imagen_url)")
      .eq("look_id", look_id)
      .eq("prenda_eliminada", false);

    if (lookPrendasError) {
      logger.error("[generar-imagen] Error querying look_prendas", { endpoint: "looks/generar-imagen" }, lookPrendasError instanceof Error ? lookPrendasError : undefined);
    }

    type RawLookPrenda = {
      prendas: { nombre: string; color_principal: string | null; estilos: string[]; imagen_url: string | null } | null;
    };

    prendasInfo = (lookPrendas ?? []).map((lp) => {
      const p = (lp as unknown as RawLookPrenda).prendas;
      return {
        nombre:     p?.nombre          ?? "prenda",
        categoria:  "ropa",
        color:      p?.color_principal ?? "neutro",
        estilos:    p?.estilos         ?? [],
        imagen_url: p?.imagen_url      ?? null,
      };
    });
  } else {
    const { data: rawPrendas, error: rawErr } = await supabase
      .from("prendas")
      .select("nombre, color_principal, estilos, imagen_url")
      .in("id", prendasIds!)
      .eq("user_id", user.id);

    if (rawErr) {
      logger.error("[generar-imagen] Error querying prendas", { endpoint: "looks/generar-imagen" }, rawErr instanceof Error ? rawErr : undefined);
    }

    prendasInfo = (rawPrendas ?? []).map((p) => ({
      nombre:     p.nombre          ?? "prenda",
      categoria:  "ropa",
      color:      p.color_principal ?? "neutro",
      estilos:    (p.estilos as string[]) ?? [],
      imagen_url: p.imagen_url      ?? null,
    }));
  }

  // ── 6. Descargar imágenes de prendas en base64 (máx MAX_PRENDA_IMAGES) ────
  const prendasConImagen = prendasInfo
    .filter((p) => p.imagen_url)
    .slice(0, MAX_PRENDA_IMAGES);

  const prendasImagePaths = prendasConImagen.map((p) => p.imagen_url as string);

  const prendasSignedUrls: Record<string, string> = {};
  if (prendasImagePaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from("prendas")
      .createSignedUrls(prendasImagePaths, 300);
    if (signed) {
      for (const s of signed) {
        if (s.path && s.signedUrl) prendasSignedUrls[s.path] = s.signedUrl;
      }
    }
  }

  // ── 6b. Paralelizar: descargar imágenes de prendas + descripción física ────
  // Ambas operaciones solo dependen de bodyPhotoRef (ya disponible), así que
  // corren en paralelo para ahorrar ~10s de latencia total.
  const [prendasB64Results, appearance] = await Promise.all([
    Promise.all(
      prendasConImagen.map((p) => {
        const url = prendasSignedUrls[p.imagen_url as string];
        return url ? fetchImageAsB64(url, 5000) : Promise.resolve(null);
      }),
    ),
    getPhysicalDescription(bodyPhotoRef.b64, bodyPhotoRef.mime),
  ]);

  // ── 7. Construir imágenes de referencia y prompts ─────────────────────────
  // refImages[0] = foto corporal, refImages[1..N] = fotos de prendas
  const refImages: RefImage[] = [bodyPhotoRef];
  for (const b64 of prendasB64Results) {
    if (b64) refImages.push(b64);
  }

  const alturaStr    = `${profile.altura_cm}cm`;
  const pesoStr      = `${profile.peso_kg}kg`;
  const genero       = profile.genero ?? "person";
  const ocasionFinal = ocasion || ocasionFromLook || "casual";

  const numPrendasImages = refImages.length - 1; // excluye la foto corporal

  const promptFull = buildPromptWithImages({
    genero,
    alturaStr,
    appearance,
    prendas:          prendasInfo,
    escenario,
    ocasion:          ocasionFinal,
    numPrendasImages,
  });

  const promptText = buildTextOnlyPrompt({
    genero,
    alturaStr,
    pesoStr,
    appearance,
    prendas:    prendasInfo,
    escenario,
    ocasion:    ocasionFinal,
  });

  logger.info("[generar-imagen] ref_images", {
    endpoint:      "looks/generar-imagen",
    total:         refImages.length,
    tiene_cuerpo:  true,
    prendas_imgs:  numPrendasImages,
    prendas_total: prendasInfo.length,
  });

  // ── 8. Generar imagen ─────────────────────────────────────────────────────
  let imagenB64: string;
  try {
    imagenB64 = await callGeminiImageGen({
      promptText,
      promptFull,
      refImages,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("[generar-imagen] Google Imagen error", { endpoint: "looks/generar-imagen" });
    return NextResponse.json(
      { error: "ai_error", message: "No pudimos generar la imagen. Intentá de nuevo." },
      { status: 502 },
    );
  }

  // ── 9. Subir imagen a Storage ─────────────────────────────────────────────
  const path = `${user.id}/${look_id ?? "temp"}/vestir_${Date.now()}.jpg`;
  const imgBuffer = Buffer.from(imagenB64, "base64");

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET_LOOK_IMAGES)
    .upload(path, imgBuffer, {
      contentType: "image/jpeg",
      upsert:      true,
    });

  if (uploadErr) {
    logger.error("[generar-imagen] Storage upload error", { endpoint: "looks/generar-imagen" }, uploadErr instanceof Error ? uploadErr : undefined);
    return NextResponse.json({ error: "storage_error" }, { status: 500 });
  }

  // ── 10. Generar signed URL para el cliente (1h) ───────────────────────────
  const { data: resultUrl } = await supabase.storage
    .from(BUCKET_LOOK_IMAGES)
    .createSignedUrl(path, 3600);

  if (!resultUrl?.signedUrl) {
    return NextResponse.json({ error: "signed_url_error" }, { status: 500 });
  }

  // ── 11. Registrar en ai_usage (service role — H-01) ───────────────────────
  await recordAiUsage(user.id, "generacion_imagen");

  const userHash = hashUserId(user.id);
  logger.info("[generar-imagen] ok", { endpoint: "looks/generar-imagen", user_hash: userHash, look_id: look_id ?? "none", path });

  return NextResponse.json<GenerarImagenResponse>({
    imagen_url: resultUrl.signedUrl,
    path,
  });
}
