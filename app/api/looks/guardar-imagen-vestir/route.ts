import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database.types";
import { logger } from "@/lib/utils/logger";

/**
 * POST /api/looks/guardar-imagen-vestir — LOOKSI-035
 *
 * Asocia una imagen "Vestir mi look" generada previamente con un look.
 * Si el look no existe aún, lo crea primero (auto-save).
 *
 * Body:
 *   look_id?:             string   — UUID del look ya guardado (o null para auto-save)
 *   vestir_imagen_path:   string   — path en Storage (bucket: look-images)
 *   // campos para auto-save (solo si look_id es null):
 *   nombre?:              string
 *   prendas?:             string[]
 *   descripcion_ia?:      string
 *   parametros_generacion? object
 *
 * Respuesta: { look_id: string }
 */

interface Body {
  look_id?:              string | null;
  vestir_imagen_path:    string;
  nombre?:               string;
  prendas?:              string[];
  descripcion_ia?:       string | null;
  parametros_generacion?: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_session" }, { status: 401 });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { vestir_imagen_path } = body;
  if (!vestir_imagen_path) {
    return NextResponse.json({ error: "path_requerido" }, { status: 400 });
  }

  let lookId: string = body.look_id ?? "";

  // ── Auto-save si no hay look_id ───────────────────────────────────────────
  if (!lookId) {
    const nombre    = body.nombre?.trim() || `Look ${new Date().toLocaleDateString("es-AR")}`;
    const prendaIds = body.prendas ?? [];

    if (prendaIds.length === 0) {
      return NextResponse.json({ error: "prendas_requeridas" }, { status: 422 });
    }

    const { data: look, error: lookErr } = await supabase
      .from("looks")
      .insert({
        user_id:               user.id,
        nombre,
        descripcion_ia:        body.descripcion_ia ?? null,
        parametros_generacion: (body.parametros_generacion ?? {}) as Json,
      })
      .select("id")
      .single();

    if (lookErr || !look) {
      logger.error("[guardar-imagen-vestir] Error auto-save look", { endpoint: "looks/guardar-imagen-vestir" }, lookErr instanceof Error ? lookErr : undefined);
      return NextResponse.json({ error: "db_error" }, { status: 500 });
    }

    lookId = look.id;

    // Insertar look_prendas
    const rows = prendaIds.map((pid) => ({ look_id: lookId, prenda_id: pid }));
    const { error: lpErr } = await supabase.from("look_prendas").insert(rows);
    if (lpErr) {
      logger.error("[guardar-imagen-vestir] Error insertando look_prendas", { endpoint: "looks/guardar-imagen-vestir" }, lpErr instanceof Error ? lpErr : undefined);
      await supabase.from("looks").delete().eq("id", lookId);
      return NextResponse.json({ error: "db_error" }, { status: 500 });
    }
  } else {
    // Verificar que el look pertenece al usuario
    const { data: look } = await supabase
      .from("looks")
      .select("id")
      .eq("id", lookId)
      .eq("user_id", user.id)
      .single();
    if (!look) {
      return NextResponse.json({ error: "look_not_found" }, { status: 404 });
    }
  }

  // ── Actualizar vestir_imagen_url ──────────────────────────────────────────
  const { error: updateErr } = await supabase
    .from("looks")
    .update({ vestir_imagen_url: vestir_imagen_path })
    .eq("id", lookId)
    .eq("user_id", user.id);

  if (updateErr) {
    logger.error("[guardar-imagen-vestir] Error actualizando vestir_imagen_url", { endpoint: "looks/guardar-imagen-vestir" }, updateErr instanceof Error ? updateErr : undefined);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  return NextResponse.json({ look_id: lookId });
}
