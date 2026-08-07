import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";
import type { CookieOptions } from "@supabase/ssr";
import { logger } from "@/lib/utils/logger";

/**
 * PERCHA-003: Inicio de OAuth con Google — server-side.
 *
 * Por qué server-side en vez de client-side:
 *   - En dev por LAN, los chunks JS de Turbopack a veces no cargan en
 *     dispositivos físicos. Sin hidratación de React, los onClick no se adjuntan.
 *   - Mover el inicio de OAuth a una API Route convierte el botón en un
 *     <a href="/api/auth/google"> que funciona sin JavaScript.
 *   - El servidor genera la URL de Google y hace el redirect (HTTP 302).
 *
 * Flujo:
 *   1. <a href="/api/auth/google"> → GET /api/auth/google
 *   2. signInWithOAuth genera la URL de Google y guarda el code verifier PKCE en cookie
 *   3. 302 → https://accounts.google.com/...
 *   4. Google → 302 → https://<proyecto>.supabase.co/auth/v1/callback
 *   5. Supabase → 302 → <origin>/auth/callback?code=...
 *   6. /auth/callback intercambia el code y redirige a /guardarropas
 *
 * Prerequisitos:
 *   - Google habilitado en Supabase Dashboard → Authentication → Providers
 *   - En Supabase → Authentication → URL Configuration → Redirect URLs:
 *       http://localhost:3000/auth/callback          (dev local)
 *       http://192.168.x.x:3000/auth/callback       (dev LAN / iPhone físico)
 *       https://tu-dominio.com/auth/callback         (producción)
 */
/**
 * Deriva el origin para OAuth redirects.
 *
 * Orden de prioridad:
 *   1. NEXT_PUBLIC_APP_URL (env var explícita — fuente más confiable)
 *      En .env.local para dev LAN: http://192.168.1.111:3000
 *      En Vercel (producción):     https://tu-dominio.com
 *   2. Host header del request (fallback para dev local sin env var)
 *
 * Por qué no usar new URL(request.url):
 *   Next.js dev server siempre pone "localhost" en request.url aunque el
 *   cliente llegue por una IP de LAN distinta.
 */
function getOrigin(request: Request): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  const host  = request.headers.get("host") ?? new URL(request.url).host;
  const proto = process.env.NODE_ENV === "production" ? "https" : "http";
  return `${proto}://${host}`;
}

export async function GET(request: Request) {
  const origin = getOrigin(request);
  const { searchParams } = new URL(request.url);
  const inspect = searchParams.has("inspect");

  const cookieStore = await cookies();

  // Recolectar las cookies PKCE que signInWithOAuth quiere setear.
  // Las pondremos explícitamente en el redirect response para garantizar
  // que el browser las reciba (el code verifier PKCE es crítico para el callback).
  const pkceCookies: Array<{ name: string; value: string; options: CookieOptions }> = [];

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            try { cookieStore.set(name, value, options); } catch { /* readonly en GET */ }
          });
          // Siempre recolectar para copiar al response explícitamente
          pkceCookies.push(...cookiesToSet);
        },
      },
    }
  );

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      // El origin viene del request → funciona con localhost, LAN IP y producción
      redirectTo: `${origin}/auth/callback`,
      scopes: "email profile",
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  // ?inspect=1 → muestra la URL generada sin redirigir (diagnóstico temporal)
  if (inspect) {
    if (error || !data.url) {
      return Response.json({ error: error?.message ?? "No URL generada", origin });
    }
    const generated = new URL(data.url);
    const params = Object.fromEntries(generated.searchParams);
    return Response.json({
      "origin calculado":       origin,
      "redirectTo enviado":     `${origin}/auth/callback`,
      "URL generada (host)":    generated.host,
      "URL generada (path)":    generated.pathname,
      "URL generada (completa)": data.url,
      "redirect_to en la URL":  params.redirect_to ?? "(no está en query params — puede ir en state)",
      "todos los params":        params,
    });
  }

  if (error || !data.url) {
    logger.error("[auth/google] signInWithOAuth error", { endpoint: "auth/google" }, error instanceof Error ? error : undefined);
    const errRes = NextResponse.redirect(`${origin}/login?error=oauth_error`);
    errRes.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return errRes;
  }

  // Redirigir al user a Google.
  // Cache-Control: no-store evita que Safari cachée este redirect 302.
  const res = NextResponse.redirect(data.url);
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");

  // Copiar el code verifier PKCE explícitamente al response.
  // Si Next.js no propaga automáticamente cookies() al redirect response,
  // este mecanismo garantiza que el browser reciba el code verifier.
  pkceCookies.forEach(({ name, value, options }) => {
    res.cookies.set(name, value, options as Parameters<typeof res.cookies.set>[2]);
  });

  return res;
}
