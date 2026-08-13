"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft, Luggage, MoreVertical, Trash2, Play, CheckCircle2, Loader2
} from "lucide-react";
import { cn } from "@/lib/cn";
import { EVENTO_CONFIG, ESTADO_CONFIG, MODO_CONFIG, type TipoEvento } from "@/lib/viajes/constants";

// ── Tipos de la respuesta del API ──────────────────────────────────────────────

interface PrendaData {
  prenda_id: string;
  nombre:    string;
  categoria: string;
  color:     string;
  signedUrl: string | null;
}

interface ViajeLoock {
  id:               string;
  nombre:           string;
  descripcion_ia:   string | null;
  numero_en_evento: number;
  viaje_evento_id:  string;
  prendas_data:     PrendaData[];
}

interface ViajeDetalle {
  id:                string;
  nombre:            string;
  fecha_inicio:      string;
  fecha_fin:         string;
  modo_optimizacion: "maleta_liviana" | "estilo_completo";
  estado:            string;
  destinos:          { id: string; ciudad: string; pais: string; orden: number }[];
  viaje_eventos:     { id: string; tipo: TipoEvento; cantidad_looks: number }[];
  viaje_looks:       ViajeLoock[];
  viaje_basicos_sugeridos: { id: string; tipo_prenda: string; cantidad: number }[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

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

// ── Componente ────────────────────────────────────────────────────────────────

export default function ViajeDetallePage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const [viaje, setViaje]     = useState<ViajeDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [menu, setMenu]       = useState(false);
  const [acting, setActing]   = useState(false);

  useEffect(() => {
    fetch(`/api/viajes/${id}`)
      .then((r) => r.json())
      .then((d) => setViaje(d))
      .finally(() => setLoading(false));
  }, [id]);

  const cambiarEstado = async (nuevoEstado: string) => {
    setActing(true);
    await fetch(`/api/viajes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: nuevoEstado }),
    });
    setViaje((v) => v ? { ...v, estado: nuevoEstado } : v);
    setMenu(false);
    setActing(false);
  };

  const eliminar = async () => {
    if (!confirm("¿Eliminar este viaje? Esta acción no se puede deshacer.")) return;
    setActing(true);
    await fetch(`/api/viajes/${id}`, { method: "DELETE" });
    router.push("/viajes");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center pt-32">
        <Loader2 className="size-7 text-accent animate-spin" />
      </div>
    );
  }

  if (!viaje) {
    return (
      <div className="text-center pt-24">
        <p className="text-ink-3">Viaje no encontrado.</p>
        <Link href="/viajes" className="text-sm text-accent mt-2 block">Volver</Link>
      </div>
    );
  }

  const destinos = [...viaje.destinos]
    .sort((a, b) => a.orden - b.orden)
    .map((d) => d.ciudad)
    .join(" → ");

  const estado = ESTADO_CONFIG[viaje.estado as keyof typeof ESTADO_CONFIG];

  // Agrupar looks por evento
  const looksPorEvento: Record<string, ViajeLoock[]> = {};
  for (const look of viaje.viaje_looks) {
    if (!looksPorEvento[look.viaje_evento_id]) looksPorEvento[look.viaje_evento_id] = [];
    looksPorEvento[look.viaje_evento_id].push(look);
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/viajes"
          className="size-9 rounded-full border border-line-2 grid place-items-center text-ink-2 hover:text-ink transition-colors"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-display font-bold text-lg text-ink truncate">{viaje.nombre}</h1>
          <p className="text-xs text-ink-3">{destinos} · {formatRange(viaje.fecha_inicio, viaje.fecha_fin)}</p>
        </div>
        <div className="relative">
          <button
            onClick={() => setMenu((m) => !m)}
            className="size-9 rounded-full border border-line-2 grid place-items-center text-ink-2 hover:text-ink transition-colors"
          >
            {acting ? <Loader2 className="size-4 animate-spin" /> : <MoreVertical className="size-4" />}
          </button>
          {menu && (
            <div className="absolute right-0 top-10 w-52 bg-bg border border-line-2 rounded-button shadow-lg z-20 overflow-hidden">
              {viaje.estado === "listo" && (
                <button
                  onClick={() => cambiarEstado("en_viaje")}
                  className="flex items-center gap-2 w-full px-4 py-3 text-sm text-ink hover:bg-surface transition-colors"
                >
                  <Play className="size-4" />
                  Activar viaje
                </button>
              )}
              {viaje.estado === "en_viaje" && (
                <button
                  onClick={() => cambiarEstado("completado")}
                  className="flex items-center gap-2 w-full px-4 py-3 text-sm text-ink hover:bg-surface transition-colors"
                >
                  <CheckCircle2 className="size-4" />
                  Marcar completado
                </button>
              )}
              <button
                onClick={eliminar}
                className="flex items-center gap-2 w-full px-4 py-3 text-sm text-danger hover:bg-surface transition-colors"
              >
                <Trash2 className="size-4" />
                Eliminar viaje
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Info chips */}
      <div className="flex gap-2 flex-wrap mb-8">
        <span className={cn("px-3 py-1 rounded-full text-xs font-medium border", estado?.color, "border-current/20 bg-current/5")}>
          {estado?.label}
        </span>
        <span className="px-3 py-1 rounded-full text-xs font-medium border border-line-2 text-ink-2">
          {MODO_CONFIG[viaje.modo_optimizacion]?.emoji} {MODO_CONFIG[viaje.modo_optimizacion]?.label}
        </span>
      </div>

      {/* Looks por evento */}
      <div className="space-y-8">
        {viaje.viaje_eventos.map((evento) => {
          const cfg   = EVENTO_CONFIG[evento.tipo];
          const looks = looksPorEvento[evento.id] ?? [];

          return (
            <section key={evento.id}>
              <p className="text-xs font-medium uppercase tracking-wider text-ink-3 mb-3">
                {cfg.emoji} {cfg.label}
              </p>
              <div className="space-y-3">
                {looks.length === 0 ? (
                  <p className="text-sm text-ink-3 italic">Sin looks generados para esta actividad.</p>
                ) : looks.map((look) => (
                  <div key={look.id} className="border border-line-2 rounded-button overflow-hidden">
                    {/* Header del look */}
                    <div className="px-4 py-3 border-b border-line-2">
                      <p className="text-sm font-medium text-ink">{look.nombre}</p>
                      {look.descripcion_ia && (
                        <p className="text-xs text-ink-3 mt-0.5 leading-snug line-clamp-2">
                          {look.descripcion_ia}
                        </p>
                      )}
                    </div>

                    {/* Grid de 4 prendas */}
                    <div className="grid grid-cols-4 gap-px bg-line-2">
                      {[0, 1, 2, 3].map((i) => {
                        const p = look.prendas_data[i];
                        return (
                          <div key={i} className="aspect-square bg-bg">
                            {p?.signedUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.signedUrl} alt={p.nombre} className="w-full h-full object-cover" />
                            ) : p ? (
                              <div className="w-full h-full bg-surface grid place-items-center p-1">
                                <span className="text-[9px] text-ink-3 text-center leading-tight">{p.nombre}</span>
                              </div>
                            ) : (
                              <div className="w-full h-full bg-surface" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* Básicos sugeridos */}
      {viaje.viaje_basicos_sugeridos.length > 0 && (
        <section className="mt-8">
          <p className="text-xs font-medium uppercase tracking-wider text-ink-3 mb-3">
            🧦 Básicos
          </p>
          <div className="border border-line-2 rounded-button divide-y divide-line-2">
            {viaje.viaje_basicos_sugeridos.map((b) => (
              <div key={b.id} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-ink">{b.tipo_prenda}</span>
                <span className="text-sm font-medium text-ink-2">{b.cantidad}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Lista de valija — prendas únicas de todos los looks */}
      {viaje.viaje_looks.length > 0 && (() => {
        const seen = new Set<string>();
        const todas: PrendaData[] = [];
        for (const look of viaje.viaje_looks) {
          for (const p of look.prendas_data) {
            if (!seen.has(p.prenda_id)) {
              seen.add(p.prenda_id);
              todas.push(p);
            }
          }
        }
        return (
          <section className="mt-8">
            <p className="text-xs font-medium uppercase tracking-wider text-ink-3 mb-3">
              🧳 Lista de valija · {todas.length} prendas
            </p>
            <div className="border border-line-2 rounded-lg divide-y divide-line-2">
              {todas.map((p) => (
                <div key={p.prenda_id} className="flex items-center gap-3 px-4 py-2.5">
                  {p.signedUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.signedUrl}
                      alt={p.nombre}
                      className="size-10 object-cover rounded shrink-0 bg-surface"
                    />
                  ) : (
                    <div className="size-10 rounded shrink-0 bg-surface grid place-items-center">
                      <span className="text-[8px] text-ink-3 text-center leading-tight px-0.5">{p.nombre.slice(0, 2)}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{p.nombre}</p>
                    {p.categoria && (
                      <p className="text-xs text-ink-3">{p.categoria}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })()}

      {viaje.viaje_looks.length === 0 && (
        <div className="text-center py-12">
          <Luggage className="size-10 text-ink-3 mx-auto mb-3" strokeWidth={1.2} />
          <p className="text-sm text-ink-3">Este viaje no tiene looks generados aún.</p>
        </div>
      )}
    </div>
  );
}
