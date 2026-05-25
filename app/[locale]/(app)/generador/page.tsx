import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GeneratorConfigClient } from "@/components/features/generator/GeneratorConfigClient";

/**
 * LOOKSI-017: Generador · Configurar (Handoff 12)
 * Ruta: /generador
 *
 * Server Component:
 * - Verifica sesión
 * - Lee la ciudad configurada del perfil (para el widget de clima)
 * - Pasa al client
 */
export default async function GeneradorPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Leer ciudad del perfil para mostrarla en el widget de clima
  const { data: profile } = await supabase
    .from("profiles")
    .select("ciudad_nombre")
    .eq("id", user.id)
    .single();

  const ciudadNombre = profile?.ciudad_nombre ?? null;

  return (
    // Desktop: columna central max-w-[640px]
    <div className="md:max-w-[640px] md:mx-auto md:w-full relative">
      <GeneratorConfigClient ciudadNombre={ciudadNombre} />
    </div>
  );
}
