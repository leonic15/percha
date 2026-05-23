import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente de Supabase para uso en el navegador (componentes Client).
 * Usa @supabase/ssr para manejar la sesión mediante cookies HttpOnly.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
