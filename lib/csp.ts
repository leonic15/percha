/**
 * lib/csp.ts — Content-Security-Policy centralizada (PERCHA-029).
 *
 * La política se arma acá y se usa desde dos lugares:
 *
 *   1. `proxy.ts` — documentos HTML. Genera un nonce por request, lo inyecta
 *      en los headers del request (para que Next.js firme sus propios scripts
 *      inline) y lo publica en la respuesta.
 *   2. `next.config.ts` — rutas excluidas del proxy (`/api/*`, `/auth/*`), que
 *      no devuelven HTML y por lo tanto no necesitan nonce.
 *
 * Sobre `script-src` sin `'unsafe-inline'`:
 * Next.js emite scripts inline propios (bootstrap del runtime y los chunks de
 * datos RSC `self.__next_f.push(...)`) cuyo contenido cambia en cada render, así
 * que no se pueden cubrir con hashes: hace falta un nonce por request. Next lo
 * detecta leyendo el header `content-security-policy` del request y lo aplica a
 * todos sus scripts; el único script inline propio del proyecto
 * (`THEME_BOOTSTRAP` en `app/layout.tsx`) lo recibe vía el header `x-nonce`.
 *
 * `'strict-dynamic'` hace que los scripts cargados por un script confiable
 * hereden la confianza (chunks de Next, recorder de PostHog). Los navegadores
 * que lo soportan ignoran `'self'` y `blob:`; se dejan igual como fallback para
 * navegadores CSP2 que ignoran `'strict-dynamic'`.
 */

/** Header interno donde el proxy publica el nonce para el layout. */
export const NONCE_HEADER = "x-nonce";

/** Header estándar de CSP. Next.js lee el nonce de acá en el request. */
export const CSP_HEADER = "content-security-policy";

/**
 * Nonce de 128 bits en base64. Usa Web Crypto + btoa para funcionar igual en
 * el runtime edge y en Node (el proxy puede correr en cualquiera de los dos).
 */
export function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

type CspOptions = {
  /**
   * Nonce del request. Sin nonce se cae a `'unsafe-inline'`: es el modo de
   * desarrollo, donde Turbopack/React Refresh inyectan scripts inline propios
   * que no pasan por el renderer de Next y quedarían bloqueados.
   */
  nonce?: string;
  /**
   * Habilita `'unsafe-eval'` — solo para la pantalla de análisis IA, donde
   * @imgly/background-removal (Emscripten/onnxruntime-web) usa `new Function()`
   * al inicializar el binding WASM.
   */
  wasm?: boolean;
  /** Agrega `upgrade-insecure-requests`. Off en dev LAN (http://192.168.x.x). */
  isProd?: boolean;
};

function scriptSrc(nonce: string | undefined, wasm: boolean): string {
  const sources = ["'self'"];

  if (nonce) sources.push(`'nonce-${nonce}'`, "'strict-dynamic'");
  else sources.push("'unsafe-inline'");

  if (wasm) sources.push("'unsafe-eval'");
  sources.push("'wasm-unsafe-eval'", "blob:");

  return `script-src ${sources.join(" ")}`;
}

/** CSP para documentos HTML. */
export function buildCsp({
  nonce,
  wasm = false,
  isProd = process.env.NODE_ENV === "production",
}: CspOptions = {}): string {
  return [
    "default-src 'self'",
    scriptSrc(nonce, wasm),
    // Sigue con 'unsafe-inline': Tailwind v4 y el style hoisting de React 19
    // (<style href precedence>) inyectan CSS inline sin nonce.
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data: blob: https://*.supabase.co https://lh3.googleusercontent.com",
    // blob: requerido para Web Workers que crea @imgly/background-removal
    "worker-src 'self' blob:",
    // staticimgly.com: CDN de modelos ONNX de @imgly/background-removal
    "connect-src 'self' blob: https://*.supabase.co wss://*.supabase.co https://eu.i.posthog.com https://eu-assets.i.posthog.com https://us.i.posthog.com https://us-assets.i.posthog.com https://*.ingest.sentry.io https://staticimgly.com",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // Solo en producción: en dev LAN (http://192.168.x.x) rompería imágenes/fonts en iOS Safari
    ...(isProd ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

/**
 * CSP para respuestas que no son documentos (`/api/*`, `/auth/*`): JSON,
 * imágenes y redirects. No cargan subrecursos ni ejecutan scripts, así que
 * pueden ir con todo denegado.
 */
export function buildNonDocumentCsp(
  isProd = process.env.NODE_ENV === "production"
): string {
  return [
    "default-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    ...(isProd ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

/**
 * Rutas que necesitan la CSP con `'unsafe-eval'`. Se comparan contra el
 * pathname sin prefijo de locale.
 */
export const WASM_PATHS = ["/guardarropas/nueva/analizar"];
