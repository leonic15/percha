"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Luggage, Plus, Minus, Trash2, RefreshCw, Check, Loader2, X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Prenda, Profile } from "@/lib/database.types";
import {
  TIPO_EVENTO, EVENTO_CONFIG, ESTILOS_VIAJE, MODO_CONFIG,
  type TipoEvento, type ModoOptimizacion,
} from "@/lib/viajes/constants";
import { calcularBasicos, diasEntreFechas, type BasicoSugerido } from "@/lib/viajes/basicos";
import type { GeneratedViajeLook, GenerarViajeLooksResult } from "@/app/api/viajes/generar-looks/route";

// ── Tipos internos del wizard ──────────────────────────────────────────────────

interface DestinoWizard { ciudad: string; pais: string }
interface EventoWizard  { tipo: TipoEvento; cantidad_looks: number }

interface WizardData {
  nombre:             string;
  fecha_inicio:       string;
  fecha_fin:          string;
  destinos:           DestinoWizard[];
  eventos:            EventoWizard[];
  modo_optimizacion:  ModoOptimizacion;
  estilos:            string[];
  prendas_incluir:    string[];
  prendas_excluir:    string[];
  looks_generados:    GeneratedViajeLook[];
  basicos_sugeridos:  BasicoSugerido[];
  prendas_faltantes:  string[];
  genero_viaje:       Profile["genero"];
}

interface Props {
  prendas: (Prenda & { signedUrl: string | null })[];
  genero:  Profile["genero"];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function sugerirNombre(destinos: DestinoWizard[], fecha_inicio: string): string {
  if (!destinos.length || !fecha_inicio) return "";
  const ciudad = destinos[0].ciudad;
  const fecha  = new Date(fecha_inicio + "T12:00:00");
  const mes    = fecha.toLocaleString("es-AR", { month: "long" });
  const year   = fecha.getFullYear();
  return `Viaje a ${ciudad} — ${mes} ${year}`;
}

// ── Step indicator ─────────────────────────────────────────────────────────────

function StepBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex gap-1.5 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-1 flex-1 rounded-full transition-colors duration-300",
            i < step ? "bg-accent" : i === step ? "bg-accent/50" : "bg-line-2"
          )}
        />
      ))}
    </div>
  );
}

// ── Step 1 — Datos del viaje ───────────────────────────────────────────────────

function Step1Datos({ data, onChange }: { data: WizardData; onChange: (d: Partial<WizardData>) => void }) {
  const hoy = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-display font-bold text-ink mb-1">Nuevo viaje</h2>
        <p className="text-sm text-ink-3">Contame a dónde y cuándo vas.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-ink-3 mb-1.5">
            Nombre del viaje
          </label>
          <input
            type="text"
            value={data.nombre}
            onChange={(e) => onChange({ nombre: e.target.value })}
            placeholder={sugerirNombre(data.destinos, data.fecha_inicio) || "Ej: Vacaciones Europa 2026"}
            className={cn(
              "w-full rounded-button border border-line-2 bg-bg px-4 py-2.5 text-sm text-ink",
              "placeholder:text-ink-3 focus:outline-none focus:border-accent transition-colors"
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-ink-3 mb-1.5">
              Salida
            </label>
            <input
              type="date"
              value={data.fecha_inicio}
              min={hoy}
              onChange={(e) => {
                const fi = e.target.value;
                onChange({
                  fecha_inicio: fi,
                  fecha_fin:    data.fecha_fin < fi ? fi : data.fecha_fin,
                  nombre:       data.nombre || sugerirNombre(data.destinos, fi),
                });
              }}
              className={cn(
                "w-full rounded-button border border-line-2 bg-bg px-3 py-2.5 text-sm text-ink",
                "focus:outline-none focus:border-accent transition-colors"
              )}
            />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-ink-3 mb-1.5">
              Regreso
            </label>
            <input
              type="date"
              value={data.fecha_fin}
              min={data.fecha_inicio || hoy}
              onChange={(e) => onChange({ fecha_fin: e.target.value })}
              className={cn(
                "w-full rounded-button border border-line-2 bg-bg px-3 py-2.5 text-sm text-ink",
                "focus:outline-none focus:border-accent transition-colors"
              )}
            />
          </div>
        </div>

        {data.fecha_inicio && data.fecha_fin && (
          <p className="text-xs text-ink-3 text-center">
            {diasEntreFechas(data.fecha_inicio, data.fecha_fin)} días
          </p>
        )}
      </div>
    </div>
  );
}

// ── Step 2 — Destinos ─────────────────────────────────────────────────────────

function Step2Destinos({ data, onChange }: { data: WizardData; onChange: (d: Partial<WizardData>) => void }) {
  const addDestino = () =>
    onChange({ destinos: [...data.destinos, { ciudad: "", pais: "" }] });

  const updateDestino = (i: number, field: keyof DestinoWizard, value: string) => {
    const next = data.destinos.map((d, idx) => (idx === i ? { ...d, [field]: value } : d));
    onChange({
      destinos: next,
      nombre:   data.nombre || sugerirNombre(next, data.fecha_inicio),
    });
  };

  const removeDestino = (i: number) =>
    onChange({ destinos: data.destinos.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-display font-bold text-ink mb-1">Destinos</h2>
        <p className="text-sm text-ink-3">¿A dónde vas? Podés agregar varios.</p>
      </div>

      <div className="space-y-3">
        {data.destinos.map((d, i) => (
          <div key={i} className="flex gap-2 items-start">
            <div className="flex-1 grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Ciudad"
                value={d.ciudad}
                onChange={(e) => updateDestino(i, "ciudad", e.target.value)}
                className={cn(
                  "rounded-button border border-line-2 bg-bg px-3 py-2.5 text-sm text-ink",
                  "placeholder:text-ink-3 focus:outline-none focus:border-accent transition-colors"
                )}
              />
              <input
                type="text"
                placeholder="País"
                value={d.pais}
                onChange={(e) => updateDestino(i, "pais", e.target.value)}
                className={cn(
                  "rounded-button border border-line-2 bg-bg px-3 py-2.5 text-sm text-ink",
                  "placeholder:text-ink-3 focus:outline-none focus:border-accent transition-colors"
                )}
              />
            </div>
            {data.destinos.length > 1 && (
              <button
                onClick={() => removeDestino(i)}
                className="mt-2.5 text-ink-3 hover:text-ink transition-colors"
                aria-label="Eliminar destino"
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
        ))}

        <button
          onClick={addDestino}
          className={cn(
            "flex items-center gap-2 text-sm text-ink-2 hover:text-ink transition-colors",
            "border border-dashed border-line-2 rounded-button px-4 py-2.5 w-full justify-center"
          )}
        >
          <Plus className="size-4" />
          Agregar destino
        </button>
      </div>
    </div>
  );
}

// ── Step 3 — Actividades ──────────────────────────────────────────────────────

function Step3Actividades({ data, onChange }: { data: WizardData; onChange: (d: Partial<WizardData>) => void }) {
  const toggle = (tipo: TipoEvento) => {
    const exists = data.eventos.find((e) => e.tipo === tipo);
    if (exists) {
      onChange({ eventos: data.eventos.filter((e) => e.tipo !== tipo) });
    } else {
      onChange({ eventos: [...data.eventos, { tipo, cantidad_looks: 1 }] });
    }
  };

  const setCantidad = (tipo: TipoEvento, delta: number) => {
    onChange({
      eventos: data.eventos.map((e) =>
        e.tipo === tipo
          ? { ...e, cantidad_looks: Math.max(1, Math.min(15, e.cantidad_looks + delta)) }
          : e
      ),
    });
  };

  const total = data.eventos.reduce((s, e) => s + e.cantidad_looks, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-display font-bold text-ink mb-1">Actividades</h2>
        <p className="text-sm text-ink-3">Elegí qué vas a hacer e indicá cuántos looks necesitás.</p>
      </div>

      <div className="space-y-2">
        {TIPO_EVENTO.map((tipo) => {
          const cfg    = EVENTO_CONFIG[tipo];
          const evento = data.eventos.find((e) => e.tipo === tipo);
          const active = !!evento;

          return (
            <div
              key={tipo}
              className={cn(
                "flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors",
                active ? "border-accent bg-accent/5" : "border-line-2 bg-bg"
              )}
            >
              <button
                onClick={() => toggle(tipo)}
                className="flex items-center gap-3 flex-1 text-left"
              >
                <span className="text-xl leading-none">{cfg.emoji}</span>
                <div>
                  <p className={cn("text-sm font-medium", active ? "text-ink" : "text-ink-2")}>
                    {cfg.label}
                  </p>
                  <p className="text-xs text-ink-3">{cfg.descripcion}</p>
                </div>
              </button>

              {active && (
                <div className="flex items-center gap-2 ml-auto shrink-0">
                  <button
                    onClick={() => setCantidad(tipo, -1)}
                    className="size-7 rounded-full border border-line-2 grid place-items-center text-ink-2 hover:text-ink hover:border-ink transition-colors"
                  >
                    <Minus className="size-3" />
                  </button>
                  <span className="w-5 text-center text-sm font-medium text-ink">
                    {evento!.cantidad_looks}
                  </span>
                  <button
                    onClick={() => setCantidad(tipo, 1)}
                    className="size-7 rounded-full border border-line-2 grid place-items-center text-ink-2 hover:text-ink hover:border-ink transition-colors"
                  >
                    <Plus className="size-3" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {total > 0 && (
        <p className="text-center text-sm text-ink-3">
          Total: <span className="font-medium text-ink">{total} looks</span>
        </p>
      )}
    </div>
  );
}

// ── Step 4 — Preferencias ─────────────────────────────────────────────────────

function Step4Preferencias({
  data, onChange, prendas,
}: {
  data: WizardData;
  onChange: (d: Partial<WizardData>) => void;
  prendas: (Prenda & { signedUrl: string | null })[];
}) {
  const [tab, setTab] = useState<"incluir" | "excluir">("incluir");

  const togglePrenda = (id: string, tipo: "incluir" | "excluir") => {
    const key   = tipo === "incluir" ? "prendas_incluir" : "prendas_excluir";
    const other = tipo === "incluir" ? "prendas_excluir" : "prendas_incluir";
    const list  = data[key];
    const next  = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
    // Remove from the other list if present
    const otherNext = data[other].filter((x) => x !== id);
    onChange({ [key]: next, [other]: otherNext });
  };

  const toggleEstilo = (e: string) => {
    const next = data.estilos.includes(e)
      ? data.estilos.filter((x) => x !== e)
      : [...data.estilos, e];
    onChange({ estilos: next });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-display font-bold text-ink mb-1">Preferencias</h2>
        <p className="text-sm text-ink-3">Afiná el estilo de tu maleta.</p>
      </div>

      {/* Modo */}
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-ink-3 mb-2">Modo</p>
        <div className="grid grid-cols-2 gap-3">
          {(Object.entries(MODO_CONFIG) as [ModoOptimizacion, typeof MODO_CONFIG[keyof typeof MODO_CONFIG]][]).map(
            ([key, cfg]) => (
              <button
                key={key}
                onClick={() => onChange({ modo_optimizacion: key })}
                className={cn(
                  "rounded-lg border px-4 py-3 text-left transition-colors",
                  data.modo_optimizacion === key
                    ? "border-accent bg-accent/5"
                    : "border-line-2 hover:border-ink-2"
                )}
              >
                <p className="text-lg mb-1">{cfg.emoji}</p>
                <p className="text-sm font-medium text-ink">{cfg.label}</p>
                <p className="text-xs text-ink-3 mt-0.5 leading-snug">{cfg.descripcion}</p>
              </button>
            )
          )}
        </div>
      </div>

      {/* Estilos */}
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-ink-3 mb-2">
          Estilos para el viaje
        </p>
        <div className="flex flex-wrap gap-2">
          {ESTILOS_VIAJE.map((e) => (
            <button
              key={e}
              onClick={() => toggleEstilo(e)}
              className={cn(
                "px-3 py-1.5 rounded-full border text-xs font-medium transition-colors",
                data.estilos.includes(e)
                  ? "border-accent bg-accent text-accent-ink"
                  : "border-line-2 text-ink-2 hover:border-ink-2 hover:text-ink"
              )}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      {/* Prendas incluir / excluir */}
      {prendas.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-ink-3 mb-2">
            Prendas del guardarropas
          </p>
          <div className="flex gap-1 mb-3 bg-surface rounded-button p-0.5">
            {(["incluir", "excluir"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "flex-1 py-1.5 rounded-[6px] text-xs font-medium transition-colors",
                  tab === t ? "bg-bg text-ink shadow-sm" : "text-ink-3"
                )}
              >
                {t === "incluir" ? `Incluir (${data.prendas_incluir.length})` : `Excluir (${data.prendas_excluir.length})`}
              </button>
            ))}
          </div>

          <p className="text-xs text-ink-3 mb-3">
            {tab === "incluir"
              ? "Estas prendas aparecerán en algún look del viaje."
              : "Estas prendas serán ignoradas por la IA."}
          </p>

          <div className="grid grid-cols-3 gap-2">
            {prendas.map((p) => {
              const selected =
                tab === "incluir"
                  ? data.prendas_incluir.includes(p.id)
                  : data.prendas_excluir.includes(p.id);

              return (
                <button
                  key={p.id}
                  onClick={() => togglePrenda(p.id, tab)}
                  className={cn(
                    "relative rounded-button border overflow-hidden aspect-square transition-colors",
                    selected
                      ? "border-accent"
                      : "border-line-2 hover:border-ink-2"
                  )}
                >
                  {p.signedUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.signedUrl} alt={p.nombre} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-surface grid place-items-center">
                      <span className="text-xs text-ink-3 text-center px-1 leading-tight">{p.nombre}</span>
                    </div>
                  )}
                  {selected && (
                    <span className="absolute top-1 right-1 size-5 rounded-full bg-accent grid place-items-center">
                      <Check className="size-3 text-accent-ink" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step 5 — Generación y resultados ──────────────────────────────────────────

function Step5Generacion({
  data, onChange, prendas,
}: {
  data: WizardData;
  onChange: (d: Partial<WizardData>) => void;
  prendas: (Prenda & { signedUrl: string | null })[];
}) {
  const [status, setStatus]           = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError]             = useState("");
  const [regenIdx, setRegenIdx]       = useState<number | null>(null);
  const [editLook, setEditLook]       = useState<number | null>(null);
  const [showGenderQ, setShowGenderQ] = useState(false);

  const dias = diasEntreFechas(data.fecha_inicio, data.fecha_fin);

  // Agrupar looks por evento
  const looksPorEvento: Record<TipoEvento, GeneratedViajeLook[]> = {} as never;
  for (const look of data.looks_generados) {
    if (!looksPorEvento[look.evento]) looksPorEvento[look.evento] = [];
    looksPorEvento[look.evento].push(look);
  }

  const generar = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/viajes/generar-looks", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destinos:          data.destinos,
          fecha_inicio:      data.fecha_inicio,
          fecha_fin:         data.fecha_fin,
          modo_optimizacion: data.modo_optimizacion,
          estilos:           data.estilos,
          eventos:           data.eventos,
          prendas_incluir:   data.prendas_incluir,
          prendas_excluir:   data.prendas_excluir,
        }),
      });
      const json = await res.json() as GenerarViajeLooksResult & { error?: string };
      if (!res.ok) { setError(json.error ?? "Error al generar."); setStatus("error"); return; }

      const genero = data.genero_viaje;
      const basicos = calcularBasicos(dias, genero, data.modo_optimizacion);

      onChange({
        looks_generados:   json.looks,
        prendas_faltantes: json.prendas_faltantes,
        basicos_sugeridos: basicos,
      });
      setStatus("done");
      if (!genero || genero === "prefiero_no_decirlo") setShowGenderQ(true);
    } catch {
      setError("Error de conexión. Intentá de nuevo.");
      setStatus("error");
    }
  }, [data, dias, onChange]);

  const regenerarLook = async (look: GeneratedViajeLook, globalIdx: number) => {
    setRegenIdx(globalIdx);
    const prendasYaUsadas = data.looks_generados
      .filter((_, i) => i !== globalIdx)
      .flatMap((l) => l.prendas);

    try {
      const res = await fetch("/api/viajes/generar-looks", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destinos:          data.destinos,
          fecha_inicio:      data.fecha_inicio,
          fecha_fin:         data.fecha_fin,
          modo_optimizacion: data.modo_optimizacion,
          estilos:           data.estilos,
          eventos:           data.eventos,
          prendas_incluir:   data.prendas_incluir,
          prendas_excluir:   data.prendas_excluir,
          regenerar: {
            evento:                   look.evento,
            numero_en_evento:         look.numero_en_evento,
            prendas_ya_seleccionadas: prendasYaUsadas,
          },
        }),
      });
      const json = await res.json() as GenerarViajeLooksResult;
      if (res.ok && json.looks[0]) {
        const next = [...data.looks_generados];
        next[globalIdx] = json.looks[0];
        onChange({ looks_generados: next });
      }
    } finally {
      setRegenIdx(null);
    }
  };

  const updateBasico = (i: number, cantidad: number) => {
    const next = [...data.basicos_sugeridos];
    next[i] = { ...next[i], cantidad: Math.max(0, cantidad) };
    onChange({ basicos_sugeridos: next });
  };

  if (status === "idle" || status === "error") {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-display font-bold text-ink mb-1">Listo para generar</h2>
          <p className="text-sm text-ink-3">Revisá el resumen y generá tu maleta.</p>
        </div>

        <div className="rounded-button border border-line-2 p-4 space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-ink-3">Viaje</span>
            <span className="font-medium text-ink">{data.nombre || "Sin nombre"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-3">Destinos</span>
            <span className="font-medium text-ink text-right">
              {data.destinos.map((d) => `${d.ciudad}`).join(" → ")}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-3">Fechas</span>
            <span className="font-medium text-ink">
              {formatDate(data.fecha_inicio)} → {formatDate(data.fecha_fin)} ({dias}d)
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-3">Modo</span>
            <span className="font-medium text-ink">{MODO_CONFIG[data.modo_optimizacion].label}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-3">Looks a generar</span>
            <span className="font-medium text-ink">
              {data.eventos.reduce((s, e) => s + e.cantidad_looks, 0)}
            </span>
          </div>
        </div>

        {error && <p className="text-sm text-danger text-center">{error}</p>}

        <button
          onClick={generar}
          className={cn(
            "w-full h-12 rounded-button font-medium text-sm uppercase tracking-wide",
            "bg-accent text-accent-ink hover:bg-sage-800 dark:hover:bg-sage-300",
            "transition-colors flex items-center justify-center gap-2"
          )}
        >
          <Luggage className="size-4" />
          Generar maleta
        </button>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <Loader2 className="size-8 text-accent animate-spin" />
        <p className="text-sm text-ink-3">Armando tu maleta ideal…</p>
      </div>
    );
  }

  // ── Resultados ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-display font-bold text-ink mb-1">Tu maleta</h2>
        <p className="text-sm text-ink-3">
          {data.looks_generados.length} looks generados. Podés regenerar o editar cada uno.
        </p>
      </div>

      {/* Looks por evento */}
      {(Object.keys(looksPorEvento) as TipoEvento[]).map((tipo) => {
        const cfg = EVENTO_CONFIG[tipo];
        if (!cfg) return null;
        return (
          <div key={tipo}>
            <p className="text-xs font-medium uppercase tracking-wider text-ink-3 mb-3">
              {cfg.emoji} {cfg.label}
            </p>
            <div className="space-y-3">
              {looksPorEvento[tipo].map((look) => {
                const globalIdx = data.looks_generados.indexOf(look);
                const isRegen   = regenIdx === globalIdx;
                const isEdit    = editLook === globalIdx;

                return (
                  <div
                    key={globalIdx}
                    className="border border-line-2 rounded-xl overflow-hidden"
                  >
                    {/* Header */}
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-line-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink truncate">{look.nombre_sugerido}</p>
                        <p className="text-xs text-ink-3 leading-snug mt-0.5 line-clamp-2">
                          {look.descripcion_look}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => regenerarLook(look, globalIdx)}
                          disabled={isRegen}
                          className="p-1.5 rounded-md text-ink-3 hover:text-ink hover:bg-surface transition-colors disabled:opacity-50"
                          title="Regenerar look"
                        >
                          {isRegen ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                        </button>
                        <button
                          onClick={() => setEditLook(isEdit ? null : globalIdx)}
                          className={cn(
                            "p-1.5 rounded-md transition-colors",
                            isEdit ? "text-accent bg-accent/10" : "text-ink-3 hover:text-ink hover:bg-surface"
                          )}
                          title="Editar look"
                        >
                          <Check className="size-4" />
                        </button>
                      </div>
                    </div>

                    {/* Tiles de prendas */}
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

                    {/* Editor manual */}
                    {isEdit && (
                      <div className="p-3 bg-surface border-t border-line-2">
                        <p className="text-xs text-ink-3 mb-2">
                          Tocá una prenda para agregarla o quitarla del look.
                        </p>
                        <div className="grid grid-cols-3 gap-1.5">
                          {prendas.map((p) => {
                            const inLook = look.prendas.includes(p.id);
                            return (
                              <button
                                key={p.id}
                                onClick={() => {
                                  const next = [...data.looks_generados];
                                  const cur  = { ...next[globalIdx] };
                                  const pd   = [...cur.prendas_data];
                                  if (inLook) {
                                    cur.prendas      = cur.prendas.filter((x) => x !== p.id);
                                    cur.prendas_data = pd.filter((x) => x.id !== p.id);
                                  } else {
                                    cur.prendas      = [...cur.prendas, p.id];
                                    cur.prendas_data = [...pd, {
                                      id: p.id, nombre: p.nombre, categoria: "", color: p.color_principal ?? "",
                                      signedUrl: p.signedUrl,
                                    }];
                                  }
                                  next[globalIdx] = cur;
                                  onChange({ looks_generados: next });
                                }}
                                className={cn(
                                  "relative aspect-square rounded border overflow-hidden transition-colors",
                                  inLook ? "border-accent" : "border-line-2"
                                )}
                              >
                                {p.signedUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={p.signedUrl} alt={p.nombre} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full bg-bg grid place-items-center">
                                    <span className="text-[8px] text-ink-3 text-center leading-tight px-0.5">{p.nombre}</span>
                                  </div>
                                )}
                                {inLook && (
                                  <span className="absolute top-0.5 right-0.5 size-4 rounded-full bg-accent grid place-items-center">
                                    <Check className="size-2.5 text-accent-ink" />
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Básicos sugeridos */}
      {showGenderQ ? (
        <div className="rounded-button border border-line-2 p-4 space-y-3">
          <p className="text-sm font-medium text-ink">¿Cómo viajás en cuanto a ropa interior?</p>
          <div className="flex gap-2">
            {(["hombre", "mujer", "prefiero_no_decirlo"] as const).map((g) => (
              <button
                key={g}
                onClick={() => {
                  const generoSel = g === "prefiero_no_decirlo" ? g : g;
                  const basicos   = calcularBasicos(dias, generoSel, data.modo_optimizacion);
                  onChange({ genero_viaje: generoSel, basicos_sugeridos: basicos });
                  setShowGenderQ(false);
                }}
                className="flex-1 py-2 rounded-button border border-line-2 text-sm text-ink hover:border-accent hover:bg-accent/5 transition-colors capitalize"
              >
                {g === "hombre" ? "Hombre" : g === "mujer" ? "Mujer" : "Omitir"}
              </button>
            ))}
          </div>
        </div>
      ) : data.basicos_sugeridos.length > 0 ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-ink-3 mb-3">
            🧦 Básicos sugeridos
          </p>
          <div className="border border-line-2 rounded-button divide-y divide-line-2">
            {data.basicos_sugeridos.map((b, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-ink">{b.tipo_prenda}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateBasico(i, b.cantidad - 1)}
                    className="size-6 rounded-full border border-line-2 grid place-items-center text-ink-3 hover:text-ink transition-colors"
                  >
                    <Minus className="size-3" />
                  </button>
                  <span className="w-6 text-center text-sm font-medium text-ink">{b.cantidad}</span>
                  <button
                    onClick={() => updateBasico(i, b.cantidad + 1)}
                    className="size-6 rounded-full border border-line-2 grid place-items-center text-ink-3 hover:text-ink transition-colors"
                  >
                    <Plus className="size-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Prendas faltantes */}
      {data.prendas_faltantes.length > 0 && (
        <div className="rounded-button border border-warning-100 bg-warning-50 dark:border-warning-700 dark:bg-warning-900/30 p-4">
          <p className="text-xs font-medium text-warning-900 dark:text-warning-300 mb-2">
            Prendas que podrían faltar
          </p>
          <ul className="space-y-1">
            {data.prendas_faltantes.map((f, i) => (
              <li key={i} className="text-sm text-warning-900 dark:text-warning-300">• {f}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Wizard shell ───────────────────────────────────────────────────────────────

const STEPS = 5;

export function NuevoViajeClient({ prendas, genero }: Props) {
  const router = useRouter();
  const [step, setStep]     = useState(0);
  const [saving, setSaving] = useState(false);

  const [data, setData] = useState<WizardData>({
    nombre:            "",
    fecha_inicio:      "",
    fecha_fin:         "",
    destinos:          [{ ciudad: "", pais: "" }],
    eventos:           [],
    modo_optimizacion: "maleta_liviana",
    estilos:           [],
    prendas_incluir:   [],
    prendas_excluir:   [],
    looks_generados:   [],
    basicos_sugeridos: [],
    prendas_faltantes: [],
    genero_viaje:      genero,
  });

  const onChange = useCallback((patch: Partial<WizardData>) => {
    setData((prev) => ({ ...prev, ...patch }));
  }, []);

  // Validaciones por paso
  const canNext = (() => {
    if (step === 0) return !!data.fecha_inicio && !!data.fecha_fin;
    if (step === 1) return data.destinos.every((d) => d.ciudad.trim() && d.pais.trim());
    if (step === 2) return data.eventos.length > 0;
    if (step === 3) return true;
    if (step === 4) return data.looks_generados.length > 0;
    return false;
  })();

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const nombre = data.nombre || sugerirNombre(data.destinos, data.fecha_inicio);
      const res = await fetch("/api/viajes", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre,
          fecha_inicio:      data.fecha_inicio,
          fecha_fin:         data.fecha_fin,
          modo_optimizacion: data.modo_optimizacion,
          destinos:          data.destinos,
          eventos:           data.eventos,
          estilos:           data.estilos,
          prendas_incluir:   data.prendas_incluir,
          prendas_excluir:   data.prendas_excluir,
          looks:             data.looks_generados.map((l) => ({
            ...l,
            nombre: l.nombre_sugerido,
          })),
          basicos_sugeridos: data.basicos_sugeridos,
        }),
      });
      const json = await res.json() as { id: string; error?: string };
      if (res.ok) router.push(`/viajes/${json.id}`);
    } finally {
      setSaving(false);
    }
  };

  const stepTitles = ["Datos", "Destinos", "Actividades", "Preferencias", "Maleta"];

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-32">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => (step === 0 ? router.back() : setStep((s) => s - 1))}
          className="size-9 rounded-full border border-line-2 grid place-items-center text-ink-2 hover:text-ink transition-colors"
        >
          <ChevronLeft className="size-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-ink-3 uppercase tracking-wider">
            Paso {step + 1} de {STEPS} · {stepTitles[step]}
          </p>
        </div>
      </div>

      <StepBar step={step} total={STEPS} />

      {/* Contenido por paso */}
      <div className="min-h-[400px]">
        {step === 0 && <Step1Datos     data={data} onChange={onChange} />}
        {step === 1 && <Step2Destinos  data={data} onChange={onChange} />}
        {step === 2 && <Step3Actividades data={data} onChange={onChange} />}
        {step === 3 && <Step4Preferencias data={data} onChange={onChange} prendas={prendas} />}
        {step === 4 && <Step5Generacion data={data} onChange={onChange} prendas={prendas} />}
      </div>

      {/* Navegación fija al fondo */}
      <div className="fixed bottom-[calc(60px+max(env(safe-area-inset-bottom),16px))] left-0 right-0 bg-bg/95 backdrop-blur-md border-t border-line-2 px-4 py-3 md:bottom-0 md:static md:bg-transparent md:backdrop-blur-none md:border-0 md:px-0 md:pt-6">
        {step < STEPS - 1 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canNext}
            className={cn(
              "w-full h-12 rounded-button font-medium text-sm uppercase tracking-wide",
              "flex items-center justify-center gap-2 transition-colors",
              canNext
                ? "bg-accent text-accent-ink hover:bg-sage-800 dark:hover:bg-sage-300"
                : "bg-surface text-ink-3 cursor-not-allowed"
            )}
          >
            Siguiente
            <ChevronRight className="size-4" />
          </button>
        ) : (
          <button
            onClick={save}
            disabled={!canNext || saving}
            className={cn(
              "w-full h-12 rounded-button font-medium text-sm uppercase tracking-wide",
              "flex items-center justify-center gap-2 transition-colors",
              canNext && !saving
                ? "bg-accent text-accent-ink hover:bg-sage-800 dark:hover:bg-sage-300"
                : "bg-surface text-ink-3 cursor-not-allowed"
            )}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Luggage className="size-4" />}
            {saving ? "Guardando…" : "Guardar viaje"}
          </button>
        )}
      </div>
    </div>
  );
}
