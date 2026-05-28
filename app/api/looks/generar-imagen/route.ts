import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createHash } from "crypto";

/**
 * POST /api/looks/generar-imagen — LOOKSI-035
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

const BUCKET_LOOK_IMAGES = "look-images";
const BUCKET_BODY_PHOTOS  = "body-photos";
const DAILY_LIMIT         = 3;
const MAX_PRENDA_IMAGES   = 4; // máximo de fotos de prendas a incluir como referencia

// ── Tipos ──────────────────────────────────────────────────────────────────────

export interface GenerarImagenRequest {
  look_id:  string;
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
async function getPhysicalDescription(apiKey: string, imageB64: string, imageMime: string): Promise<string> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        signal:  AbortSignal.timeout(10000),
        body: JSON.stringify({
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
        }),
      },
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
async function listImageModels(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=200`,
      { signal: AbortSignal.timeout(5000) },
    );
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
  apiKey:     string;
  promptText: string;      // fallback texto puro (para Imagen 3)
  promptFull: string;      // prompt con instrucciones de referencia (para Gemini con imágenes)
  refImages:  RefImage[];  // [foto_cuerpo, prenda_1, ..., prenda_N]
}): Promise<string> {
  const { apiKey, promptText, promptFull, refImages } = opts;

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

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 60000);

  try {
    for (const { model, method, useImagen, supportsImages } of CANDIDATES) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${method}?key=${apiKey}`;

      let body: string;

      if (useImagen) {
        // Imagen 3: solo acepta texto como prompt
        body = JSON.stringify({
          instances:  [{ prompt: promptText }],
          parameters: { sampleCount: 1, aspectRatio: "3:4", personGeneration: "allow_adult" },
        });
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
        body = JSON.stringify({
          contents:         [{ parts }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
        });
      } else {
        // Gemini sin imágenes
        body = JSON.stringify({
          contents:         [{ parts: [{ text: promptText }] }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
        });
      }

      const res = await fetch(url, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        signal:  controller.signal,
        body,
      });

      if (res.status === 404) {
        console.info(`[generar-imagen] modelo no disponible: ${model}`);
        continue;
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`gemini_imagen_http_${res.status}: ${errText.slice(0, 200)}`);
      }

      const json = await res.json();

      // Formato Imagen (predictions[])
      if (useImagen) {
        const b64 = json?.predictions?.[0]?.bytesBase64Encoded as string | undefined;
        if (b64) return b64;
      }

      // Formato Gemini generateContent (parts[].inlineData)
      const parts: { inlineData?: { data: string } }[] =
        json?.candidates?.[0]?.content?.parts ?? [];
      const b64 = parts.find((p) => p.inlineData?.data)?.inlineData?.data;
      if (b64) return b64;

      throw new Error("gemini_imagen_empty_response");
    }

    const available = await listImageModels(apiKey);
    console.error("[generar-imagen] Ningún modelo disponible. Modelos de imagen en esta key:", available);
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

  const apiKey = process.env.GOOGLE_VERTEX_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!apiKey) {
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

  const { look_id, escenario = "", ocasion = "" } = body;
  if (!look_id) {
    return NextResponse.json({ error: "look_id_requerido" }, { status: 400 });
  }

  // ── 1. Verificar que el look pertenece al usuario ─────────────────────────
  const { data: look, error: lookErr } = await supabase
    .from("looks")
    .select("id, nombre, parametros_generacion")
    .eq("id", look_id)
    .eq("user_id", user.id)
    .single();

  if (lookErr || !look) {
    return NextResponse.json({ error: "look_not_found" }, { status: 404 });
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

  // ── 3. Rate limiting (máx DAILY_LIMIT por día) ────────────────────────────
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { count: usosHoy } = await supabase
    .from("ai_usage")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("tipo", "generacion_imagen" as never)
    .gte("created_at", todayStart.toISOString());

  if ((usosHoy ?? 0) >= DAILY_LIMIT) {
    return NextResponse.json(
      { error: "rate_limit", message: `Alcanzaste el límite de ${DAILY_LIMIT} imágenes por día. Volvé mañana.` },
      { status: 429 },
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

  // ── 5. Obtener prendas del look con imagen_url ─────────────────────────────
  const { data: lookPrendas, error: lookPrendasError } = await supabase
    .from("look_prendas")
    .select("prenda_id, prendas(nombre, color_principal, estilos, imagen_url)")
    .eq("look_id", look_id)
    .eq("prenda_eliminada", false);

  if (lookPrendasError) {
    console.error("[generar-imagen] Error querying look_prendas:", lookPrendasError);
  }

  type RawLookPrenda = {
    prendas: {
      nombre:          string;
      color_principal: string | null;
      estilos:         string[];
      imagen_url:      string | null;
    } | null;
  };

  const prendasInfo = (lookPrendas ?? []).map((lp) => {
    const p = (lp as unknown as RawLookPrenda).prendas;
    return {
      nombre:     p?.nombre          ?? "prenda",
      categoria:  "ropa",
      color:      p?.color_principal ?? "neutro",
      estilos:    p?.estilos         ?? [],
      imagen_url: p?.imagen_url      ?? null,
    };
  });

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

  const prendasB64Results = await Promise.all(
    prendasConImagen.map((p) => {
      const url = prendasSignedUrls[p.imagen_url as string];
      return url ? fetchImageAsB64(url, 5000) : Promise.resolve(null);
    }),
  );

  // ── 7. Construir imágenes de referencia y prompts ─────────────────────────
  // refImages[0] = foto corporal, refImages[1..N] = fotos de prendas
  const refImages: RefImage[] = [bodyPhotoRef];
  for (const b64 of prendasB64Results) {
    if (b64) refImages.push(b64);
  }

  const alturaStr = `${profile.altura_cm}cm`;
  const pesoStr   = `${profile.peso_kg}kg`;
  const genero    = profile.genero ?? "person";
  const params    = look.parametros_generacion as Record<string, unknown>;
  const ocasionFinal = ocasion || (params?.ocasion as string) || "casual";

  const numPrendasImages = refImages.length - 1; // excluye la foto corporal

  // Descripción textual detallada — refuerza identidad en prompt multimodal
  // y es el único recurso cuando caemos a Imagen 4 (solo texto)
  const appearance = await getPhysicalDescription(apiKey, bodyPhotoRef.b64, bodyPhotoRef.mime);

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

  console.info("[generar-imagen] ref_images", {
    total:         refImages.length,
    tiene_cuerpo:  true,
    prendas_imgs:  numPrendasImages,
    prendas_total: prendasInfo.length,
  });

  // ── 8. Generar imagen ─────────────────────────────────────────────────────
  let imagenB64: string;
  try {
    imagenB64 = await callGeminiImageGen({
      apiKey,
      promptText,
      promptFull,
      refImages,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[generar-imagen] Google Imagen error:", msg);
    return NextResponse.json(
      { error: "ai_error", message: "No pudimos generar la imagen. Intentá de nuevo." },
      { status: 502 },
    );
  }

  // ── 9. Subir imagen a Storage ─────────────────────────────────────────────
  const path = `${user.id}/${look_id}/vestir_${Date.now()}.jpg`;
  const imgBuffer = Buffer.from(imagenB64, "base64");

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET_LOOK_IMAGES)
    .upload(path, imgBuffer, {
      contentType: "image/jpeg",
      upsert:      true,
    });

  if (uploadErr) {
    console.error("[generar-imagen] Storage upload error:", uploadErr);
    return NextResponse.json({ error: "storage_error" }, { status: 500 });
  }

  // ── 10. Generar signed URL para el cliente (1h) ───────────────────────────
  const { data: resultUrl } = await supabase.storage
    .from(BUCKET_LOOK_IMAGES)
    .createSignedUrl(path, 3600);

  if (!resultUrl?.signedUrl) {
    return NextResponse.json({ error: "signed_url_error" }, { status: 500 });
  }

  // ── 11. Registrar en ai_usage ─────────────────────────────────────────────
  await supabase.from("ai_usage").insert({
    user_id: user.id,
    tipo:    "generacion_imagen" as never,
  });

  const userHash = hashUserId(user.id);
  console.info("[generar-imagen] ok", { user_hash: userHash, look_id, path });

  return NextResponse.json<GenerarImagenResponse>({
    imagen_url: resultUrl.signedUrl,
    path,
  });
}
