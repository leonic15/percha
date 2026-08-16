import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { routing } from "@/lib/i18n/routing";
import {
  buildCsp,
  generateNonce,
  CSP_HEADER,
  NONCE_HEADER,
  WASM_PATHS,
} from "@/lib/csp";

// Rutas protegidas (requieren autenticación) — sin prefijo de locale
const protectedPaths = ["/guardarropas", "/generador", "/looks", "/perfil", "/configuracion"];

// Rutas solo para usuarios NO autenticados
const authPaths = ["/login", "/registro", "/recuperar-password"];

/**
 * Deriva el origin correcto para los redirects del middleware.
 * request.url en Next.js dev siempre devuelve localhost internamente —
 * usar la env var o el Host header para obtener la IP/dominio real.
 */
function getRedirectOrigin(request: NextRequest): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  const host  = request.headers.get("host") ?? request.nextUrl.host;
  const proto = process.env.NODE_ENV === "production" ? "https" : "http";
  return `${proto}://${host}`;
}

const intlMiddleware = createMiddleware(routing);

/**
 * Arma la CSP del request y deja el nonce disponible para el render.
 *
 * En producción se emite un nonce por request y `script-src` va sin
 * `'unsafe-inline'`. Los headers se escriben sobre el *request* a propósito:
 * Next.js saca el nonce del header `content-security-policy` entrante para
 * firmar sus scripts inline, y `app/layout.tsx` lee `x-nonce` para el bootstrap
 * de tema. next-intl copia los headers del request en su rewrite, así que las
 * mutaciones llegan al render.
 *
 * En dev no hay nonce (ver `lib/csp.ts`): Turbopack y el overlay de dev inyectan
 * scripts inline que no pasan por el renderer y romperían con CSP estricta.
 */
function prepareCsp(request: NextRequest, pathnameWithoutLocale: string): string {
  const isProd = process.env.NODE_ENV === "production";
  const wasm = WASM_PATHS.some((p) => pathnameWithoutLocale.startsWith(p));
  const nonce = isProd ? generateNonce() : undefined;

  const csp = buildCsp({ nonce, wasm, isProd });

  request.headers.set(CSP_HEADER, csp);
  if (nonce) request.headers.set(NONCE_HEADER, nonce);
  else request.headers.delete(NONCE_HEADER); // no confiar en un x-nonce entrante

  return csp;
}

export async function proxy(request: NextRequest) {
  // Normalizar pathname quitando prefijo de locale (/en/guardarropas → /guardarropas)
  const { pathname } = request.nextUrl;
  const pathnameWithoutLocale = pathname.replace(/^\/(es|en)/, "") || "/";

  // Antes que nada: fijar la CSP sobre el request para que el render la vea
  const csp = prepareCsp(request, pathnameWithoutLocale);

  // Actualizar la sesión de Supabase en cada request
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtected = protectedPaths.some((p) => pathnameWithoutLocale.startsWith(p));
  const isAuthPath   = authPaths.some((p)   => pathnameWithoutLocale.startsWith(p));

  if (isProtected && !user) {
    // IMPORTANTE: no usar request.url — Next.js dev siempre lo resuelve como localhost.
    // Usar getRedirectOrigin() para obtener la IP/dominio real del cliente.
    const origin   = getRedirectOrigin(request);
    const loginUrl = new URL(`${origin}/login`);
    loginUrl.searchParams.set("redirectTo", pathname);
    return withCsp(NextResponse.redirect(loginUrl), csp);
  }

  if (isAuthPath && user) {
    const origin = getRedirectOrigin(request);
    return withCsp(NextResponse.redirect(new URL(`${origin}/guardarropas`)), csp);
  }

  return withCsp(intlMiddleware(request), csp);
}

/** Publica la CSP del request en la respuesta que llega al navegador. */
function withCsp(response: NextResponse, csp: string): NextResponse {
  response.headers.set(CSP_HEADER, csp);
  return response;
}

export const config = {
  matcher: [
    // Excluir: api, assets estáticos, PWA artifacts, imágenes locales, /auth/* y /onnx/
    "/((?!api|_next/static|_next/image|favicon.ico|icons|images|sw.js|workbox-.*|manifest.json|auth|onnx/).*)",
  ],
};
