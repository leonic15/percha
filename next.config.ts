import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";

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

  // ── Cabeceras de seguridad HTTP (LOOKSI-029) ─────────────────────────────
  async headers() {
    // Content-Security-Policy
    // - script-src: 'unsafe-inline' requerido por Next.js hydration sin nonces.
    //   Upgrade a nonce-based CSP en una iteración futura si se necesita A+.
    // - font-src 'self': next/font descarga y sirve las fuentes desde /_next/static/
    // - img-src: blob: para compresión de imágenes client-side (browser-image-compression)
    //   lh3.googleusercontent.com: avatares de Google OAuth
    // - connect-src: wss://*.supabase.co para Supabase Realtime (future-proof)
    //   /ingest/* proxeado a PostHog vía vercel.json rewrites → 'self' suficiente
    const csp = [
      "default-src 'self'",
      // 'wasm-unsafe-eval': requerido para compilación WASM.
      // 'unsafe-eval': requerido por Emscripten que usa new Function() en la inicialización del binding WASM.
      // blob: requerido para import() dinámico de módulos blob que genera onnxruntime-web.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self'",
      "img-src 'self' data: blob: https://*.supabase.co https://lh3.googleusercontent.com",
      // blob: requerido para Web Workers que crea @imgly/background-removal
      "worker-src 'self' blob:",
      // staticimgly.com: CDN de modelos ONNX de @imgly/background-removal
      // blob: requerido para que onnxruntime-web pueda fetch() el .wasm desde un blob URL
      "connect-src 'self' blob: https://*.supabase.co wss://*.supabase.co https://eu.i.posthog.com https://eu-assets.i.posthog.com https://us.i.posthog.com https://us-assets.i.posthog.com https://*.ingest.sentry.io https://staticimgly.com",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      // Solo en producción: en dev sobre LAN (http://192.168.x.x) este header
      // hace que el browser intente subir los recursos a https:// — que no existe
      // en el dev server — y las imágenes/fonts fallan en silencio en iOS Safari.
      ...(process.env.NODE_ENV === "production" ? ["upgrade-insecure-requests"] : []),
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy",   value: csp },
          { key: "X-Frame-Options",           value: "DENY" },
          { key: "X-Content-Type-Options",    value: "nosniff" },
          { key: "Referrer-Policy",           value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy",        value: "camera=self, geolocation=self, microphone=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
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
