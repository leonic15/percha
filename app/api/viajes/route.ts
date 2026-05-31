import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { TipoEvento, ModoOptimizacion } from "@/lib/viajes/constants";
import type { GeneratedViajeLook } from "./generar-looks/route";
import type { BasicoSugerido } from "@/lib/viajes/basicos";

/**
 * GET  /api/viajes  — lista de viajes del usuario (con destinos)
 * POST /api/viajes  — crea un viaje con todos sus datos en una transacción
 */

// ── Tipos de entrada para crear viaje ─────────────────────────────────────────

export interface DestinoInput {
  ciudad: string;
  pais:   string;
}

export interface EventoInput {
  tipo:           TipoEvento;
  cantidad_looks: number;
}

export interface CreateViajeBody {
  nombre:            string;
  fecha_inicio:      string;
  fecha_fin:         string;
  modo_optimizacion: ModoOptimizacion;
  destinos:          DestinoInput[];
  eventos:           EventoInput[];
  estilos:           string[];
  prendas_incluir:   string[];
  prendas_excluir:   string[];
  looks:             (GeneratedViajeLook & { nombre: string })[];
  basicos_sugeridos: BasicoSugerido[];
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_session" }, { status: 401 });

  const { data, error } = await supabase
    .from("viajes")
    .select(`
      id, nombre, fecha_inicio, fecha_fin, modo_optimizacion, estado, created_at,
      destinos ( ciudad, pais, orden ),
      viaje_eventos ( tipo, cantidad_looks ),
      viaje_looks ( id )
    `)
    .eq("user_id", user.id)
    .order("fecha_inicio", { ascending: false });

  if (error) return NextResponse.json({ error: "db_error" }, { status: 500 });

  return NextResponse.json({ viajes: data });
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_session" }, { status: 401 });

  let body: CreateViajeBody;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }); }

  if (!body.nombre || !body.fecha_inicio || !body.fecha_fin || !body.destinos?.length) {
    return NextResponse.json({ error: "campos_requeridos" }, { status: 400 });
  }

  // 1. Crear viaje
  const { data: viaje, error: vErr } = await supabase
    .from("viajes")
    .insert({
      user_id:           user.id,
      nombre:            body.nombre,
      fecha_inicio:      body.fecha_inicio,
      fecha_fin:         body.fecha_fin,
      modo_optimizacion: body.modo_optimizacion,
      estado:            "listo",
    })
    .select("id")
    .single();

  if (vErr || !viaje) return NextResponse.json({ error: "db_error" }, { status: 500 });

  const viajeId = viaje.id;

  // 2. Destinos
  if (body.destinos.length) {
    await supabase.from("destinos").insert(
      body.destinos.map((d, i) => ({ viaje_id: viajeId, ciudad: d.ciudad, pais: d.pais, orden: i }))
    );
  }

  // 3. Eventos (y mapear tipo → id para asociar looks)
  const eventoIdMap: Record<string, string> = {};
  if (body.eventos.length) {
    const { data: eventosCreados } = await supabase
      .from("viaje_eventos")
      .insert(body.eventos.map((e) => ({ viaje_id: viajeId, tipo: e.tipo, cantidad_looks: e.cantidad_looks })))
      .select("id, tipo");
    for (const ev of eventosCreados ?? []) {
      eventoIdMap[ev.tipo] = ev.id;
    }
  }

  // 4. Preferencias de estilos
  if (body.estilos.length) {
    await supabase.from("viaje_preferencias_estilos").insert(
      body.estilos.map((e) => ({ viaje_id: viajeId, estilo: e }))
    );
  }

  // 5. Preferencias de prendas
  const prefPrendas = [
    ...body.prendas_incluir.map((id) => ({ viaje_id: viajeId, prenda_id: id, tipo: "incluir" as const })),
    ...body.prendas_excluir.map((id) => ({ viaje_id: viajeId, prenda_id: id, tipo: "excluir" as const })),
  ];
  if (prefPrendas.length) {
    await supabase.from("viaje_preferencias_prendas").insert(prefPrendas);
  }

  // 6. Looks y sus prendas
  for (const look of body.looks ?? []) {
    const eventoId = eventoIdMap[look.evento];
    if (!eventoId) continue;

    const { data: lookCreado } = await supabase
      .from("viaje_looks")
      .insert({
        viaje_id:        viajeId,
        viaje_evento_id: eventoId,
        nombre:          look.nombre ?? look.nombre_sugerido,
        descripcion_ia:  look.descripcion_look,
        numero_en_evento: look.numero_en_evento,
      })
      .select("id")
      .single();

    if (lookCreado && look.prendas?.length) {
      await supabase.from("viaje_look_prendas").insert(
        look.prendas.map((pId) => ({ viaje_look_id: lookCreado.id, prenda_id: pId }))
      );
    }
  }

  // 7. Básicos sugeridos
  if (body.basicos_sugeridos?.length) {
    await supabase.from("viaje_basicos_sugeridos").insert(
      body.basicos_sugeridos.map((b) => ({ viaje_id: viajeId, tipo_prenda: b.tipo_prenda, cantidad: b.cantidad }))
    );
  }

  return NextResponse.json({ id: viajeId }, { status: 201 });
}
