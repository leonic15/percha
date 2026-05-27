/**
 * LOOKSI-030: Configuración de Sentry para el cliente (browser).
 *
 * Este archivo es importado por instrumentation-client.ts antes de la
 * hidratación de React. Configura captura de errores, PII scrubbing
 * y filtros de errores conocidos no accionables.
 */

import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: SENTRY_DSN,

  // En producción capturamos el 100% de los errores (free tier: 5.000/mes).
  // Si el volumen sube, bajar a 0.5.
  sampleRate: 1.0,

  // Performance tracing: 10% de las navegaciones en producción
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,

  // No capturar errores en desarrollo local (demasiado ruido)
  enabled: process.env.NODE_ENV === "production",

  // ── PII scrubbing ──────────────────────────────────────────────────────────
  beforeSend(event, hint) {
    // Scrubear emails y nombres del request data
    if (event.request) {
      if (event.request.data) {
        event.request.data = scrubPII(event.request.data);
      }
      // No capturar cookies ni headers con tokens
      delete event.request.cookies;
      if (event.request.headers) {
        const safeHeaders: Record<string, string> = {};
        for (const [key, value] of Object.entries(event.request.headers)) {
          if (!["authorization", "cookie", "set-cookie"].includes(key.toLowerCase())) {
            safeHeaders[key] = value as string;
          }
        }
        event.request.headers = safeHeaders;
      }
    }

    // Filtrar errores de extensiones de browser (no son bugs de la app)
    const error = hint?.originalException;
    if (error instanceof Error) {
      if (isExtensionError(error) || isKnownNetworkError(error)) {
        return null; // descartar
      }
    }

    return event;
  },

  // ── Errores a ignorar completamente ────────────────────────────────────────
  ignoreErrors: [
    // Errores de red / conectividad
    "NetworkError",
    "Network request failed",
    "Failed to fetch",
    "Load failed",
    "The Internet connection appears to be offline",
    // Errores de extensiones de browser
    "Non-Error exception captured",
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
    // Errores de navegación de Next.js que no son bugs
    "NEXT_NOT_FOUND",
    "NEXT_REDIRECT",
    // AbortController cancels (e.g. el usuario navega mientras carga)
    "AbortError",
    "The user aborted a request",
  ],

  // ── Dominios a ignorar (extensiones de browser) ────────────────────────────
  denyUrls: [
    /extensions\//i,
    /^chrome:\/\//i,
    /^chrome-extension:\/\//i,
    /^moz-extension:\/\//i,
    /^safari-extension:\/\//i,
    /^safari-web-extension:\/\//i,
  ],
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function isExtensionError(error: Error): boolean {
  const stack = error.stack ?? "";
  return (
    stack.includes("chrome-extension://") ||
    stack.includes("moz-extension://") ||
    stack.includes("safari-extension://") ||
    stack.includes("safari-web-extension://")
  );
}

function isKnownNetworkError(error: Error): boolean {
  const msg = error.message?.toLowerCase() ?? "";
  return (
    msg.includes("network") ||
    msg.includes("failed to fetch") ||
    msg.includes("load failed") ||
    msg.includes("the internet connection")
  );
}

/**
 * Reemplaza valores que parecen emails o tokens en objetos planos.
 * Solo aplica a strings; no procesa objetos anidados complejos.
 */
function scrubPII(data: unknown): unknown {
  if (typeof data === "string") {
    // Reemplazar emails
    return data.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[email]");
  }
  if (data && typeof data === "object") {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      const k = key.toLowerCase();
      if (["email", "password", "token", "access_token", "refresh_token", "apikey", "api_key"].includes(k)) {
        cleaned[key] = "[redacted]";
      } else {
        cleaned[key] = scrubPII(value);
      }
    }
    return cleaned;
  }
  return data;
}
