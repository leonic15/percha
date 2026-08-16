import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GeneratorConfigClient } from "@/components/features/generator/GeneratorConfigClient";

/**
 * PERCHA-017: Generador · Configurar (Handoff 12)
 * Ruta: /generador
 *
 * Server Component:
 * - Verifica sesión
 * - Lee ciudad + coordenadas del perfil (para fallback clima — PERCHA-022)
 * - Lee las categorías (para etiquetar las prendas del picker de prenda base)
 * - Pasa al client
 */
export default async function GeneradorPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Leer ciudad + preferencias del perfil
  const { data: profile } = await supabase
    .from("profiles")
    .select("ciudad_nombre, ciudad_latitud, ciudad_longitud, ocasiones_frecuentes")
    .eq("id", user.id)
    .single();

  const ciudadNombre   = profile?.ciudad_nombre   ?? null;
  const ciudadLatitud  = profile?.ciudad_latitud  ?? null;
  const ciudadLongitud = profile?.ciudad_longitud ?? null;

  // PERCHA-024: primera ocasión frecuente como pre-selección en el generador
  const ocasiones      = (profile?.ocasiones_frecuentes ?? []) as string[];
  const defaultOcasion = ocasiones[0] ?? null;

  // GET /api/garments devuelve filas crudas de `prendas` (solo `category_id`),
  // así que el nombre de la categoría se resuelve acá, igual que en el
  // guardarropas.
  const { data: categoriesData } = await supabase
    .from("categories")
    .select("id, nombre");
  const categories = (categoriesData ?? []) as { id: number; nombre: string }[];

  return (
    // Desktop: columna central max-w-[640px]
    <div className="md:max-w-[640px] md:mx-auto md:w-full relative">
      <GeneratorConfigClient
        ciudadNombre={ciudadNombre}
        ciudadLatitud={ciudadLatitud}
        ciudadLongitud={ciudadLongitud}
        defaultOcasion={defaultOcasion}
        categories={categories}
      />
    </div>
  );
}
