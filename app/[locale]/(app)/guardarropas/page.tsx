import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Category, Prenda } from "@/lib/database.types";
import { WardrobeClient } from "@/components/features/wardrobe/WardrobeClient";

export const dynamic = "force-dynamic"; // filtros via searchParams → no cache estático

const PAGE_SIZE = 20;

/**
 * PERCHA-008: Listado del guardarropas.
 * Server Component: lee filtros de searchParams, fetcha primera página y categorías,
 * genera URLs firmadas en batch, y pasa todo al cliente para interacción.
 */
export default async function GuardarropaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const supabase = await createClient();

  // Safety net: el proxy redirige antes, pero verificamos igual
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // ── Filtros desde URL ────────────────────────────────────────────────────
  const sp = await searchParams;
  const q           = sp.q        ?? "";
  const categorySlug = sp.category ?? "";
  const season      = sp.season   ?? "";
  const occasion    = sp.occasion ?? "";
  const favorites   = sp.favorites === "1";

  // ── Categorías (para chips de filtro) ───────────────────────────────────
  const { data: categoriesData } = await supabase
    .from("categories")
    .select("id, nombre, slug")
    .order("nombre");
  const categories = (categoriesData ?? []) as Category[];

  // ── Resolver slug → category_id ─────────────────────────────────────────
  const activeCategoryId = categorySlug
    ? (categories.find((c) => c.slug === categorySlug)?.id ?? null)
    : null;

  // ── Query de prendas ─────────────────────────────────────────────────────
  let query = supabase
    .from("prendas")
    .select("*", { count: "exact" })
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  if (q) {
    query = query.or(
      `nombre.ilike.%${q}%,color_principal.ilike.%${q}%,notas.ilike.%${q}%`
    );
  }
  if (activeCategoryId) query = query.eq("category_id", activeCategoryId);
  if (season)           query = query.contains("estaciones", [season]);
  if (occasion)         query = query.contains("ocasiones", [occasion]);
  if (favorites)        query = query.eq("is_favorite", true);

  const [{ data: garmentsData, count }, { count: totalAllCount }] = await Promise.all([
    query,
    supabase
      .from("prendas")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("deleted_at", null),
  ]);
  const garments = (garmentsData ?? []) as Prenda[];
  const total    = count ?? 0;
  const totalAll = totalAllCount ?? 0;

  // ── key para forzar remount del cliente al cambiar filtros ───────────────
  const filterKey = [q, categorySlug, season, occasion, String(favorites)].join("|");

  return (
    <WardrobeClient
      key={filterKey}
      initialGarments={garments}
      categories={categories}
      total={total}
      totalAll={totalAll}
      pageSize={PAGE_SIZE}
      filters={{ q, category: categorySlug, season, occasion, favorites }}
    />
  );
}
