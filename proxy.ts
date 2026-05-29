import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { routing } from "@/lib/i18n/routing";

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

export async function proxy(request: NextRequest) {
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

  // Normalizar pathname quitando prefijo de locale (/en/guardarropas → /guardarropas)
  const { pathname } = request.nextUrl;
  const pathnameWithoutLocale = pathname.replace(/^\/(es|en)/, "") || "/";

  const isProtected = protectedPaths.some((p) => pathnameWithoutLocale.startsWith(p));
  const isAuthPath   = authPaths.some((p)   => pathnameWithoutLocale.startsWith(p));

  if (isProtected && !user) {
    // IMPORTANTE: no usar request.url — Next.js dev siempre lo resuelve como localhost.
    // Usar getRedirectOrigin() para obtener la IP/dominio real del cliente.
    const origin   = getRedirectOrigin(request);
    const loginUrl = new URL(`${origin}/login`);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthPath && user) {
    const origin = getRedirectOrigin(request);
    return NextResponse.redirect(new URL(`${origin}/guardarropas`));
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: [
    // Excluir: api, assets estáticos, PWA artifacts, imágenes locales, /auth/* y /onnx/
    "/((?!api|_next/static|_next/image|favicon.ico|icons|images|sw.js|workbox-.*|manifest.json|auth|onnx/).*)",
  ],
};
