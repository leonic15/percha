/**
 * LOOKSI-030: Configuración de Sentry para el servidor (Node.js).
 *
 * Importado desde instrumentation.ts en el runtime 'nodejs'.
 * Captura errores de API Routes, Server Components y Server Actions.
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  sampleRate: 1.0,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
  enabled: process.env.NODE_ENV === "production",

  // ── PII scrubbing ──────────────────────────────────────────────────────────
  beforeSend(event) {
    // No capturar el body de requests (puede contener imágenes, datos personales)
    if (event.request) {
      delete event.request.data;
      delete event.request.cookies;
      if (event.request.headers) {
        const safeHeaders: Record<string, string> = {};
        for (const [key, value] of Object.entries(event.request.headers)) {
          if (!["authorization", "cookie", "set-cookie", "x-api-key"].includes(key.toLowerCase())) {
            safeHeaders[key] = value as string;
          }
        }
        event.request.headers = safeHeaders;
      }
    }
    return event;
  },

  // ── Errores esperados que no deben generar alertas ─────────────────────────
  ignoreErrors: [
    "NEXT_NOT_FOUND",
    "NEXT_REDIRECT",
    "NetworkError",
    "AbortError",
  ],
});
