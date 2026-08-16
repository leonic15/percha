import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LooksHistoryClient } from "@/components/features/looks/LooksHistoryClient";
import type { LookItemData } from "@/app/api/looks/route";
import { garmentImageUrl } from "@/lib/storage/urls";

export const dynamic = "force-dynamic";

/**
 * PERCHA-021: Historial de looks guardados.
 *
 * Server Component: fetcha todos los looks del usuario con prendas y usos,
 * y pasa los datos al cliente para filtrado interactivo.
 *
 * Ruta: /looks (Handoff 15)
 */
export default async function LooksPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // ── 1. Looks ────────────────────────────────────────────────────────────────
  const { data: looksData, error: looksError } = await supabase
    .from("looks")
    .select("id, nombre, parametros_generacion, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (looksError) {
    return <LooksHistoryClient initialLooks={[]} initialError />;
  }

  const looks = looksData ?? [];

  if (looks.length === 0) {
    return <LooksHistoryClient initialLooks={[]} />;
  }

  const lookIds = looks.map((l) => l.id);

  // ── 2. look_prendas ─────────────────────────────────────────────────────────
  const { data: lpData } = await supabase
    .from("look_prendas")
    .select("look_id, prenda_id")
    .in("look_id", lookIds);

  const prendaIds = [
    ...new Set((lpData ?? []).map((lp) => lp.prenda_id).filter(Boolean)),
  ] as string[];

  // ── 3. Prendas → imagen_url ─────────────────────────────────────────────────
  const prendaMap = new Map<string, string | null>();
  if (prendaIds.length > 0) {
    const { data: prendasData } = await supabase
      .from("prendas")
      .select("id, imagen_url")
      .in("id", prendaIds);
    for (const p of prendasData ?? []) {
      prendaMap.set(
        (p as { id: string; imagen_url: string | null }).id,
        (p as { id: string; imagen_url: string | null }).imagen_url,
      );
    }
  }

  // ── 4. look_id → imágenes (hasta 4) ────────────────────────────────────────
  const lookImages: Record<string, string[]> = {};
  for (const lp of lpData ?? []) {
    if (!lp.prenda_id) continue;
    if (!lookImages[lp.look_id]) lookImages[lp.look_id] = [];
    if (lookImages[lp.look_id].length >= 4) continue;
    const imgPath = prendaMap.get(lp.prenda_id) ?? null;
    lookImages[lp.look_id].push(garmentImageUrl(lp.prenda_id, imgPath) ?? "");
  }

  // ── 5. look_usos ────────────────────────────────────────────────────────────
  const { data: usosData } = await supabase
    .from("look_usos")
    .select("look_id, fecha_uso")
    .in("look_id", lookIds)
    .order("fecha_uso", { ascending: false });

  const lookUsos: Record<string, string[]> = {};
  for (const uso of usosData ?? []) {
    if (!lookUsos[uso.look_id]) lookUsos[uso.look_id] = [];
    lookUsos[uso.look_id].push(uso.fecha_uso);
  }

  // ── 6. Combinar ─────────────────────────────────────────────────────────────
  const initialLooks: LookItemData[] = looks.map((l) => {
    const params = (l.parametros_generacion ?? {}) as { ocasion?: string };
    const usos   = lookUsos[l.id] ?? [];
    return {
      id:            l.id,
      nombre:        l.nombre,
      created_at:    l.created_at,
      garmentImages: lookImages[l.id] ?? [],
      usageCount:    usos.length,
      lastUsedISO:   usos[0] ?? null,
      ocasion:       params.ocasion ?? "",
    };
  });

  return <LooksHistoryClient initialLooks={initialLooks} />;
}
