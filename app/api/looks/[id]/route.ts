import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/utils/logger";
import { createClient } from "@/lib/supabase/server";
import { garmentImageUrl, storageImageUrl } from "@/lib/storage/urls";

// ── Tipos públicos ─────────────────────────────────────────────────────────────

export interface PiezaData {
  id: string;
  nombre: string;
  categoria: string;
  signedUrl: string | null;
  eliminada: boolean;
}

export interface LookDetailData {
  id: string;
  nombre: string;
  descripcion_ia: string | null;
  ocasion: string;
  contexto: string;
  created_at: string;
  piezas: PiezaData[];
  heroImages: string[];   // hasta 4 signed URLs para el collage
  usageCount: number;
  lastUsedISO: string | null;
  vestir_imagen_url: string | null;  // signed URL, null si no hay imagen generada
}

// ── GET /api/looks/[id] ────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_session" }, { status: 401 });

  // ── Look ───────────────────────────────────────────────────────────────────
  const { data: look, error: lookErr } = await supabase
    .from("looks")
    .select("id, nombre, descripcion_ia, parametros_generacion, created_at, vestir_imagen_url")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (lookErr || !look) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // ── look_prendas con prenda ────────────────────────────────────────────────
  const { data: lpData } = await supabase
    .from("look_prendas")
    .select("prenda_id, prenda_eliminada")
    .eq("look_id", id)
    .order("id");

  const validPrendaIds = (lpData ?? [])
    .map((lp) => lp.prenda_id)
    .filter(Boolean) as string[];

  // ── Prendas ────────────────────────────────────────────────────────────────
  const prendaMap = new Map<string, { nombre: string; categoria: string; imagen_url: string | null }>();
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

  // ── Piezas resultado ───────────────────────────────────────────────────────
  const piezas: PiezaData[] = (lpData ?? []).map((lp) => {
    if (!lp.prenda_id || lp.prenda_eliminada) {
      return { id: lp.prenda_id ?? "", nombre: "Prenda eliminada", categoria: "", signedUrl: null, eliminada: true };
    }
    const p = prendaMap.get(lp.prenda_id);
    if (!p) {
      return { id: lp.prenda_id, nombre: "Prenda eliminada", categoria: "", signedUrl: null, eliminada: true };
    }
    const signedUrl = garmentImageUrl(lp.prenda_id, p.imagen_url);
    return { id: lp.prenda_id, nombre: p.nombre, categoria: p.categoria, signedUrl, eliminada: false };
  });

  // ── Hero collage (primeras 4 piezas no eliminadas con imagen) ──────────────
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

  // ── Parámetros ─────────────────────────────────────────────────────────────
  const params2 = (look.parametros_generacion ?? {}) as { ocasion?: string; contexto?: string };

  // ── URL de vestir (bucket: look-images) ────────────────────────────────────
  const vestirPath = (look as { vestir_imagen_url?: string | null }).vestir_imagen_url ?? null;
  const vestirSignedUrl = storageImageUrl("look-images", vestirPath);

  const result: LookDetailData = {
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

  return NextResponse.json(result);
}

// ── DELETE /api/looks/[id] ─────────────────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_session" }, { status: 401 });

  // Verificar ownership antes de borrar
  const { data: look } = await supabase
    .from("looks")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!look) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Borrar en cascada: look_usos, look_prendas, look (la DB tiene ON DELETE CASCADE)
  const { error } = await supabase.from("looks").delete().eq("id", id);

  if (error) {
    logger.error("[looks/delete] DB error", { endpoint: "looks/[id]" }, error instanceof Error ? error : undefined);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
