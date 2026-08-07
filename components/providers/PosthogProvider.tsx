"use client";

/**
 * components/providers/PosthogProvider.tsx
 *
 * Inicializa PostHog en el cliente con las siguientes reglas:
 * - Respeta Do Not Track del navegador (navigator.doNotTrack === "1")
 * - Identifica al usuario con SHA-256 hash de su userId (nunca email ni UUID real)
 * - Captura pageviews automáticamente con el router de Next.js
 * - En desarrollo, usa debug mode para ver eventos en consola
 *
 * PERCHA-031: implementado según notas técnicas de la story.
 */

import { useEffect, useRef, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "@/lib/posthog/client";
import { hashUserIdClient } from "@/lib/posthog/client";

// ── Hook para pageviews ───────────────────────────────────────────────────────

function PosthogPageviewTracker() {
  const pathname    = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!posthog.__loaded) return;
    const url = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : "");
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}

// ── Provider principal ────────────────────────────────────────────────────────

interface PosthogProviderProps {
  children:   React.ReactNode;
  /** userId de Supabase — se hashea antes de enviarse a PostHog */
  userId?: string | null;
}

export function PosthogProvider({ children, userId }: PosthogProviderProps) {
  const initialized  = useRef(false);
  const identifiedId = useRef<string | null>(null);

  // ── 1. Inicializar PostHog ──────────────────────────────────────────────────
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host   = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com";

    if (!apiKey) {
      console.warn("[PosthogProvider] NEXT_PUBLIC_POSTHOG_KEY no definida — analytics desactivados");
      return;
    }

    // Respetar Do Not Track
    if (typeof navigator !== "undefined" && navigator.doNotTrack === "1") {
      console.info("[PosthogProvider] Do Not Track habilitado — analytics desactivados");
      return;
    }

    posthog.init(apiKey, {
      api_host:              host,
      // Desactivar pageviews automáticos — los manejamos manualmente con el router
      capture_pageview:      false,
      // Desactivar pageleave automático (causa spam en SPAs)
      capture_pageleave:     false,
      // Persistencia en localStorage para mantener sesión entre tabs
      persistence:           "localStorage",
      // En dev, mostrar eventos en consola
      loaded: (ph) => {
        if (process.env.NODE_ENV === "development") {
          ph.debug(false); // Cambiar a true para ver eventos en consola
        }
      },
    });
  }, []);

  // ── 2. Identificar usuario ─────────────────────────────────────────────────
  useEffect(() => {
    if (!userId || !posthog.__loaded) return;
    if (identifiedId.current === userId) return; // ya identificado
    identifiedId.current = userId;

    // Identificar con hash SHA-256 — nunca el UUID real ni el email
    hashUserIdClient(userId).then((hashedId) => {
      posthog.identify(hashedId, {
        // Sin propiedades PII — solo tipo de usuario si fuera necesario
      });
    });
  }, [userId]);

  // ── 3. Reset al desloguear ─────────────────────────────────────────────────
  useEffect(() => {
    if (!userId && identifiedId.current !== null) {
      identifiedId.current = null;
      if (posthog.__loaded) posthog.reset();
    }
  }, [userId]);

  return (
    <>
      {/*
        Suspense requerido por useSearchParams() en Next.js App Router.
        El tracker es invisible — no afecta el layout.
      */}
      <Suspense fallback={null}>
        <PosthogPageviewTracker />
      </Suspense>
      {children}
    </>
  );
}
