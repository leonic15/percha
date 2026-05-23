import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { routing } from "@/lib/i18n/routing";

// Rutas protegidas (requieren autenticación) — sin prefijo de locale
const protectedPaths = ["/guardarropas", "/generador", "/looks", "/perfil", "/configuracion"];

// Rutas solo para usuarios NO autenticados
const authPaths = ["/login", "/registro", "/recuperar-password"];

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
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthPath && user) {
    return NextResponse.redirect(new URL("/guardarropas", request.url));
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icons|sw.js|workbox-.*|manifest.json).*)",
  ],
};
