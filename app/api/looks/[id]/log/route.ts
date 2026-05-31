import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/utils/logger";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/looks/[id]/log
 *
 * Registra la fecha de hoy como uso del look ("Usar hoy").
 * Si ya existe un registro para hoy, devuelve 200 sin duplicar.
 *
 * Respuesta 200: { usageCount: number; lastUsedISO: string }
 *
 * LOOKSI-021
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_session" }, { status: 401 });

  // Verificar ownership
  const { data: look } = await supabase
    .from("looks")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!look) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const today = new Date().toISOString().slice(0, 10);

  // Evitar duplicado para hoy
  const { data: existing } = await supabase
    .from("look_usos")
    .select("id")
    .eq("look_id", id)
    .eq("fecha_uso", today)
    .maybeSingle();

  if (!existing) {
    const { error } = await supabase
      .from("look_usos")
      .insert({ look_id: id, fecha_uso: today });

    if (error) {
      logger.error("[looks/log] DB error", { endpoint: "looks/[id]/log" }, error instanceof Error ? error : undefined);
      return NextResponse.json({ error: "db_error" }, { status: 500 });
    }
  }

  // Devolver conteo actualizado
  const { count } = await supabase
    .from("look_usos")
    .select("id", { count: "exact", head: true })
    .eq("look_id", id);

  return NextResponse.json({
    usageCount:  count ?? 0,
    lastUsedISO: today,
  });
}
