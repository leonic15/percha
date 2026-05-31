import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { AiUsageTipo } from "@/lib/database.types";

export const dynamic = "force-dynamic";

const DAILY_LIMITS: Partial<Record<AiUsageTipo, { label: string; max: number }>> = {
  generacion_look:   { label: "Generación de looks",    max: 120 },
  analisis_prenda:   { label: "Análisis de prendas",    max: 200 },
  generacion_imagen: { label: "Imágenes generadas",     max: 5   },
  generacion_viaje:  { label: "Planificación de viajes", max: 40  },
};

export interface UsageBarItem {
  tipo:  AiUsageTipo;
  label: string;
  usado: number;
  max:   number;
}

/**
 * GET /api/perfil/uso-ia
 * Devuelve el uso de IA del usuario en las ventanas diarias (últimas 24 h).
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_session" }, { status: 401 });

  const svc   = createServiceClient();
  const since = new Date(Date.now() - 86_400 * 1000).toISOString();
  const tipos  = Object.keys(DAILY_LIMITS) as AiUsageTipo[];

  const { data: rows } = await svc
    .from("ai_usage")
    .select("tipo")
    .eq("user_id", user.id)
    .in("tipo", tipos)
    .gte("created_at", since);

  const counts: Partial<Record<AiUsageTipo, number>> = {};
  for (const r of rows ?? []) {
    const t = r.tipo as AiUsageTipo;
    counts[t] = (counts[t] ?? 0) + 1;
  }

  const items: UsageBarItem[] = tipos.map((tipo) => ({
    tipo,
    label: DAILY_LIMITS[tipo]!.label,
    usado: counts[tipo] ?? 0,
    max:   DAILY_LIMITS[tipo]!.max,
  }));

  return NextResponse.json({ items });
}
