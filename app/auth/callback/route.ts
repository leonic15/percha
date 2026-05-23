import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";

/**
 * LOOKSI-003: Callback de OAuth (Google) y recuperación de contraseña (LOOKSI-004).
 *
 * Flujo PKCE:
 *   1. Supabase redirige aquí con ?code=xxx (OAuth o password recovery)
 *   2. Intercambiamos el code por una sesión (tokens + cookies)
 *   3. Redirigimos al destino: ?next= param o /guardarropas por defecto
 *
 * URL configurada en:
 *   - Supabase Auth: Site URL + Redirect URLs → <origin>/auth/callback
 *   - Google Cloud Console: Authorized redirect URIs → <origin>/auth/callback
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/guardarropas";
  const error = searchParams.get("error");

  // El usuario canceló el popup de Google → volver a login sin error
  if (error) {
    return NextResponse.redirect(`${origin}/login`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=oauth_error`);
  }

  const cookieStore = await cookies();

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    // Link expirado o ya usado (para password recovery)
    if (next === "/auth/reset-password") {
      return NextResponse.redirect(`${origin}/auth/reset-password?error=link_expired`);
    }
    return NextResponse.redirect(`${origin}/login?error=oauth_error`);
  }

  // Redirigir al destino — next puede ser /auth/reset-password o /guardarropas
  return NextResponse.redirect(`${origin}${next}`);
}
