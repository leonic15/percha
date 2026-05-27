/**
 * LOOKSI-030: Instrumentación del cliente — Next.js 16 App Router.
 *
 * Este archivo se ejecuta en el browser ANTES de la hidratación de React
 * (después de cargar el HTML, antes de las interacciones del usuario).
 * Es el momento ideal para inicializar Sentry y otros monitores.
 *
 * Docs: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation-client.md
 */

import "./sentry.client.config";

import * as Sentry from "@sentry/nextjs";

/**
 * Hook de Next.js 16: se llama al inicio de cada navegación del cliente.
 * Agrega breadcrumbs de navegación a los eventos de Sentry para mejor contexto.
 */
export function onRouterTransitionStart(
  url: string,
  navigationType: "push" | "replace" | "traverse"
) {
  Sentry.addBreadcrumb({
    category: "navigation",
    message: `${navigationType} → ${url}`,
    level: "info",
  });
}
