/**
 * LOOKSI-030: Configuración de Sentry para el Edge runtime.
 *
 * Importado desde instrumentation.ts en el runtime 'edge'.
 * Captura errores del middleware (proxy.ts) y Edge API Routes.
 * El Edge runtime tiene APIs limitadas: no Node.js, no file system.
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  sampleRate: 1.0,
  tracesSampleRate: 0, // Sin tracing en edge (overhead mínimo)
  enabled: process.env.NODE_ENV === "production",

  ignoreErrors: [
    "NEXT_NOT_FOUND",
    "NEXT_REDIRECT",
    "NetworkError",
    "AbortError",
  ],
});
