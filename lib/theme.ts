/**
 * Tema claro / oscuro — fuente única de la verdad (PERCHA-025).
 *
 * El tema se representa con `data-theme="light" | "dark"` en <html>; globals.css
 * redefine ahí los tokens semánticos (--color-bg, --color-ink, …). Los
 * componentes nunca deben hardcodear colores: siempre las clases de token
 * (bg-bg, text-ink, border-line, …) o `dark:` para casos puntuales.
 *
 * La preferencia del usuario ("claro" | "oscuro" | "sistema") vive en la DB y
 * se cachea en localStorage para que el bootstrap del root layout pueda
 * aplicarla antes del primer paint, en cualquier ruta y tras cualquier recarga.
 */

/** Clave de localStorage donde se cachea la preferencia de tema. */
export const THEME_STORAGE_KEY = "percha-tema";

/** Preferencia elegida por el usuario (lo que se guarda). */
export type ThemePreference = "claro" | "oscuro" | "sistema";

/** Tema realmente aplicado tras resolver "sistema". */
export type ResolvedTheme = "light" | "dark";

/**
 * Color de la barra de estado / chrome del navegador por tema.
 * Coinciden con --color-bg para que el notch no corte con una franja clara.
 */
export const LIGHT_THEME_COLOR = "#f7f5ef"; // stone-50
export const DARK_THEME_COLOR = "#0d0c0a"; // stone-950

/** Resuelve "sistema" contra la media query del SO. */
export function resolveTheme(pref: string): ResolvedTheme {
  if (pref === "oscuro") return "dark";
  if (pref === "claro") return "light";
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/**
 * Aplica el tema en <html>, sincroniza el <meta name="theme-color"> y cachea
 * la preferencia en localStorage. No-op en servidor.
 */
export function applyTheme(pref: string): void {
  if (typeof window === "undefined") return;

  const resolved = resolveTheme(pref);
  document.documentElement.setAttribute("data-theme", resolved);

  // Next emite dos <meta name="theme-color"> con media queries; el bootstrap y
  // este helper reescriben el que no tiene media para forzar el tema elegido.
  const meta =
    document.querySelector('meta[name="theme-color"]:not([media])') ??
    document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute(
    "content",
    resolved === "dark" ? DARK_THEME_COLOR : LIGHT_THEME_COLOR,
  );

  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // Safari en modo privado puede tirar acá; el tema igual quedó aplicado.
  }
}
