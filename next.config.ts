import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";
import { buildNonDocumentCsp } from "./lib/csp";

/* ── PWA ── */
const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
    // Cachea las imágenes de prendas en el dispositivo.
    // StaleWhileRevalidate: sirve desde cache al instante y revalida en background.
    // El proxy /api/garments/[id]/image tiene URL estable → el SW puede cachearla
    // a diferencia de los signed URLs de Supabase que cambian de token cada vez.
    runtimeCaching: [
      {
        urlPattern: /\/images\/category\//,
        handler: "CacheFirst",
        options: {
          cacheName: "category-images",
          expiration: {
            maxEntries: 20,
            maxAgeSeconds: 365 * 24 * 60 * 60,
          },
          cacheableResponse: {
            statuses: [200],
          },
        },
      },
      {
        urlPattern: /\/api\/garments\/[^/]+\/image$/,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "garment-images",
          expiration: {
            maxEntries: 500,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 días
          },
          cacheableResponse: {
            statuses: [200],
          },
        },
      },
    ],
  },
});

/* ── next-intl: le dice a Next.js dónde está el archivo de config ── */
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Permitir acceso desde dispositivos físicos en la red local (LAN dev)
  allowedDevOrigins: ["192.168.1.111"],

  // Next.js 16 usa Turbopack por defecto (dev + build). El plugin PWA agrega
  // config webpack; declarar turbopack: {} explícitamente evita que Next trate
  // esa mezcla como un error. Nota: con Turbopack el CSS de Tailwind se bundlea
  // en JS y se inyecta via innerHTML — el <style> crítico en layout.tsx
  // compensa el FOUC en redes lentas antes de que ese chunk cargue.
  turbopack: {},

  // Permitir imágenes desde Supabase Storage (URLs firmadas) y avatares de Google
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/**",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },

  // ── Cabeceras de seguridad HTTP (PERCHA-029) ─────────────────────────────
  //
  // La CSP de los documentos HTML NO se define acá: necesita un nonce distinto
  // por request, así que la arma `proxy.ts` (ver `lib/csp.ts`). Acá quedan los
  // headers que no dependen del request, más la CSP de las rutas que el matcher
  // del proxy excluye (`/api/*`, `/auth/*`), que no devuelven HTML.
  async headers() {
    const securityHeaders = [
      { key: "X-Frame-Options",           value: "DENY" },
      { key: "X-Content-Type-Options",    value: "nosniff" },
      { key: "Referrer-Policy",           value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy",        value: "camera=self, geolocation=self, microphone=()" },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
    ];

    return [
      // Respuestas no-documento: JSON, imágenes y redirects de auth.
      {
        source: "/api/:path*",
        headers: [
          { key: "Content-Security-Policy", value: buildNonDocumentCsp() },
          ...securityHeaders,
        ],
      },
      {
        source: "/auth/:path*",
        headers: [
          { key: "Content-Security-Policy", value: buildNonDocumentCsp() },
          ...securityHeaders,
        ],
      },
      // Resto del sitio: la CSP la agrega el proxy con el nonce del request.
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

// Composición: Sentry → next-intl → PWA → config base
// withSentryConfig maneja source maps en builds de producción y añade
// el Sentry webpack plugin. En Turbopack dev no interfiere.
export default withSentryConfig(
  withNextIntl(withPWA(nextConfig)),
  {
    // Org y proyecto de Sentry (usados solo para source maps en CI/CD)
    // Se leen desde env vars para no hardcodear slugs en el código.
    // Vercel: Settings → Environment Variables → SENTRY_ORG / SENTRY_PROJECT
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,

    // Source maps: subir a Sentry en builds de producción
    // deleteSourcemapsAfterUpload evita exponer el código fuente en el bundle público
    sourcemaps: {
      deleteSourcemapsAfterUpload: true,
    },

    // Silenciar los logs del plugin de Sentry durante la build
    silent: !process.env.CI,

    // Deshabilitar el tunnel de Sentry (ya tenemos connect-src en CSP
    // apuntando directamente a *.ingest.sentry.io)
    tunnelRoute: undefined,

    // Opciones específicas de webpack (no aplican en Turbopack dev)
    webpack: {
      // No wrappear las API Routes automáticamente — lo hacemos manualmente
      // en las rutas que queremos para tener control del contexto de usuario
      autoInstrumentServerFunctions: false,

      // No wrappear el middleware automáticamente (tenemos proxy.ts personalizado)
      autoInstrumentMiddleware: false,
    },
  }
);
