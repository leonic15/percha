import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { TipoEvento } from "@/lib/viajes/constants";

/**
 * GET    /api/viajes/[id]  — detalle completo del viaje con looks y prendas
 * PATCH  /api/viajes/[id]  — actualiza nombre o estado
 * DELETE /api/viajes/[id]  — elimina el viaje (cascade en DB)
 */

interface RawViajeLookPrenda { prenda_id: string }
interface RawViajeLook {
  id: string;
  nombre: string;
  descripcion_ia: string | null;
  numero_en_evento: number;
  viaje_evento_id: string;
  viaje_look_prendas: RawViajeLookPrenda[];
}
interface RawViaje {
  id: string;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  modo_optimizacion: string;
  estado: string;
  created_at: string;
  destinos: { id: string; ciudad: string; pais: string; orden: number }[];
  viaje_eventos: { id: string; tipo: TipoEvento; cantidad_looks: number }[];
  viaje_looks: RawViajeLook[];
  viaje_basicos_sugeridos: { id: string; tipo_prenda: string; cantidad: number }[];
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_session" }, { status: 401 });

  const { data: raw, error } = await supabase
    .from("viajes")
    .select(`
      id, nombre, fecha_inicio, fecha_fin, modo_optimizacion, estado, created_at,
      destinos ( id, ciudad, pais, orden ),
      viaje_eventos ( id, tipo, cantidad_looks ),
      viaje_looks (
        id, nombre, descripcion_ia, numero_en_evento, viaje_evento_id,
        viaje_look_prendas ( prenda_id )
      ),
      viaje_basicos_sugeridos ( id, tipo_prenda, cantidad )
    `)
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !raw) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const viaje = raw as unknown as RawViaje;

  // Recopilar todos los prenda_ids para firmar URLs
  const prendaIds = new Set<string>();
  for (const look of viaje.viaje_looks) {
    for (const lp of look.viaje_look_prendas) {
      prendaIds.add(lp.prenda_id);
    }
  }

  // Traer datos y URLs de las prendas
  const prendasMap: Record<string, { nombre: string; categoria: string; color: string; signedUrl: string | null }> = {};
  if (prendaIds.size) {
    const { data: prendas } = await supabase
      .from("prendas")
      .select("id, nombre, color_principal, imagen_url, category_id")
      .in("id", [...prendaIds]);

    const catIds = [...new Set((prendas ?? []).map((p) => p.category_id).filter(Boolean))] as number[];
    const catMap: Record<number, string> = {};
    if (catIds.length) {
      const { data: cats } = await supabase.from("categories").select("id, nombre").in("id", catIds);
      for (const c of (cats ?? []) as { id: number; nombre: string }[]) catMap[c.id] = c.nombre;
    }

    const imagePaths = (prendas ?? []).map((p) => p.imagen_url).filter(Boolean) as string[];
    const signedMap: Record<string, string> = {};
    if (imagePaths.length) {
      const { data: signed } = await supabase.storage.from("prendas").createSignedUrls(imagePaths, 3600);
      for (const s of (signed ?? [])) {
        if (s.path && s.signedUrl) signedMap[s.path] = s.signedUrl;
      }
    }

    for (const p of (prendas ?? [])) {
      prendasMap[p.id] = {
        nombre:    p.nombre,
        categoria: p.category_id ? (catMap[p.category_id] ?? "Otro") : "Otro",
        color:     p.color_principal ?? "neutro",
        signedUrl: p.imagen_url ? (signedMap[p.imagen_url] ?? null) : null,
      };
    }
  }

  // Enriquecer looks con datos de prendas
  const looks = viaje.viaje_looks.map((look) => ({
    ...look,
    prendas_data: look.viaje_look_prendas.map((lp) => ({
      prenda_id: lp.prenda_id,
      ...(prendasMap[lp.prenda_id] ?? { nombre: "Prenda", categoria: "", color: "", signedUrl: null }),
    })),
  }));

  return NextResponse.json({ ...viaje, viaje_looks: looks });
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_session" }, { status: 401 });

  let body: { nombre?: string; estado?: "borrador" | "listo" | "en_viaje" | "completado" };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }); }

  const { error } = await supabase
    .from("viajes")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: "db_error" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_session" }, { status: 401 });

  const { error } = await supabase
    .from("viajes")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: "db_error" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
