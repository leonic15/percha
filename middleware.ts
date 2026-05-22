import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const locales = ["es", "en"];
const defaultLocale = "es";

// Rutas protegidas (requieren autenticación)
const protectedPaths = [
  "/guardarropas",
  "/looks",
  "/configuracion",
];

// Rutas solo para usuarios NO autenticados
const authPaths = ["/login", "/registro", "/recuperar-password"];

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: "as-needed", // español sin prefijo, inglés con /en
});

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Actualizar la sesión de Supabase en cada request
  let response = NextResponse.next({
    request,
  });

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

  // Determinar la ruta sin el prefijo de locale
  const pathnameWithoutLocale = pathname.replace(/^\/(es|en)/, "") || "/";

  const isProtected = protectedPaths.some((p) =>
    pathnameWithoutLocale.startsWith(p)
  );
  const isAuthPath = authPaths.some((p) =>
    pathnameWithoutLocale.startsWith(p)
  );

  // Redirigir a login si la ruta es protegida y no hay sesión
  if (isProtected && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirigir al guardarropas si ya está autenticado y va a auth
  if (isAuthPath && user) {
    return NextResponse.redirect(new URL("/guardarropas", request.url));
  }

  // Aplicar middleware de i18n
  return intlMiddleware(request);
}

export const config = {
  matcher: [
    // Excluir archivos estáticos, API routes y rutas internas de Next.js
    "/((?!api|_next/static|_next/image|favicon.ico|icons|sw.js|workbox-.*|manifest.json).*)",
  ],
};
