import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
    .select("id, nombre, descripcion_ia, parametros_generacion, created_at")
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

  // ── Firmar URLs ────────────────────────────────────────────────────────────
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

  // ── Piezas resultado ───────────────────────────────────────────────────────
  const piezas: PiezaData[] = (lpData ?? []).map((lp) => {
    if (!lp.prenda_id || lp.prenda_eliminada) {
      return { id: lp.prenda_id ?? "", nombre: "Prenda eliminada", categoria: "", signedUrl: null, eliminada: true };
    }
    const p = prendaMap.get(lp.prenda_id);
    if (!p) {
      return { id: lp.prenda_id, nombre: "Prenda eliminada", categoria: "", signedUrl: null, eliminada: true };
    }
    const signedUrl = p.imagen_url ? (signedMap[p.imagen_url] ?? null) : null;
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

  const result: LookDetailData = {
    id:             look.id,
    nombre:         look.nombre,
    descripcion_ia: look.descripcion_ia,
    ocasion:        params2.ocasion ?? "",
    contexto:       params2.contexto ?? "",
    created_at:     look.created_at,
    piezas,
    heroImages,
    usageCount:     usos.length,
    lastUsedISO:    usos[0]?.fecha_uso ?? null,
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
    console.error("[looks/delete] DB error:", error);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
