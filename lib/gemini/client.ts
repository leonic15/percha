/**
 * Cliente centralizado para la API de Gemini.
 * Usa x-goog-api-key en header en lugar de ?key= en query string (H-11).
 */

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

export const GEMINI_FLASH_LITE = "gemini-2.5-flash-lite";

function getApiKey(): string {
  const key = process.env.GOOGLE_VERTEX_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not configured");
  return key;
}

/** True si hay al menos una API key de Gemini configurada. */
export function hasGeminiApiKey(): boolean {
  return !!(process.env.GOOGLE_VERTEX_API_KEY ?? process.env.GEMINI_API_KEY);
}

/**
 * POST a un endpoint de Gemini.
 * @param path  Path relativo a v1beta, ej. "/models/gemini-2.5-flash-lite:generateContent"
 * @param body  Payload JSON
 * @param options.signal  AbortSignal opcional para timeout
 */
export function geminiPost(
  path: string,
  body: unknown,
  options?: { signal?: AbortSignal },
): Promise<Response> {
  return fetch(`${GEMINI_BASE}${path}`, {
    method:  "POST",
    headers: {
      "Content-Type":    "application/json",
      "x-goog-api-key":  getApiKey(),
    },
    body:   JSON.stringify(body),
    signal: options?.signal,
  });
}

/**
 * GET a un endpoint de Gemini.
 * @param path  Path relativo a v1beta (incluyendo query params si los hay), ej. "/models?pageSize=200"
 */
export function geminiGet(
  path: string,
  options?: { signal?: AbortSignal },
): Promise<Response> {
  return fetch(`${GEMINI_BASE}${path}`, {
    headers: { "x-goog-api-key": getApiKey() },
    signal:  options?.signal,
  });
}

/** Atajo para el endpoint generateContent. */
export function geminiGenerateContent(
  model: string,
  body: unknown,
  options?: { signal?: AbortSignal },
): Promise<Response> {
  return geminiPost(`/models/${model}:generateContent`, body, options);
}
