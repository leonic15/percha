import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NuevoViajeClient } from "@/components/features/viajes/NuevoViajeClient";
import type { Prenda } from "@/lib/database.types";
import { garmentImageUrl } from "@/lib/storage/urls";

export default async function NuevoViajePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Prendas del guardarropas con la URL estable del proxy de imágenes
  const { data: prendas } = await supabase
    .from("prendas")
    .select("id, nombre, color_principal, imagen_url, is_favorite, category_id, subcategory_id, estaciones, estilos, ocasiones, estado, notas, etiquetas, ia_analizada, ia_descripcion, deleted_at, created_at, updated_at, user_id")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("is_favorite", { ascending: false })
    .order("nombre");

  const prendasConUrl = ((prendas ?? []) as Prenda[]).map((p) => ({
    ...p,
    signedUrl: garmentImageUrl(p.id, p.imagen_url),
  }));

  // Género del perfil
  const { data: profile } = await supabase
    .from("profiles")
    .select("genero")
    .eq("id", user.id)
    .single();

  return (
    <NuevoViajeClient
      prendas={prendasConUrl}
      genero={profile?.genero ?? null}
    />
  );
}
