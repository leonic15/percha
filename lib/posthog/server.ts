/**
 * lib/posthog/server.ts — PostHog server-side (Node.js / API Routes)
 *
 * Usa posthog-node para capturar eventos desde las API Routes.
 * El userId SIEMPRE se hashea con SHA-256 antes de enviarse (nunca el UUID real).
 *
 * Uso:
 *   import { captureServerEvent } from "@/lib/posthog/server";
 *   await captureServerEvent(user.id, "prenda_agregada", { categoria: "tops", con_ia: true });
 *
 * NOTA: En entorno de test/ci, se puede setear POSTHOG_DISABLED=true para no enviar eventos.
 */

import { PostHog } from "posthog-node";
import { createHash } from "crypto";

// ── Singleton del cliente Node ────────────────────────────────────────────────

let _client: PostHog | null = null;

function getClient(): PostHog | null {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host   = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com";

  if (!apiKey || process.env.POSTHOG_DISABLED === "true") return null;

  if (!_client) {
    _client = new PostHog(apiKey, {
      host,
      // En server-side siempre flush inmediato (no hay proceso largo que espere)
      flushAt:       1,
      flushInterval: 0,
    });
  }
  return _client;
}

// ── Hash del userId ───────────────────────────────────────────────────────────

/**
 * Hashea el userId con SHA-256.
 * El mismo hash se usa en cliente y servidor para poder unificar journeys en PostHog.
 */
export function hashUserId(userId: string): string {
  return createHash("sha256").update(userId).digest("hex");
}

// ── Captura de eventos ────────────────────────────────────────────────────────

/**
 * Captura un evento en PostHog desde una API Route.
 * @param userId  — UUID real del usuario (se hashea internamente, nunca expuesto)
 * @param event   — nombre del evento (snake_case)
 * @param props   — propiedades adicionales (sin PII)
 */
export async function captureServerEvent(
  userId: string,
  event:  string,
  props?: Record<string, unknown>
): Promise<void> {
  const client = getClient();
  if (!client) return;

  try {
    client.capture({
      distinctId: hashUserId(userId),
      event,
      properties: {
        $lib:    "posthog-node",
        source:  "server",
        ...(props ?? {}),
      },
    });
    // flush inmediato para no perder eventos en Vercel serverless (short-lived)
    await client.flush();
  } catch (err) {
    // Los errores de analytics nunca deben romper el flujo principal
    console.warn("[posthog/server] Error capturando evento:", err);
  }
}

/**
 * Cierra el cliente PostHog (necesario en tests o scripts).
 */
export async function shutdownPosthog(): Promise<void> {
  if (_client) {
    await _client.shutdown();
    _client = null;
  }
}
