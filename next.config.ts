import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";
import createNextIntlPlugin from "next-intl/plugin";

/* ── PWA ── */
const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
  },
});

/* ── next-intl: le dice a Next.js dónde está el archivo de config ── */
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Next 16 usa Turbopack por defecto; el plugin PWA agrega config webpack.
  // Declarar Turbopack explícitamente evita que Next lo trate como un error.
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
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self'",
      "img-src 'self' data: blob: https://*.supabase.co https://lh3.googleusercontent.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://eu.i.posthog.com https://eu-assets.i.posthog.com https://*.ingest.sentry.io",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
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

// Composición: next-intl envuelve PWA que envuelve la config base
export default withNextIntl(withPWA(nextConfig));
