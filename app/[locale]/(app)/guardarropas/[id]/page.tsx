import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Prenda, Category } from "@/lib/database.types";
import { GarmentDetailClient } from "@/components/features/wardrobe/GarmentDetailClient";

export const dynamic = "force-dynamic";

type GarmentWithMeta = Prenda & {
  category: Pick<Category, "nombre" | "slug"> | null;
};

/**
 * LOOKSI-010: Detalle de prenda — Handoff 11
 * Server Component: fetch prenda + categoría.
 * La imagen se sirve vía /api/garments/[id]/image (URL estable, cacheada en SW).
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

  const { data: row, error } = await supabase
    .from("prendas")
    .select("*, category:categories(nombre, slug)")
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();

  if (error || !row) notFound();

  return (
    <GarmentDetailClient garment={row as GarmentWithMeta} />
  );
}
