import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Prenda, Category } from "@/lib/database.types";
import { GarmentDetailClient } from "@/components/features/wardrobe/GarmentDetailClient";

export const dynamic = "force-dynamic";

type GarmentWithMeta = Prenda & {
  signedUrl: string | null;
  category: Pick<Category, "nombre" | "slug"> | null;
};

/**
 * LOOKSI-010: Detalle de prenda — Handoff 11
 * Server Component: fetch prenda + categoría + signed URL.
 * Pasa todo al cliente para interactividad (favorito, eliminar).
 */
export default async function GarmentDetailPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { id } = await params;

  // Prenda + categoría join
  const { data: row, error } = await supabase
    .from("prendas")
    .select("*, category:categories(nombre, slug)")
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();

  if (error || !row) notFound();

  const prenda = row as GarmentWithMeta;

  // Signed URL
  let signedUrl: string | null = null;
  if (prenda.imagen_url) {
    const { data: signed } = await supabase.storage
      .from("prendas")
      .createSignedUrl(prenda.imagen_url, 3600);
    signedUrl = signed?.signedUrl ?? null;
  }

  return (
    <GarmentDetailClient
      garment={{ ...prenda, signedUrl }}
    />
  );
}
