import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Category, Prenda } from "@/lib/database.types";
import { EditGarmentClient } from "@/components/features/wardrobe/EditGarmentClient";
import { garmentImageUrl } from "@/lib/storage/urls";

export const dynamic = "force-dynamic";

/**
 * PERCHA-011 (LSI-21): Editar prenda
 * Ruta: /guardarropas/[id]/editar
 *
 * Server Component:
 *  1. Auth check → redirect /login
 *  2. Fetcha prenda (verifica propiedad y que no esté borrada)
 *  3. Arma la URL de la imagen actual
 *  4. Fetcha categorías para los chips de tipo
 *  5. Resuelve el slug de la categoría actual
 *  6. Pasa todo al EditGarmentClient
 */
export default async function EditGarmentPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { id } = await params;

  // ── Prenda + categoría ──────────────────────────────────────────────────
  const { data: row, error } = await supabase
    .from("prendas")
    .select("*, category:categories(nombre, slug)")
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();

  if (error || !row) notFound();

  const prenda = row as Prenda & {
    category: { nombre: string; slug: string } | null;
  };

  // ── URL de la imagen actual (proxy con URL estable) ─────────────────────
  const signedUrl = garmentImageUrl(prenda.id, prenda.imagen_url);

  // ── Categorías (para los chips) ─────────────────────────────────────────
  const { data: categoriesData } = await supabase
    .from("categories")
    .select("id, nombre, slug")
    .order("nombre");

  const categories = (categoriesData ?? []) as Category[];

  return (
    <div className="md:max-w-[640px] md:mx-auto md:w-full">
      <EditGarmentClient
        garment={{
          ...prenda,
          signedUrl,
          categorySlug: prenda.category?.slug ?? null,
        }}
        categories={categories}
      />
    </div>
  );
}
