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
      // 'wasm-unsafe-eval': requerido por @imgly/background-removal (ONNX Runtime WASM)
      "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self'",
      "img-src 'self' data: blob: https://*.supabase.co https://lh3.googleusercontent.com",
      // blob: requerido para Web Workers que crea @imgly/background-removal
      "worker-src 'self' blob:",
      // staticimgly.com: CDN de modelos ONNX de @imgly/background-removal
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://eu.i.posthog.com https://eu-assets.i.posthog.com https://*.ingest.sentry.io https://staticimgly.com",
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

// Composición: next-intl envuelve PWA que envuelve la config base
export default withNextIntl(withPWA(nextConfig));
