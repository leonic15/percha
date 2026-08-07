import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkAiRateLimit, recordAiUsage, rateLimitResponse } from "@/lib/ai/usage";
import { JSON_IMAGE_MAX_BYTES, BASE64_IMAGE_MAX_CHARS } from "@/lib/upload/validation";
import { geminiGenerateContent, GEMINI_FLASH_LITE } from "@/lib/gemini/client";
import { logger } from "@/lib/utils/logger";

/**
 * POST /api/validar-imagen — PERCHA-036
 *
 * Valida con Gemini 2.5 Flash-Lite si una imagen es adecuada para el contexto indicado.
 * Body: { tipo: "prenda" | "foto_corporal", imagen: "<base64 data URL o base64 puro>" }
 * Responde: { valida, confianza, motivo, mensaje }
 *
 * - tipo "prenda":      válida si es una prenda de ropa visible
 * - tipo "foto_corporal": válida si es persona de cuerpo completo, de frente
 *
 * Lógica de decisión:
 *   prenda: es_prenda + conf ≥ 0.7 → ok | conf 0.4-0.69 → advertencia | else → error
 *   foto_corporal: hay_persona + cuerpo_completo + de_frente → ok
 *                  hay_persona + cuerpo_completo + fondo cargado → advertencia
 *                  sin persona → error | sin cuerpo_completo → error
 *
 * Fail-open: si el servicio falla (timeout, red) retorna { valida: true, motivo: "error_servicio" }
 * para no bloquear al usuario.
 */


const PROMPT_PRENDA = `Analiza esta imagen y determina si muestra una prenda de ropa o accesorio de moda (incluyendo ropa puesta en una persona, en percha, doblada o sobre fondo neutro).

Responde con un JSON estricto:
{
  "es_prenda": boolean,
  "confianza": number (0.0–1.0),
  "motivo": "prenda_visible" | "sin_prenda" | "imagen_ambigua"
}

No incluyas texto fuera del JSON.`;

const PROMPT_FOTO_CORPORAL = `Analiza esta imagen y determina si muestra una persona de cuerpo completo (de la cabeza hasta los pies) de frente, apta para generar imágenes de moda virtual.

Evalúa:
1. ¿Aparece al menos una persona? (true/false)
2. ¿Se ve el cuerpo completo de pies a cabeza? (true/false)
3. ¿La pose es aproximadamente de frente? (true/false)
4. ¿El fondo es claro/neutro o hay elementos que obstruyen la silueta? ("limpio" | "cargado")

Responde con un JSON estricto:
{
  "hay_persona": boolean,
  "cuerpo_completo": boolean,
  "de_frente": boolean,
  "fondo": "limpio" | "cargado",
  "confianza": number (0.0–1.0)
}

No incluyas texto fuera del JSON.`;

// ── Tipos ──────────────────────────────────────────────────────────────────────

export interface ValidarImagenRequest {
  tipo:   "prenda" | "foto_corporal";
  imagen: string; // base64 data URL ("data:image/...;base64,...") o base64 puro
}

export interface ValidarImagenResponse {
  valida:     boolean;
  confianza:  number;
  motivo:     "ok" | "sin_prenda" | "sin_persona" | "cuerpo_parcial" | "fondo_complejo" | "imagen_ambigua" | "error_servicio";
  mensaje:    string;
  advertencia?: boolean; // true = no bloqueante (puede continuar con aviso)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractBase64(imagen: string): { data: string; mimeType: string } {
  if (imagen.startsWith("data:")) {
    const [header, data] = imagen.split(",");
    const mimeMatch = header.match(/data:([^;]+);base64/);
    return {
      data:     data ?? "",
      mimeType: mimeMatch?.[1] ?? "image/jpeg",
    };
  }
  return { data: imagen, mimeType: "image/jpeg" };
}

async function callGemini(
  prompt: string,
  base64Data: string,
  mimeType: string,
): Promise<string> {
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await geminiGenerateContent(
      GEMINI_FLASH_LITE,
      {
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: base64Data } },
          ],
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 256 },
      },
      { signal: controller.signal },
    );

    if (!res.ok) throw new Error(`gemini_http_${res.status}`);
    const json = await res.json();
    return json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  } finally {
    clearTimeout(timeoutId);
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_session" }, { status: 401 });

  if (!process.env.GEMINI_API_KEY) {
    logger.error("[validar-imagen] GEMINI_API_KEY no configurada", { endpoint: "validar-imagen" });
    // Fail-open: no bloquear si no hay config
    return NextResponse.json<ValidarImagenResponse>({
      valida:    true,
      confianza: 1,
      motivo:    "error_servicio",
      mensaje:   "Servicio de validación no disponible.",
    });
  }

  // H-06: rechazar payloads grandes antes de parsear el body completo en memoria
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > JSON_IMAGE_MAX_BYTES) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }

  let body: ValidarImagenRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { tipo, imagen } = body;
  if (!tipo || !imagen) {
    return NextResponse.json({ error: "campos_requeridos" }, { status: 400 });
  }
  if (tipo !== "prenda" && tipo !== "foto_corporal") {
    return NextResponse.json({ error: "tipo_invalido" }, { status: 400 });
  }
  if (typeof imagen !== "string" || imagen.length > BASE64_IMAGE_MAX_CHARS) {
    return NextResponse.json(
      { error: "imagen_demasiado_grande", message: "La imagen supera el tamaño máximo permitido." },
      { status: 422 },
    );
  }

  // ── Rate limiting (H-03) ───────────────────────────────────────────────────
  const rl = await checkAiRateLimit(user.id, "validacion_imagen");
  if (!rl.allowed) return rateLimitResponse(rl.retryAfter);

  const { data: base64Data, mimeType } = extractBase64(imagen);
  const prompt = tipo === "prenda" ? PROMPT_PRENDA : PROMPT_FOTO_CORPORAL;

  let rawText: string;
  try {
    rawText = await callGemini(prompt, base64Data, mimeType);
    // Registrar uso para tracking + rate limit (service role — H-01)
    void recordAiUsage(user.id, "validacion_imagen");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Fail-open: no bloquear por error de red / timeout
    logger.error("[validar-imagen] Gemini error (fail-open)", { endpoint: "validar-imagen" }, err instanceof Error ? err : undefined);
    return NextResponse.json<ValidarImagenResponse>({
      valida:    true,
      confianza: 1,
      motivo:    "error_servicio",
      mensaje:   "No pudimos verificar la imagen. Podés continuar de todas formas.",
    });
  }

  // Extraer JSON del texto
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    logger.error("[validar-imagen] No JSON in Gemini response", { endpoint: "validar-imagen" });
    return NextResponse.json<ValidarImagenResponse>({
      valida:    true,
      confianza: 1,
      motivo:    "error_servicio",
      mensaje:   "No pudimos verificar la imagen. Podés continuar de todas formas.",
    });
  }

  try {
    if (tipo === "prenda") {
      const { es_prenda, confianza, motivo } = JSON.parse(jsonMatch[0]) as {
        es_prenda: boolean;
        confianza: number;
        motivo:    string;
      };

      // Log solo resultado (sin PII, sin imagen)
      logger.info("[validar-imagen] prenda", { endpoint: "validar-imagen", es_prenda, confianza, motivo });

      if (es_prenda && confianza >= 0.7) {
        return NextResponse.json<ValidarImagenResponse>({
          valida: true, confianza, motivo: "ok",
          mensaje: "",
        });
      }
      if (es_prenda && confianza >= 0.4) {
        return NextResponse.json<ValidarImagenResponse>({
          valida:      true,
          confianza,
          motivo:      "imagen_ambigua",
          mensaje:     "¿Seguro que esta imagen muestra una prenda? Si es así, podés continuar.",
          advertencia: true,
        });
      }
      return NextResponse.json<ValidarImagenResponse>({
        valida:    false,
        confianza: confianza ?? 0,
        motivo:    "sin_prenda",
        mensaje:   "Esta imagen no parece mostrar una prenda de ropa. Asegurate de fotografiar la prenda sola, en percha o puesta, sobre un fondo claro.",
      });

    } else {
      const { hay_persona, cuerpo_completo, de_frente, fondo, confianza } = JSON.parse(jsonMatch[0]) as {
        hay_persona:     boolean;
        cuerpo_completo: boolean;
        de_frente:       boolean;
        fondo:           "limpio" | "cargado";
        confianza:       number;
      };

      logger.info("[validar-imagen] foto_corporal", { endpoint: "validar-imagen", hay_persona, cuerpo_completo, de_frente, fondo, confianza });

      if (!hay_persona) {
        return NextResponse.json<ValidarImagenResponse>({
          valida:    false,
          confianza: confianza ?? 0,
          motivo:    "sin_persona",
          mensaje:   "Esta imagen no parece mostrar una persona. Usá una foto de cuerpo entero, de frente, para que podamos generar looks que te queden bien.",
        });
      }

      if (!cuerpo_completo) {
        return NextResponse.json<ValidarImagenResponse>({
          valida:    false,
          confianza: confianza ?? 0,
          motivo:    "cuerpo_parcial",
          mensaje:   "La foto debe mostrar tu cuerpo completo, de la cabeza a los pies.",
        });
      }

      if (hay_persona && cuerpo_completo && fondo === "cargado") {
        return NextResponse.json<ValidarImagenResponse>({
          valida:      true,
          confianza:   confianza ?? 0.5,
          motivo:      "fondo_complejo",
          mensaje:     "Tu foto tiene un fondo complejo. Podés continuar, pero los resultados de 'Vestir mi look' podrían ser menos precisos.",
          advertencia: true,
        });
      }

      return NextResponse.json<ValidarImagenResponse>({
        valida: true, confianza: confianza ?? 1, motivo: "ok",
        mensaje: "",
      });
    }
  } catch (err) {
    logger.error("[validar-imagen] JSON parse error", { endpoint: "validar-imagen" }, err instanceof Error ? err : undefined);
    return NextResponse.json<ValidarImagenResponse>({
      valida:    true,
      confianza: 1,
      motivo:    "error_servicio",
      mensaje:   "No pudimos verificar la imagen. Podés continuar de todas formas.",
    });
  }
}
