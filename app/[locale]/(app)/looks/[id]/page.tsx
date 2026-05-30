import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LookDetailClient } from "@/components/features/looks/LookDetailClient";
import type { LookDetailData } from "@/app/api/looks/[id]/route";

export const dynamic = "force-dynamic";

/**
 * LOOKSI-021: Detalle de un look guardado.
 * Ruta: /looks/[id]  — Handoff 16 + 17
 */
export default async function LookDetailPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // ── Look ───────────────────────────────────────────────────────────────────
  const { data: look, error: lookErr } = await supabase
    .from("looks")
    .select("id, nombre, descripcion_ia, parametros_generacion, created_at, vestir_imagen_url")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (lookErr || !look) notFound();

  // ── look_prendas ───────────────────────────────────────────────────────────
  const { data: lpData } = await supabase
    .from("look_prendas")
    .select("prenda_id, prenda_eliminada")
    .eq("look_id", id)
    .order("id");

  const validPrendaIds = (lpData ?? [])
    .map((lp) => lp.prenda_id)
    .filter(Boolean) as string[];

  // ── Prendas ────────────────────────────────────────────────────────────────
  const prendaMap = new Map<
    string,
    { nombre: string; categoria: string; imagen_url: string | null }
  >();

  if (validPrendaIds.length > 0) {
    const { data: prendas } = await supabase
      .from("prendas")
      .select("id, nombre, imagen_url, categories!inner(nombre)")
      .in("id", validPrendaIds);

    for (const p of prendas ?? []) {
      const row = p as {
        id: string;
        nombre: string;
        imagen_url: string | null;
        categories: { nombre: string } | null;
      };
      prendaMap.set(row.id, {
        nombre:     row.nombre,
        categoria:  row.categories?.nombre ?? "",
        imagen_url: row.imagen_url,
      });
    }
  }

  // ── Firmar URLs en batch ───────────────────────────────────────────────────
  const imagePaths = [...prendaMap.values()]
    .map((p) => p.imagen_url)
    .filter(Boolean) as string[];
  const signedMap: Record<string, string> = {};
  if (imagePaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from("prendas")
      .createSignedUrls(imagePaths, 3600);
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) signedMap[s.path] = s.signedUrl;
    }
  }

  // ── Piezas ─────────────────────────────────────────────────────────────────
  const piezas = (lpData ?? []).map((lp) => {
    if (!lp.prenda_id || lp.prenda_eliminada) {
      return { id: lp.prenda_id ?? "", nombre: "Prenda eliminada", categoria: "", signedUrl: null, eliminada: true };
    }
    const p = prendaMap.get(lp.prenda_id);
    if (!p) {
      return { id: lp.prenda_id, nombre: "Prenda eliminada", categoria: "", signedUrl: null, eliminada: true };
    }
    return {
      id:        lp.prenda_id,
      nombre:    p.nombre,
      categoria: p.categoria,
      signedUrl: p.imagen_url ? (signedMap[p.imagen_url] ?? null) : null,
      eliminada: false,
    };
  });

  // ── Hero collage ───────────────────────────────────────────────────────────
  const heroImages = piezas
    .filter((p) => !p.eliminada && p.signedUrl)
    .slice(0, 4)
    .map((p) => p.signedUrl as string);

  // ── look_usos ──────────────────────────────────────────────────────────────
  const { data: usosData } = await supabase
    .from("look_usos")
    .select("fecha_uso")
    .eq("look_id", id)
    .order("fecha_uso", { ascending: false });

  const usos = usosData ?? [];
  const params2 = (look.parametros_generacion ?? {}) as {
    ocasion?: string;
    contexto?: string;
  };

  // ── Firmar URL de vestir (bucket: look-images) ─────────────────────────────
  let vestirSignedUrl: string | null = null;
  const vestirPath = (look as { vestir_imagen_url?: string | null }).vestir_imagen_url ?? null;
  if (vestirPath) {
    const { data: vs } = await supabase.storage
      .from("look-images")
      .createSignedUrl(vestirPath, 3600);
    vestirSignedUrl = vs?.signedUrl ?? null;
  }

  const detail: LookDetailData = {
    id:                look.id,
    nombre:            look.nombre,
    descripcion_ia:    look.descripcion_ia,
    ocasion:           params2.ocasion ?? "",
    contexto:          params2.contexto ?? "",
    created_at:        look.created_at,
    piezas,
    heroImages,
    usageCount:        usos.length,
    lastUsedISO:       usos[0]?.fecha_uso ?? null,
    vestir_imagen_url: vestirSignedUrl,
  };

  return <LookDetailClient detail={detail} />;
}
