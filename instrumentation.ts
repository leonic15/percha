/**
 * PERCHA-030: Instrumentación del servidor — Next.js 16 App Router.
 *
 * Next.js llama a `register()` una vez al arrancar el servidor.
 * Importamos las configs de Sentry condicionalmente por runtime para
 * evitar que código Node.js se ejecute en Edge y viceversa.
 *
 * Docs: node_modules/next/dist/docs/01-app/02-guides/instrumentation.md
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
