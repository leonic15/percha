import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
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

// ── Zod schema (H-08) ─────────────────────────────────────────────────────────

const TIPO_EVENTO_VALUES = [
  "trabajo", "playa", "outdoor", "noche", "paseos", "deporte", "formal",
] as const;

const MODO_VALUES = ["maleta_liviana", "estilo_completo"] as const;

const CreateViajeSchema = z.object({
  nombre:            z.string().min(1).max(200),
  fecha_inicio:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "formato YYYY-MM-DD requerido"),
  fecha_fin:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "formato YYYY-MM-DD requerido"),
  modo_optimizacion: z.enum(MODO_VALUES),
  destinos:          z.array(z.object({ ciudad: z.string().min(1).max(100), pais: z.string().min(1).max(100) })).min(1),
  eventos:           z.array(z.object({ tipo: z.enum(TIPO_EVENTO_VALUES), cantidad_looks: z.number().int().min(1).max(30) })),
  estilos:           z.array(z.string()),
  prendas_incluir:   z.array(z.string()),
  prendas_excluir:   z.array(z.string()),
  looks:             z.array(z.object({
    evento:           z.string(),
    nombre_sugerido:  z.string(),
    descripcion_look: z.string(),
    numero_en_evento: z.number().int().min(1),
    prendas:          z.array(z.string()),
    nombre:           z.string().optional(),
  })),
  basicos_sugeridos: z.array(z.object({ tipo_prenda: z.string().min(1).max(100), cantidad: z.number().int().min(1) })),
}).refine(
  (d) => d.fecha_inicio <= d.fecha_fin,
  { message: "fecha_fin debe ser igual o posterior a fecha_inicio", path: ["fecha_fin"] },
);

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

  let rawBody: unknown;
  try { rawBody = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }); }

  // H-08: validación estricta con Zod
  const parsed = CreateViajeSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validacion_fallida", issues: parsed.error.issues },
      { status: 422 },
    );
  }
  const body = parsed.data as CreateViajeBody;

  // H-08: verificar que todos los prenda_id recibidos pertenecen al usuario
  const allPrendaIds = [
    ...body.prendas_incluir,
    ...body.prendas_excluir,
    ...body.looks.flatMap((l) => l.prendas),
  ];
  const uniquePrendaIds = [...new Set(allPrendaIds)].filter(Boolean);

  if (uniquePrendaIds.length > 0) {
    const { data: ownedPrendas, error: pErr } = await supabase
      .from("prendas")
      .select("id")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .in("id", uniquePrendaIds);

    if (pErr) return NextResponse.json({ error: "db_error" }, { status: 500 });

    const ownedSet = new Set((ownedPrendas ?? []).map((p) => p.id));
    const invalid = uniquePrendaIds.filter((id) => !ownedSet.has(id));
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: "prendas_invalidas", message: "Algunas prendas no pertenecen a tu guardarropas." },
        { status: 422 },
      );
    }
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

  // Helper: eliminar el viaje en caso de fallo parcial (CASCADE limpia el resto)
  const rollback = () => supabase.from("viajes").delete().eq("id", viajeId);

  // 2. Destinos
  if (body.destinos.length) {
    const { error: dErr } = await supabase.from("destinos").insert(
      body.destinos.map((d, i) => ({ viaje_id: viajeId, ciudad: d.ciudad, pais: d.pais, orden: i }))
    );
    if (dErr) { await rollback(); return NextResponse.json({ error: "db_error" }, { status: 500 }); }
  }

  // 3. Eventos (y mapear tipo → id para asociar looks)
  const eventoIdMap: Record<string, string> = {};
  if (body.eventos.length) {
    const { data: eventosCreados, error: eErr } = await supabase
      .from("viaje_eventos")
      .insert(body.eventos.map((e) => ({ viaje_id: viajeId, tipo: e.tipo, cantidad_looks: e.cantidad_looks })))
      .select("id, tipo");
    if (eErr) { await rollback(); return NextResponse.json({ error: "db_error" }, { status: 500 }); }
    for (const ev of eventosCreados ?? []) {
      eventoIdMap[ev.tipo] = ev.id;
    }
  }

  // 4. Preferencias de estilos
  if (body.estilos.length) {
    const { error: esErr } = await supabase.from("viaje_preferencias_estilos").insert(
      body.estilos.map((e) => ({ viaje_id: viajeId, estilo: e }))
    );
    if (esErr) { await rollback(); return NextResponse.json({ error: "db_error" }, { status: 500 }); }
  }

  // 5. Preferencias de prendas
  const prefPrendas = [
    ...body.prendas_incluir.map((id) => ({ viaje_id: viajeId, prenda_id: id, tipo: "incluir" as const })),
    ...body.prendas_excluir.map((id) => ({ viaje_id: viajeId, prenda_id: id, tipo: "excluir" as const })),
  ];
  if (prefPrendas.length) {
    const { error: ppErr } = await supabase.from("viaje_preferencias_prendas").insert(prefPrendas);
    if (ppErr) { await rollback(); return NextResponse.json({ error: "db_error" }, { status: 500 }); }
  }

  // 6. Looks y sus prendas — batch para evitar N+1 (perf H-13).
  // Un solo insert de viaje_looks y un solo insert de viaje_look_prendas.
  // PostgREST devuelve las filas insertadas en el mismo orden de entrada,
  // así que correlacionamos look ↔ prendas por índice.
  const validLooks = (body.looks ?? []).filter((l) => eventoIdMap[l.evento]);
  if (validLooks.length) {
    const { data: looksCreados, error: lErr } = await supabase
      .from("viaje_looks")
      .insert(validLooks.map((look) => ({
        viaje_id:         viajeId,
        viaje_evento_id:  eventoIdMap[look.evento]!,
        nombre:           look.nombre ?? look.nombre_sugerido,
        descripcion_ia:   look.descripcion_look,
        numero_en_evento: look.numero_en_evento,
      })))
      .select("id");
    if (lErr) { await rollback(); return NextResponse.json({ error: "db_error" }, { status: 500 }); }

    const lookPrendasRows = (looksCreados ?? []).flatMap((created, i) =>
      (validLooks[i]?.prendas ?? []).map((prenda_id) => ({
        viaje_look_id: created.id,
        prenda_id,
      }))
    );

    if (lookPrendasRows.length) {
      const { error: lpErr } = await supabase.from("viaje_look_prendas").insert(lookPrendasRows);
      if (lpErr) { await rollback(); return NextResponse.json({ error: "db_error" }, { status: 500 }); }
    }
  }

  // 7. Básicos sugeridos
  if (body.basicos_sugeridos?.length) {
    const { error: bErr } = await supabase.from("viaje_basicos_sugeridos").insert(
      body.basicos_sugeridos.map((b) => ({ viaje_id: viajeId, tipo_prenda: b.tipo_prenda, cantidad: b.cantidad }))
    );
    if (bErr) { await rollback(); return NextResponse.json({ error: "db_error" }, { status: 500 }); }
  }

  return NextResponse.json({ id: viajeId }, { status: 201 });
}
