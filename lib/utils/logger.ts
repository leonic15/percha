/**
 * PERCHA-030: Logger utilitario para API Routes y Server Components.
 *
 * - Producción: formato JSON estructurado (compatible con Vercel Log Drains)
 * - Desarrollo: formato legible en consola con colores
 * - Nivel "error": también llama a Sentry.captureException / captureMessage
 *
 * Campos estándar de cada log:
 *   timestamp, level, message, requestId?, userId? (SHA-256), endpoint?, duration_ms?
 *
 * IMPORTANTE: userId siempre llega ya hasheado (SHA-256). Nunca loguear el UUID real.
 */

type LogLevel = "info" | "warn" | "error" | "debug";

export interface LogContext {
  requestId?: string;
  /** SHA-256 del UUID de Supabase. Nunca el UUID real. */
  userId?: string;
  endpoint?: string;
  duration_ms?: number;
  [key: string]: unknown;
}

// ── Core log function ────────────────────────────────────────────────────────

function log(level: LogLevel, message: string, context?: LogContext) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };

  if (process.env.NODE_ENV === "production") {
    // JSON estructurado → Vercel Log Drains / stdout
    console[level === "debug" ? "log" : level](JSON.stringify(entry));
  } else {
    // Formato legible en dev
    const prefix = `[${level.toUpperCase()}]`;
    const ctx = context ? ` ${JSON.stringify(context)}` : "";
    console[level === "debug" ? "log" : level](`${prefix} ${message}${ctx}`);
  }
}

// ── Sentry integration (solo en server-side, lazy import para no romper edge) ─

async function reportToSentry(
  level: "error" | "warn",
  message: string,
  context?: LogContext,
  error?: unknown
) {
  // Solo en producción y solo en el runtime Node.js (no edge, no browser)
  if (process.env.NODE_ENV !== "production") return;
  if (typeof window !== "undefined") return;

  // Sentry usa "warning" en lugar de "warn"
  const sentryLevel = level === "warn" ? "warning" : "error";

  try {
    const Sentry = await import("@sentry/nextjs");

    if (error instanceof Error) {
      Sentry.captureException(error, {
        level: sentryLevel,
        tags: {
          endpoint: context?.endpoint,
          requestId: context?.requestId,
        },
        extra: context,
      });
    } else {
      Sentry.captureMessage(message, {
        level: sentryLevel,
        tags: {
          endpoint: context?.endpoint,
        },
        extra: context,
      });
    }
  } catch {
    // No dejar que Sentry rompa el logger
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export const logger = {
  info: (message: string, context?: LogContext) =>
    log("info", message, context),

  warn: (message: string, context?: LogContext) => {
    log("warn", message, context);
    // Warnings también van a Sentry (sin error object)
    void reportToSentry("warn", message, context);
  },

  /**
   * Loguea un error y lo reporta a Sentry.
   * @param error — instancia de Error para stack trace en Sentry (opcional)
   */
  error: (message: string, context?: LogContext, error?: unknown) => {
    log("error", message, context);
    void reportToSentry("error", message, context, error);
  },

  debug: (message: string, context?: LogContext) =>
    log("debug", message, context),
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Hashea un userId con SHA-256 para logs y analytics (PERCHA-030, PERCHA-031).
 * Solo llamar desde server-side (API Routes, Server Components).
 * Retorna los primeros 16 chars del hash (suficiente para correlación, más corto en logs).
 */
export async function hashUserId(userId: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(userId);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16); // 64 bits de entropía — suficiente para correlación en logs
}

/**
 * Genera un requestId único para correlacionar logs de una misma request.
 * Formato: req_<8 chars hex aleatorios>
 */
export function generateRequestId(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return `req_${Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}
