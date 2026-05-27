/**
 * Root page — sin locale.
 * Con next-intl (localePrefix: "as-needed"), el middleware reescribe `/`
 * internamente al locale por defecto (es) y renderiza app/[locale]/page.tsx.
 * Este archivo solo existe como fallback; en la práctica nunca se ejecuta.
 */
export default function RootPage() {
  // No-op: el middleware de next-intl maneja el routing hacia [locale]/page.tsx
  return null;
}
