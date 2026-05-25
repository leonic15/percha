"use client";

/**
 * GeneratorConfigClient — Handoff 12 · GENERADOR · CONFIGURAR
 * Ruta: /generador
 *
 * Paso 1 de 2 del flujo de generación.
 * - Weather widget (geolocalización → /api/clima)
 * - Chips de ocasión (single-select)
 * - Textarea de contexto (opcional)
 * - Tiles "Desde cero" / "Con base" + bottom sheet picker de prenda
 * - CTA sticky "Generar look" → POST /api/looks/generar → sessionStorage → /generador/resultado
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  Cloud,
  Sparkles,
  Shirt,
  ChevronDown,
  Search,
  X,
  Check,
} from "lucide-react";
import { Button, Chip, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { ClimaData, GenerarLookResult } from "@/app/api/looks/generar/route";

// ── Constantes ────────────────────────────────────────────────────────────────

export const SS_RESULT_KEY = "looksi_generar_result";
export const SS_PARAMS_KEY = "looksi_generar_params";

const OCASIONES = [
  "Casual",
  "Trabajo",
  "Salida noche",
  "Deporte",
  "Formal",
  "Cena",
] as const;

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface WeatherState {
  status: "idle" | "loading" | "ok" | "error";
  data?: ClimaData;
  ciudad?: string;
  incluir: boolean;
}

interface GarmentPickItem {
  id:        string;
  nombre:    string;
  categoria: string;
  color:     string;
  signedUrl: string | null;
}

// ── Componente ────────────────────────────────────────────────────────────────

export function GeneratorConfigClient({
  ciudadNombre,
}: {
  ciudadNombre?: string | null;
}) {
  const router       = useRouter();
  const { toast }    = useToast();

  // ── Form state ──────────────────────────────────────────────────────────────
  const [ocasion,  setOcasion]  = useState<string>("");
  const [contexto, setContexto] = useState("");
  const [modo, setModo]         = useState<"desde_cero" | "con_base">("desde_cero");
  const [prendaBase, setPrendaBase] = useState<GarmentPickItem | null>(null);

  // ── Weather state ───────────────────────────────────────────────────────────
  const [weather, setWeather] = useState<WeatherState>({
    status:  "idle",
    incluir: true,
  });

  // ── Bottom sheet (picker de prenda base) ────────────────────────────────────
  const [sheetOpen,   setSheetOpen]   = useState(false);
  const [garments,    setGarments]    = useState<GarmentPickItem[]>([]);
  const [gLoading,    setGLoading]    = useState(false);
  const [gSearch,     setGSearch]     = useState("");
  const sheetRef = useRef<HTMLDivElement>(null);

  // ── Generando ───────────────────────────────────────────────────────────────
  const [generating, setGenerating] = useState(false);

  // ── Geolocalización + clima ────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) {
      setWeather((w) => ({ ...w, status: "error" }));
      return;
    }
    setWeather((w) => ({ ...w, status: "loading" }));
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const res = await fetch(
            `/api/clima?lat=${coords.latitude}&lon=${coords.longitude}`
          );
          if (!res.ok) throw new Error("clima_error");
          const data: ClimaData = await res.json();
          setWeather({
            status:  "ok",
            data,
            ciudad:  ciudadNombre ?? undefined,
            incluir: true,
          });
        } catch {
          setWeather((w) => ({ ...w, status: "error" }));
        }
      },
      () => {
        setWeather((w) => ({ ...w, status: "error" }));
      },
      { timeout: 8000 }
    );
  }, [ciudadNombre]);

  // ── Fetch garments para el picker ──────────────────────────────────────────
  const fetchGarments = useCallback(async () => {
    if (garments.length > 0) return; // ya cargados
    setGLoading(true);
    try {
      const res  = await fetch("/api/garments?limit=100");
      const json = await res.json();
      const list = (json.garments ?? []).map(
        (g: { id: string; nombre: string; color_principal?: string; signedUrl?: string; category?: { nombre?: string } }) => ({
          id:        g.id,
          nombre:    g.nombre,
          categoria: g.category?.nombre ?? "Prenda",
          color:     g.color_principal  ?? "neutro",
          signedUrl: g.signedUrl        ?? null,
        })
      );
      setGarments(list);
    } catch {
      toast.error("No se pudieron cargar las prendas.");
    } finally {
      setGLoading(false);
    }
  }, [garments.length, toast]);

  const openSheet = () => {
    setSheetOpen(true);
    fetchGarments();
  };

  // Cerrar sheet al hacer click fuera
  useEffect(() => {
    if (!sheetOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSheetOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [sheetOpen]);

  // Filtrar prendas por búsqueda
  const filteredGarments = garments.filter((g) => {
    const q = gSearch.toLowerCase();
    return (
      g.nombre.toLowerCase().includes(q) ||
      g.categoria.toLowerCase().includes(q)
    );
  });

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!ocasion) {
      toast.warning("Elegí una ocasión para continuar.");
      return;
    }
    if (modo === "con_base" && !prendaBase) {
      toast.warning("Elegí una prenda base o cambiá a 'Desde cero'.");
      return;
    }

    setGenerating(true);
    try {
      const body = {
        ocasion,
        contexto:        contexto.trim() || undefined,
        modo,
        prenda_base_id:  modo === "con_base" ? prendaBase?.id : undefined,
        clima:           weather.status === "ok" && weather.incluir && weather.data
          ? { temperatura: weather.data.temperatura, condicion: weather.data.condicion }
          : undefined,
      };

      const res = await fetch("/api/looks/generar", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as {
          error?: string;
          retry_after?: number;
        };
        if (err.error === "no_garments") {
          toast.error("Necesitás prendas en tu guardarropas. ¡Agregá algunas primero!");
        } else if (err.error === "ai_quota") {
          const secs = err.retry_after ?? 60;
          const mins = Math.ceil(secs / 60);
          toast.error(
            `Límite de la IA alcanzado. Esperá ${mins > 1 ? `${mins} minutos` : `${secs} segundos`} y volvé a intentar.`
          );
        } else if (err.error === "ai_timeout") {
          toast.error("La IA tardó demasiado. Intentá de nuevo.");
        } else {
          toast.error("No se pudo generar el look. Intentá de nuevo.");
        }
        return;
      }

      const result: GenerarLookResult = await res.json();

      // Persistir en sessionStorage para que la página de resultado lo lea
      sessionStorage.setItem(SS_RESULT_KEY, JSON.stringify(result));
      sessionStorage.setItem(SS_PARAMS_KEY, JSON.stringify(body));

      router.push("/generador/resultado");
    } catch {
      toast.error("Error de conexión. Revisá tu internet e intentá de nuevo.");
    } finally {
      setGenerating(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col min-h-dvh bg-bg"
      >
        {/* ── Scrollable content ─────────────────────────────────────────── */}
        {/* pb reserva espacio para el sticky CTA: botón (68px) + BottomNav (60px) + safe-area (~34px) + gap */}
        <div className="flex-1 overflow-y-auto pb-[calc(60px+max(env(safe-area-inset-bottom),16px)+80px)] md:pb-4">

          {/* Header */}
          <div className="px-5 pt-3 pb-3 flex items-center justify-between">
            <span className="font-display font-bold text-xl uppercase tracking-[0.08em] text-ink">
              LookSi<span className="text-accent">.</span>
            </span>
            <span className="eyebrow text-ink-3">PASO 1 / 2</span>
          </div>

          {/* H1 */}
          <div className="px-[22px] pt-2 pb-6">
            <h1
              className="font-display font-bold uppercase leading-[0.95] text-ink"
              style={{ fontSize: 36 }}
            >
              Armemos<br />tu look.
            </h1>
            <p className="mt-1.5 text-sm text-ink-2">
              Decinos el contexto, la IA hace el resto.
            </p>
          </div>

          {/* ── Weather widget ──────────────────────────────────────────────── */}
          <div className="px-5 pb-5">
            <WeatherWidget
              weather={weather}
              ciudad={ciudadNombre}
              onToggle={() =>
                setWeather((w) => ({ ...w, incluir: !w.incluir }))
              }
            />
          </div>

          {/* ── Ocasión ─────────────────────────────────────────────────────── */}
          <div className="px-[22px] pb-[22px]">
            <div className="eyebrow text-ink-3 mb-2.5">OCASIÓN</div>
            <div className="flex flex-wrap gap-[6px]">
              {OCASIONES.map((o) => (
                <Chip
                  key={o}
                  active={ocasion === o}
                  onClick={() => setOcasion((prev) => (prev === o ? "" : o))}
                >
                  {o}
                </Chip>
              ))}
            </div>
          </div>

          {/* ── Contexto ────────────────────────────────────────────────────── */}
          <div className="px-[22px] pb-[22px] mt-1">
            <div className="eyebrow text-ink-3 mb-2.5">CONTEXTO (OPCIONAL)</div>
            <textarea
              value={contexto}
              onChange={(e) => setContexto(e.target.value)}
              placeholder="Ej: Reunión con clientes a las 10am, después almuerzo en Palermo."
              rows={3}
              maxLength={300}
              disabled={generating}
              className={cn(
                "w-full resize-none border border-line px-3.5 py-3",
                "text-sm text-ink bg-transparent placeholder:text-ink-3",
                "outline-none focus:border-ink transition-colors",
                "leading-relaxed min-h-[70px]",
              )}
            />
          </div>

          {/* ── Empezar desde ───────────────────────────────────────────────── */}
          <div className="px-[22px] pb-6">
            <div className="eyebrow text-ink-3 mb-2.5">EMPEZAR DESDE</div>
            <div className="grid grid-cols-2 gap-2">

              {/* Tile: Desde cero */}
              <button
                type="button"
                onClick={() => { setModo("desde_cero"); setPrendaBase(null); }}
                disabled={generating}
                className={cn(
                  // block w-full para que el contenido fluya en columna
                  "block w-full text-left py-3.5 px-3 transition-colors",
                  modo === "desde_cero"
                    ? "border-[1.5px] border-ink bg-ink text-bg"
                    : "border-[1.5px] border-line text-ink-2 hover:border-ink-3",
                )}
              >
                {/* Icono como bloque independiente */}
                <span className="block">
                  <Sparkles className="size-[18px]" strokeWidth={1.6} aria-hidden />
                </span>
                <span className="block mt-2 text-[13px] font-medium uppercase tracking-[0.05em] leading-none">
                  Desde cero
                </span>
                <span
                  className={cn(
                    "block mt-1 text-[11px] leading-none",
                    modo === "desde_cero" ? "text-white/70" : "text-ink-3",
                  )}
                >
                  IA elige todo
                </span>
              </button>

              {/* Tile: Con base */}
              <button
                type="button"
                onClick={() => { setModo("con_base"); openSheet(); }}
                disabled={generating}
                className={cn(
                  "block w-full text-left py-3.5 px-3 transition-colors",
                  modo === "con_base"
                    ? "border-[1.5px] border-ink bg-ink text-bg"
                    : "border-[1.5px] border-line text-ink-2 hover:border-ink-3",
                )}
              >
                {/* Icono / mini-thumb */}
                <span className="block">
                  {prendaBase && modo === "con_base" ? (
                    <span className="inline-block size-[18px] rounded-sm overflow-hidden align-top bg-white/20">
                      {prendaBase.signedUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={prendaBase.signedUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="block w-full h-full bg-white/30" />
                      )}
                    </span>
                  ) : (
                    <Shirt className="size-[18px]" strokeWidth={1.6} aria-hidden />
                  )}
                </span>
                <span className="block mt-2 text-[13px] font-medium uppercase tracking-[0.05em] leading-none">
                  Con base
                </span>
                <span
                  className={cn(
                    "block mt-1 text-[11px] leading-none truncate",
                    modo === "con_base" ? "text-white/70" : "text-ink-3",
                  )}
                >
                  {prendaBase && modo === "con_base" ? prendaBase.nombre : "Elegir prenda"}
                </span>
              </button>

            </div>
          </div>
        </div>

        {/* ── Sticky CTA ──────────────────────────────────────────────────── */}
        <div
          className={cn(
            // Mobile: fixed, anclado al bottom, sobre el BottomNav (60px + safe-area)
            "fixed inset-x-0 z-20",
            "bottom-[calc(60px+max(env(safe-area-inset-bottom),16px))]",
            "px-5 py-3 bg-bg border-t border-line-2",
            // Desktop: vuelve al flujo normal (el sidebar reemplaza al BottomNav)
            "md:static md:border-t-0 md:px-[22px] md:pb-8 md:pt-2",
          )}
        >
          <Button
            type="submit"
            variant="accent"
            size="lg"
            fullWidth
            loading={generating}
            icon={!generating ? <Sparkles className="size-4" /> : undefined}
          >
            {generating ? "Generando…" : "Generar look"}
          </Button>
        </div>
      </form>

      {/* ── Bottom sheet picker de prenda base ──────────────────────────────── */}
      {sheetOpen && (
        <GarmentPickerSheet
          garments={filteredGarments}
          loading={gLoading}
          search={gSearch}
          onSearch={setGSearch}
          selected={prendaBase}
          onSelect={(g) => {
            setPrendaBase(g);
            setSheetOpen(false);
          }}
          onClose={() => {
            setSheetOpen(false);
            if (!prendaBase) setModo("desde_cero");
          }}
          ref={sheetRef}
        />
      )}
    </>
  );
}

// ── Weather Widget ─────────────────────────────────────────────────────────────

function WeatherWidget({
  weather,
  ciudad,
  onToggle,
}: {
  weather:  WeatherState;
  ciudad?:  string | null;
  onToggle: () => void;
}) {
  if (weather.status === "idle") return null;

  if (weather.status === "loading") {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-surface border border-line-2 shadow-card">
        <div className="size-11 rounded-full bg-accent-tint grid place-items-center shrink-0">
          <Cloud className="size-5 text-accent" strokeWidth={1.6} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-4 rounded-full border-2 border-ink-3 border-r-transparent animate-spin"
            />
            <span className="text-xs text-ink-3">Obteniendo clima…</span>
          </div>
        </div>
      </div>
    );
  }

  if (weather.status === "error") {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-surface border border-line-2 text-ink-3 text-sm">
        <Cloud className="size-4 shrink-0" strokeWidth={1.4} />
        <span>Clima no disponible</span>
      </div>
    );
  }

  const d = weather.data!;
  const loc = ciudad ? ` · ${ciudad}` : "";

  return (
    <div className="flex items-center gap-3.5 px-4 py-3.5 bg-surface border border-line-2 shadow-card">
      {/* Icon */}
      <div className="size-11 rounded-full bg-accent-tint grid place-items-center shrink-0">
        <Cloud className="size-[22px] text-accent" strokeWidth={1.5} />
      </div>

      {/* Data */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[24px] font-semibold text-ink leading-none">
            {d.temperatura}°
          </span>
          <span className="text-[11px] text-ink-3">
            · mín {d.temperatura_min}° / máx {d.temperatura_max}°
          </span>
        </div>
        <div className="mt-0.5 text-[11px] text-ink-2 truncate">
          {d.condicion}{loc}
        </div>
      </div>

      {/* Toggle incluir clima */}
      <button
        type="button"
        role="switch"
        aria-checked={weather.incluir}
        aria-label={weather.incluir ? "Excluir clima del look" : "Incluir clima en el look"}
        onClick={onToggle}
        className={cn(
          "relative shrink-0 w-[38px] h-[22px] rounded-full p-0.5 transition-colors",
          weather.incluir ? "bg-ink" : "bg-line",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-[18px] rounded-full bg-bg transition-[left] duration-200",
            weather.incluir ? "left-[18px]" : "left-0.5",
          )}
        />
      </button>
    </div>
  );
}

// ── Garment Picker Sheet ──────────────────────────────────────────────────────

import { forwardRef } from "react";

const GarmentPickerSheet = forwardRef<
  HTMLDivElement,
  {
    garments:  GarmentPickItem[];
    loading:   boolean;
    search:    string;
    onSearch:  (v: string) => void;
    selected:  GarmentPickItem | null;
    onSelect:  (g: GarmentPickItem) => void;
    onClose:   () => void;
  }
>(function GarmentPickerSheet(
  { garments, loading, search, onSearch, selected, onSelect, onClose },
  ref
) {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-overlay"
        onClick={onClose}
        aria-hidden
      />

      {/* Sheet */}
      <div
        ref={ref}
        role="dialog"
        aria-modal
        aria-label="Elegir prenda base"
        className={cn(
          "fixed inset-x-0 bottom-0 z-50",
          "bg-bg rounded-t-xl shadow-modal",
          "max-h-[80dvh] flex flex-col",
          "animate-in slide-in-from-bottom duration-[280ms] ease-out-soft",
        )}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-line" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3">
          <h2 className="font-display font-bold text-lg uppercase tracking-tight text-ink">
            Elegir prenda base
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="size-8 grid place-items-center rounded-full text-ink-3 hover:text-ink hover:bg-surface-2 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pb-3">
          <div className="flex items-center gap-2 border border-line px-3 h-10">
            <Search className="size-4 text-ink-3 shrink-0" />
            <input
              type="text"
              placeholder="Buscar prenda…"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-3 outline-none"
              autoComplete="off"
            />
            {search && (
              <button
                type="button"
                onClick={() => onSearch("")}
                className="size-5 grid place-items-center text-ink-3"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 pb-8">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <span
                aria-hidden
                className="size-5 rounded-full border-2 border-ink-3 border-r-transparent animate-spin"
              />
            </div>
          ) : garments.length === 0 ? (
            <p className="text-center text-sm text-ink-3 py-10">
              {search ? "Sin resultados para esa búsqueda." : "No tenés prendas en tu guardarropas."}
            </p>
          ) : (
            <ul className="space-y-0.5">
              {garments.map((g) => {
                const isSelected = selected?.id === g.id;
                return (
                  <li key={g.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(g)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors",
                        isSelected
                          ? "bg-accent-tint"
                          : "hover:bg-surface rounded-sm",
                      )}
                    >
                      {/* Thumb */}
                      <div className="size-11 shrink-0 bg-surface-2 overflow-hidden rounded-xs">
                        {g.signedUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={g.signedUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-line" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-ink truncate">
                          {g.nombre}
                        </div>
                        <div className="eyebrow mt-0.5">{g.categoria}</div>
                      </div>

                      {/* Check */}
                      {isSelected && (
                        <Check className="size-4 text-accent shrink-0" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  );
});
