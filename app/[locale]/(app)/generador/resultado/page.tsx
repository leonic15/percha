import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GeneratorResultClient } from "@/components/features/generator/GeneratorResultClient";

/**
 * PERCHA-017: Generador · Resultado (Handoff 13)
 * Ruta: /generador/resultado
 *
 * Server Component:
 * - Verifica sesión (si no hay sesión → /login)
 * - El contenido real viene de sessionStorage (GeneratorResultClient)
 */
export default async function GeneradorResultadoPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="md:max-w-[640px] md:mx-auto md:w-full relative">
      <GeneratorResultClient />
    </div>
  );
}
