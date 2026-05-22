/**
 * Logger utilitario para API Routes (LOOKSI-030).
 * - Producción: formato JSON estructurado
 * - Desarrollo: formato legible en consola
 *
 * userId se recibe ya hasheado (SHA-256) — nunca loguear el UUID real.
 */

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogContext {
  requestId?: string;
  userId?: string; // Siempre hasheado con SHA-256
  endpoint?: string;
  duration_ms?: number;
  [key: string]: unknown;
}

function log(level: LogLevel, message: string, context?: LogContext) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };

  if (process.env.NODE_ENV === "production") {
    console[level === "debug" ? "log" : level](JSON.stringify(entry));
  } else {
    const prefix = `[${level.toUpperCase()}]`;
    const ctx = context ? ` ${JSON.stringify(context)}` : "";
    console[level === "debug" ? "log" : level](`${prefix} ${message}${ctx}`);
  }
}

export const logger = {
  info: (message: string, context?: LogContext) => log("info", message, context),
  warn: (message: string, context?: LogContext) => log("warn", message, context),
  error: (message: string, context?: LogContext) => log("error", message, context),
  debug: (message: string, context?: LogContext) => log("debug", message, context),
};

/**
 * Hashea un userId con SHA-256 para logs y analytics.
 * Usar en server-side únicamente.
 */
export async function hashUserId(userId: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(userId);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
