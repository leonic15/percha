import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database.types";

/**
 * POST /api/looks/guardar
 *
 * Persiste un look generado en la base de datos.
 * Opcionalmente registra una fecha de uso en look_usos.
 *
 * Body:
 *   nombre              string   — requerido
 *   prendas             string[] — IDs validados (pertenecen al usuario)
 *   descripcion_ia?     string
 *   parametros_generacion? object
 *   fecha_uso?          string   — ISO date "YYYY-MM-DD" (opcional)
 *
 * Respuesta 201:
 *   { id: string }  — ID del look creado
 *
 * LOOKSI-020
 */

interface GuardarLookBody {
  nombre:                 string;
  prendas:                string[];
  descripcion_ia?:        string | null;
  parametros_generacion?: Record<string, unknown>;
  fecha_uso?:             string | null;   // "YYYY-MM-DD"
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_session" }, { status: 401 });

  let body: GuardarLookBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  // ── Validación ────────────────────────────────────────────────────────────
  const nombre = body.nombre?.trim();
  if (!nombre) {
    return NextResponse.json(
      { error: "nombre_requerido", message: "El nombre del look es requerido." },
      { status: 422 },
    );
  }

  const prendaIds: string[] = Array.isArray(body.prendas) ? body.prendas : [];
  if (prendaIds.length === 0) {
    return NextResponse.json(
      { error: "prendas_requeridas", message: "El look debe tener al menos una prenda." },
      { status: 422 },
    );
  }

  // Validar fecha_uso si se provee
  let fechaUso: string | null = null;
  if (body.fecha_uso) {
    const parsed = new Date(body.fecha_uso);
    if (isNaN(parsed.getTime())) {
      return NextResponse.json(
        { error: "fecha_invalida", message: "La fecha de uso no es válida." },
        { status: 422 },
      );
    }
    // Las fechas futuras son válidas — el look queda como "planificado"
    fechaUso = body.fecha_uso.slice(0, 10); // asegurar formato YYYY-MM-DD
  }

  // ── Verificar que las prendas pertenecen al usuario ───────────────────────
  const { data: ownedPrendas, error: pError } = await supabase
    .from("prendas")
    .select("id")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .in("id", prendaIds);

  if (pError) {
    console.error("[looks/guardar] DB error verificando prendas:", pError);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  const ownedIds = new Set((ownedPrendas ?? []).map((p) => p.id));
  const invalidIds = prendaIds.filter((id) => !ownedIds.has(id));
  if (invalidIds.length > 0) {
    return NextResponse.json(
      { error: "prendas_invalidas", message: "Algunas prendas no pertenecen a tu guardarropas." },
      { status: 422 },
    );
  }

  // ── Insertar look ─────────────────────────────────────────────────────────
  const { data: look, error: lookError } = await supabase
    .from("looks")
    .insert({
      user_id:               user.id,
      nombre,
      descripcion_ia:        body.descripcion_ia ?? null,
      parametros_generacion: (body.parametros_generacion ?? {}) as Json,
    })
    .select("id")
    .single();

  if (lookError || !look) {
    console.error("[looks/guardar] DB error insertando look:", lookError);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  // ── Insertar look_prendas ─────────────────────────────────────────────────
  const lookPrendasRows = prendaIds.map((prendaId) => ({
    look_id:  look.id,
    prenda_id: prendaId,
  }));

  const { error: lpError } = await supabase
    .from("look_prendas")
    .insert(lookPrendasRows);

  if (lpError) {
    console.error("[looks/guardar] DB error insertando look_prendas:", lpError);
    // Roll back el look
    await supabase.from("looks").delete().eq("id", look.id);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  // ── Registrar fecha de uso (si se proveyó) ────────────────────────────────
  if (fechaUso) {
    const { error: usoError } = await supabase
      .from("look_usos")
      .insert({ look_id: look.id, fecha_uso: fechaUso });

    if (usoError) {
      // No fatal — el look ya fue guardado. Solo loguear.
      console.error("[looks/guardar] Error registrando look_uso:", usoError);
    }
  }

  return NextResponse.json({ id: look.id }, { status: 201 });
}
