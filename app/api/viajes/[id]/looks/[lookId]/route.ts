import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * PUT    /api/viajes/[id]/looks/[lookId]  — reemplaza las prendas del look (edición manual)
 * DELETE /api/viajes/[id]/looks/[lookId]  — elimina un look del viaje
 */

type RouteParams = { params: Promise<{ id: string; lookId: string }> };

// ── PUT ───────────────────────────────────────────────────────────────────────

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const { id: viajeId, lookId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_session" }, { status: 401 });

  let body: { nombre?: string; prenda_ids: string[] };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }); }

  // Verificar ownership via viaje
  const { data: look } = await supabase
    .from("viaje_looks")
    .select("id, viaje_id")
    .eq("id", lookId)
    .eq("viaje_id", viajeId)
    .single();

  if (!look) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Verificar que el viaje pertenece al usuario
  const { data: viaje } = await supabase
    .from("viajes")
    .select("id")
    .eq("id", viajeId)
    .eq("user_id", user.id)
    .single();

  if (!viaje) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Reemplazar prendas: delete + insert
  await supabase.from("viaje_look_prendas").delete().eq("viaje_look_id", lookId);

  if (body.prenda_ids?.length) {
    await supabase.from("viaje_look_prendas").insert(
      body.prenda_ids.map((pid) => ({ viaje_look_id: lookId, prenda_id: pid }))
    );
  }

  if (body.nombre) {
    await supabase.from("viaje_looks").update({ nombre: body.nombre }).eq("id", lookId);
  }

  return NextResponse.json({ ok: true });
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id: viajeId, lookId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_session" }, { status: 401 });

  // Verificar ownership via viaje
  const { data: viaje } = await supabase
    .from("viajes")
    .select("id")
    .eq("id", viajeId)
    .eq("user_id", user.id)
    .single();

  if (!viaje) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await supabase.from("viaje_looks").delete().eq("id", lookId).eq("viaje_id", viajeId);

  return NextResponse.json({ ok: true });
}
