/**
 * lib/posthog/client.ts — PostHog cliente (browser)
 *
 * Exporta la instancia de posthog-js y un helper para hashear el userId.
 * La instancia NO se inicializa aquí — eso lo hace PosthogProvider.
 *
 * Uso en componentes cliente:
 *   import posthog from "@/lib/posthog/client";
 *   posthog.capture("look_regenerado", { modo: "desde_cero" });
 */

import posthog from "posthog-js";
export default posthog;

/**
 * Hashea el userId en el cliente usando SubtleCrypto (Web Crypto API).
 * Resultado idéntico al SHA-256 del servidor para poder unificar journeys.
 */
export async function hashUserIdClient(userId: string): Promise<string> {
  const encoder = new TextEncoder();
  const data    = encoder.encode(userId);
  const hashBuf = await crypto.subtle.digest("SHA-256", data);
  const hashArr = Array.from(new Uint8Array(hashBuf));
  return hashArr.map((b) => b.toString(16).padStart(2, "0")).join("");
}
