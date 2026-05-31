/**
 * lib/ai/usage.ts — Registro de uso de IA y rate limiting por usuario.
 *
 * Auditoría:
 *  - H-01: los INSERT en `ai_usage` deben hacerse con service role (RLS sin
 *          política de INSERT para usuarios). `recordAiUsage` lo centraliza.
 *  - H-03: rate limiting por usuario sobre los endpoints de IA, contando filas
 *          recientes de `ai_usage` por (user_id, tipo). Sin infra externa.
 *
 * El chequeo se hace ANTES de llamar a la IA (cuenta el uso previo); el insert
 * posterior alimenta la ventana para las próximas requests. Es un límite por
 * ventana deslizante aproximado — suficiente para frenar bucles de abuso.
 */

import { createServiceClient } from "@/lib/supabase/server";
import type { AiUsageTipo } from "@/lib/database.types";

interface Ventana {
  max:        number;
  windowSec:  number;
}

// Límites por tipo. Cada tipo puede tener varias ventanas (p. ej. por minuto y
// por día). La generación de imagen es la más cara → tope diario estricto.
const LIMITS: Record<AiUsageTipo, Ventana[]> = {
  analisis_prenda:   [{ max: 15, windowSec: 60 }, { max: 200, windowSec: 86_400 }],
  generacion_look:   [{ max: 10, windowSec: 60 }, { max: 120, windowSec: 86_400 }],
  generacion_viaje:  [{ max: 5,  windowSec: 60 }, { max: 40,  windowSec: 86_400 }],
  cambio_prenda:     [{ max: 15, windowSec: 60 }, { max: 200, windowSec: 86_400 }],
  generacion_imagen: [{ max: 5,  windowSec: 86_400 }],
  validacion_imagen: [{ max: 30, windowSec: 60 }, { max: 300, windowSec: 86_400 }],
};

export interface RateLimitResult {
  allowed:    boolean;
  retryAfter: number; // segundos sugeridos para reintentar
}

/**
 * Verifica si el usuario está dentro de los límites configurados para `tipo`.
 * Fail-open: si el limiter falla (error de infra), NO bloquea al usuario.
 */
export async function checkAiRateLimit(
  userId: string,
  tipo:   AiUsageTipo,
): Promise<RateLimitResult> {
  const svc = createServiceClient();

  for (const { max, windowSec } of LIMITS[tipo]) {
    const since = new Date(Date.now() - windowSec * 1000).toISOString();
    const { count, error } = await svc
      .from("ai_usage")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("tipo", tipo)
      .gte("created_at", since);

    if (error) {
      console.error("[ai/usage] rate-limit count error:", error.message);
      return { allowed: true, retryAfter: 0 }; // fail-open
    }
    if ((count ?? 0) >= max) {
      return { allowed: false, retryAfter: windowSec };
    }
  }

  return { allowed: true, retryAfter: 0 };
}

/**
 * Registra una fila en `ai_usage` usando service role (bypasea RLS).
 * Nunca lanza: un fallo de tracking no debe romper el flujo principal.
 */
export async function recordAiUsage(
  userId: string,
  tipo:   AiUsageTipo,
  data?:  { tokens?: number | null; costo?: number | null },
): Promise<void> {
  try {
    const svc = createServiceClient();
    const { error } = await svc.from("ai_usage").insert({
      user_id:        userId,
      tipo,
      tokens_usados:  data?.tokens ?? null,
      costo_estimado: data?.costo ?? null,
    });
    if (error) console.error("[ai/usage] insert error:", error.message);
  } catch (err) {
    console.error("[ai/usage] insert exception:", err);
  }
}

/** Respuesta 429 estándar para rate limit. */
export function rateLimitResponse(retryAfter: number) {
  return Response.json(
    { error: "rate_limit", retry_after: retryAfter, message: "Demasiadas solicitudes. Probá de nuevo en un rato." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}
