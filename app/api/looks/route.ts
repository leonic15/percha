import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/looks
 *
 * Devuelve todos los looks del usuario autenticado con:
 * - metadatos del look
 * - hasta 4 signed URLs de prendas (collage)
 * - historial de usos (count + fecha más reciente)
 *
 * Usado por LooksHistoryClient para pull-to-refresh sin full page reload.
 *
 * PERCHA-021
 */

export interface LookItemData {
  id: string;
  nombre: string;
  created_at: string;
  garmentImages: string[];   // hasta 4 signed URLs; "" = celda vacía
  usageCount: number;
  lastUsedISO: string | null; // "YYYY-MM-DD" o null
  ocasion: string;            // de parametros_generacion
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_session" }, { status: 401 });

  // ── 1. Traer looks ─────────────────────────────────────────────────────────
  const { data: looksData, error: looksError } = await supabase
    .from("looks")
    .select("id, nombre, parametros_generacion, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (looksError) {
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  const looks = looksData ?? [];
  if (looks.length === 0) return NextResponse.json([]);

  const lookIds = looks.map((l) => l.id);

  // ── 2. look_prendas ────────────────────────────────────────────────────────
  const { data: lpData } = await supabase
    .from("look_prendas")
    .select("look_id, prenda_id")
    .in("look_id", lookIds);

  const prendaIds = [
    ...new Set((lpData ?? []).map((lp) => lp.prenda_id).filter(Boolean)),
  ] as string[];

  // ── 3. Prendas → imagen_url ────────────────────────────────────────────────
  const prendaMap = new Map<string, string | null>();
  if (prendaIds.length > 0) {
    const { data: prendasData } = await supabase
      .from("prendas")
      .select("id, imagen_url")
      .in("id", prendaIds);
    for (const p of prendasData ?? []) {
      prendaMap.set(p.id, (p as { id: string; imagen_url: string | null }).imagen_url);
    }
  }

  // ── 4. Firmar URLs ─────────────────────────────────────────────────────────
  const imagePaths = [...prendaMap.values()].filter(Boolean) as string[];
  const signedMap: Record<string, string> = {};
  if (imagePaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from("prendas")
      .createSignedUrls(imagePaths, 3600);
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) signedMap[s.path] = s.signedUrl;
    }
  }

  // ── 5. look_id → imágenes (hasta 4) ───────────────────────────────────────
  const lookImages: Record<string, string[]> = {};
  for (const lp of lpData ?? []) {
    if (!lp.prenda_id) continue;
    if (!lookImages[lp.look_id]) lookImages[lp.look_id] = [];
    if (lookImages[lp.look_id].length >= 4) continue;
    const imgPath = prendaMap.get(lp.prenda_id) ?? null;
    lookImages[lp.look_id].push(imgPath ? (signedMap[imgPath] ?? "") : "");
  }

  // ── 6. look_usos ──────────────────────────────────────────────────────────
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

  // ── 7. Combinar ────────────────────────────────────────────────────────────
  const result: LookItemData[] = looks.map((l) => {
    const params = (l.parametros_generacion ?? {}) as { ocasion?: string };
    const usos   = lookUsos[l.id] ?? [];
    return {
      id:             l.id,
      nombre:         l.nombre,
      created_at:     l.created_at,
      garmentImages:  lookImages[l.id] ?? [],
      usageCount:     usos.length,
      lastUsedISO:    usos[0] ?? null,
      ocasion:        params.ocasion ?? "",
    };
  });

  return NextResponse.json(result);
}
