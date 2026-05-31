import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Luggage } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ESTADO_CONFIG, EVENTO_CONFIG, type TipoEvento } from "@/lib/viajes/constants";
import { cn } from "@/lib/cn";

interface ViajeListItem {
  id:                string;
  nombre:            string;
  fecha_inicio:      string;
  fecha_fin:         string;
  modo_optimizacion: string;
  estado:            string;
  destinos:          { ciudad: string; pais: string; orden: number }[];
  viaje_eventos:     { tipo: TipoEvento; cantidad_looks: number }[];
  viaje_looks:       { id: string }[];
}

function formatMesYear(fecha: string) {
  const d = new Date(fecha + "T12:00:00");
  return d.toLocaleString("es-AR", { month: "long", year: "numeric" });
}

function formatRange(inicio: string, fin: string) {
  const fi = new Date(inicio + "T12:00:00");
  const ff = new Date(fin    + "T12:00:00");
  const di = fi.getDate();
  const df = ff.getDate();
  const mi = fi.toLocaleString("es-AR", { month: "short" });
  const mf = ff.toLocaleString("es-AR", { month: "short" });
  const y  = ff.getFullYear();
  if (fi.getMonth() === ff.getMonth() && fi.getFullYear() === ff.getFullYear()) {
    return `${di}–${df} ${mi} ${y}`;
  }
  return `${di} ${mi} – ${df} ${mf} ${y}`;
}

export default async function ViajesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: raw } = await supabase
    .from("viajes")
    .select(`
      id, nombre, fecha_inicio, fecha_fin, modo_optimizacion, estado,
      destinos ( ciudad, pais, orden ),
      viaje_eventos ( tipo, cantidad_looks ),
      viaje_looks ( id )
    `)
    .eq("user_id", user.id)
    .order("fecha_inicio", { ascending: false });

  const viajes = (raw ?? []) as unknown as ViajeListItem[];

  // Agrupar por mes/año de inicio
  const groups: Record<string, ViajeListItem[]> = {};
  for (const v of viajes) {
    const key = formatMesYear(v.fecha_inicio);
    if (!groups[key]) groups[key] = [];
    groups[key]!.push(v);
  }

  const empty = viajes.length === 0;

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display font-bold text-2xl text-ink">Viajes</h1>
        <Link
          href="/viajes/nuevo"
          className={cn(
            "inline-flex items-center gap-1.5 px-4 h-9 rounded-button text-sm font-medium",
            "bg-accent text-accent-ink hover:bg-sage-700 dark:hover:bg-sage-300 transition-colors"
          )}
        >
          <Plus className="size-4" />
          Nuevo
        </Link>
      </div>

      {empty ? (
        <div className="flex flex-col items-center gap-4 pt-20 text-center">
          <Luggage className="size-12 text-ink-3" strokeWidth={1.2} />
          <div>
            <p className="font-medium text-ink mb-1">Aún no tenés viajes</p>
            <p className="text-sm text-ink-3">Creá uno para armar tu maleta con IA.</p>
          </div>
          <Link
            href="/viajes/nuevo"
            className={cn(
              "mt-2 inline-flex items-center gap-2 px-6 h-11 rounded-button text-sm font-medium",
              "bg-accent text-accent-ink hover:bg-sage-700 dark:hover:bg-sage-300 transition-colors"
            )}
          >
            <Plus className="size-4" />
            Crear primer viaje
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groups).map(([mes, items]) => (
            <section key={mes}>
              <p className="text-xs font-medium uppercase tracking-wider text-ink-3 mb-3 capitalize">
                {mes}
              </p>
              <div className="space-y-3">
                {items.map((v) => {
                  const destinos = [...v.destinos]
                    .sort((a, b) => a.orden - b.orden)
                    .map((d) => d.ciudad)
                    .join(" → ");

                  const totalLooks = v.viaje_looks.length;
                  const estado     = ESTADO_CONFIG[v.estado as keyof typeof ESTADO_CONFIG];

                  return (
                    <Link
                      key={v.id}
                      href={`/viajes/${v.id}`}
                      className="block rounded-button border border-line-2 p-4 hover:border-ink-2 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="font-medium text-ink text-sm leading-snug">{v.nombre}</p>
                        <span className={cn("text-xs font-medium shrink-0", estado?.color)}>
                          {estado?.label}
                        </span>
                      </div>

                      <p className="text-xs text-ink-3 mb-2">{destinos}</p>
                      <p className="text-xs text-ink-3 mb-3">{formatRange(v.fecha_inicio, v.fecha_fin)}</p>

                      <div className="flex items-center justify-between">
                        <div className="flex gap-1">
                          {v.viaje_eventos.map((e) => (
                            <span key={e.tipo} title={e.tipo} className="text-base leading-none">
                              {EVENTO_CONFIG[e.tipo]?.emoji}
                            </span>
                          ))}
                        </div>
                        <span className="text-xs text-ink-3">
                          {totalLooks} {totalLooks === 1 ? "look" : "looks"}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
