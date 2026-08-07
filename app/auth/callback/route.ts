import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";
import type { CookieOptions } from "@supabase/ssr";

/**
 * PERCHA-003: Callback de OAuth (Google) y recuperación de contraseña (PERCHA-004).
 *
 * Flujo PKCE:
 *   1. Supabase redirige aquí con ?code=xxx (OAuth o password recovery)
 *   2. Intercambiamos el code por una sesión (tokens + cookies)
 *   3. Redirigimos al destino: ?next= param o /guardarropas por defecto
 *
 * URL configurada en:
 *   - Supabase Auth: Site URL + Redirect URLs → <origin>/auth/callback
 *   - Google Cloud Console: Authorized redirect URIs → <origin>/auth/callback
 *
 * Por qué se crean las cookies explícitamente en el NextResponse:
 *   En Next.js 15+, las cookies seteadas vía cookies() de next/headers en un
 *   GET Route Handler pueden no incluirse en el 302 redirect response.
 *   Setearlas directamente en el objeto NextResponse garantiza que lleguen
 *   al browser (iPhone, etc.) y estén disponibles en el siguiente request.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  // Usar NEXT_PUBLIC_APP_URL si está definida (fuente más confiable).
  // Fallback: Host header — más confiable que new URL(request.url).origin
  // que en el dev server de Next.js siempre devuelve "localhost".
  const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")
    ?? (() => {
         const host  = request.headers.get("host") ?? new URL(request.url).host;
         const proto = process.env.NODE_ENV === "production" ? "https" : "http";
         return `${proto}://${host}`;
       })();

  const code = searchParams.get("code");
  // H-12: aceptar `next` solo si es una ruta interna (empieza con "/" pero no "//")
  const nextRaw = searchParams.get("next") ?? "";
  const next = (nextRaw.startsWith("/") && !nextRaw.startsWith("//")) ? nextRaw : "/guardarropas";
  const error = searchParams.get("error");

  // El usuario canceló el popup de Google → volver a login sin error
  if (error) {
    return NextResponse.redirect(`${origin}/login`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=oauth_error`);
  }

  const cookieStore = await cookies();

  // Recolectar las cookies que Supabase quiere setear (tokens de sesión).
  // Las agregaremos explícitamente al NextResponse para garantizar que
  // el browser las reciba aunque Next.js no las propague automáticamente.
  const pendingCookies: Array<{ name: string; value: string; options: CookieOptions }> = [];

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          // Intentar setear en cookieStore (puede fallar silenciosamente en GET handlers)
          cookiesToSet.forEach(({ name, value, options }) => {
            try { cookieStore.set(name, value, options); } catch { /* readonly en GET */ }
          });
          // Siempre recolectar para copiar al response explícitamente
          pendingCookies.push(...cookiesToSet);
        },
      },
    }
  );

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error("[auth/callback] exchangeCodeForSession failed:", exchangeError.message);
    // Link expirado o ya usado (para password recovery)
    const errUrl = next === "/auth/reset-password"
      ? `${origin}/auth/reset-password?error=link_expired`
      : `${origin}/login?error=oauth_error`;
    return NextResponse.redirect(errUrl);
  }

  // Redirigir al destino — next puede ser /auth/reset-password o /guardarropas
  const response = NextResponse.redirect(`${origin}${next}`);

  // Copiar explícitamente las cookies de sesión al response.
  // Esto garantiza que el browser (especialmente en dispositivos físicos via LAN)
  // reciba los tokens de sesión en el Set-Cookie del 302 redirect.
  pendingCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]);
  });

  return response;
}
