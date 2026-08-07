"use client";

/**
 * ProfileClient — Handoff 16 · CONFIGURACIÓN · PERFIL
 * Ruta: /perfil
 *
 * PERCHA-005 (LSI-15) — Edición de perfil básico:
 *   - Avatar clickable → file picker → compresión → POST /api/perfil/avatar
 *   - Nombre editable inline con Save/Cancel → PATCH /api/perfil
 *   - Validación client-side: tipo (JPG/PNG/WebP) y tamaño (≤5 MB)
 *
 * PERCHA-024 (LSI-35) — Preferencias de estilo personal:
 *   - Chips multi-select de estilos favoritos (6 opciones)
 *   - Chips multi-select de ocasiones frecuentes (5 opciones)
 *   - Auto-save optimistic PATCH /api/perfil
 *
 * PERCHA-025 (LSI-36) — Preferencias generales:
 *   - Tema: mini action sheet (Claro / Oscuro / Seguir sistema)
 *   - Idioma: Español / English
 *   - Clima: toggle habilitado/deshabilitado
 *
 * PERCHA-023 (LSI-34) — Configurar ciudad manualmente:
 *   - Row de ciudad con bottom sheet de búsqueda
 *   - Búsqueda con debounce 300ms → /api/clima/ciudades?q=
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronRight,
  Sun,
  Moon,
  Monitor,
  Globe,
  CloudSun,
  Bell,
  LogOut,
  Trash2,
  Check,
  X,
  AlertCircle,
  MapPin,
  Search,
  Camera,
  Pencil,
  Loader2,
  UserRound,
} from "lucide-react";
import { Chip, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/client";
import type { CiudadResult } from "@/app/api/clima/ciudades/route";

// ── Constantes de validación de avatar ───────────────────────────────────────

const AVATAR_MAX_BYTES  = 5 * 1024 * 1024; // 5 MB
const AVATAR_ALLOWED    = ["image/jpeg", "image/png", "image/webp"] as const;

// ── Constantes ────────────────────────────────────────────────────────────────

const ESTILOS_OPTS = [
  { value: "casual",     label: "Casual"     },
  { value: "clasico",    label: "Clásico"    },
  { value: "deportivo",  label: "Deportivo"  },
  { value: "elegante",   label: "Elegante"   },
  { value: "bohemio",    label: "Bohemio"    },
  { value: "urbano",     label: "Urbano"     },
] as const;

const OCASIONES_OPTS = [
  { value: "casual",   label: "Casual"   },
  { value: "trabajo",  label: "Trabajo"  },
  { value: "formal",   label: "Formal"   },
  { value: "deporte",  label: "Deporte"  },
  { value: "salida",   label: "Salida"   },
] as const;

const TEMAS_OPTS = [
  { value: "sistema", label: "Seguir sistema", Icon: Monitor },
  { value: "claro",   label: "Claro",          Icon: Sun     },
  { value: "oscuro",  label: "Oscuro",         Icon: Moon    },
] as const;

const IDIOMAS_OPTS = [
  { value: "es", label: "Español"  },
  { value: "en", label: "English"  },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Aplica el tema en el <html> y lo guarda en localStorage */
function applyTheme(tema: string) {
  if (typeof window === "undefined") return;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const effective =
    tema === "oscuro" ? "dark"
    : tema === "claro" ? "light"
    : prefersDark ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", effective);
  try { localStorage.setItem("percha-tema", tema); } catch {}
}

/** Iniciales de un nombre (máx 2 letras) */
function getInitials(name: string | null, email: string): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
  }
  return email[0]?.toUpperCase() ?? "?";
}

/** PATCH /api/perfil con los campos dados */
async function patchPerfil(fields: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch("/api/perfil", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(fields),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

/** Toggle accesible tipo pill — Handoff 16: 38×22, ink ON, surface-2 OFF */
function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        "relative shrink-0 h-[22px] w-[38px] rounded-full overflow-hidden transition-colors duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
        checked ? "bg-ink" : "bg-surface-2",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-[2px] size-[18px] rounded-full shadow-sm transition-transform duration-200",
          checked ? "translate-x-[18px] bg-bg" : "translate-x-[2px] bg-white",
        )}
      />
    </button>
  );
}

/** Fila de configuración genérica — Handoff 16: px-[22px] py-[14px] */
function SettingRow({
  icon: Icon,
  label,
  sublabel,
  value,
  onClick,
  rightSlot,
  danger,
}: {
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  sublabel?: string;
  value?: string;
  onClick?: () => void;
  rightSlot?: React.ReactNode;
  danger?: boolean;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 px-[22px] py-[14px] text-left",
        "transition-colors duration-100",
        onClick && "hover:bg-surface-2 active:bg-surface-2 cursor-pointer active:scale-[0.985]",
        danger ? "text-danger" : "text-ink",
      )}
    >
      {Icon && (
        <Icon
          className={cn("size-[18px] shrink-0", danger ? "text-danger" : "text-ink-2")}
          strokeWidth={1.4}
        />
      )}
      <div className="flex-1 min-w-0">
        <div className={cn("text-sm", danger ? "text-danger font-medium" : "text-ink")}>
          {label}
        </div>
        {sublabel && (
          <div className="text-[11px] text-ink-3 mt-0.5">{sublabel}</div>
        )}
      </div>
      {rightSlot}
      {value !== undefined && (
        <div className="flex items-center gap-1 text-ink-3 text-[13px] shrink-0">
          <span>{value}</span>
          <ChevronRight className="size-3.5" strokeWidth={1.5} />
        </div>
      )}
    </Tag>
  );
}

/** Sección con eyebrow encima + card bg-surface border-y — Handoff 16 */
function SettingsSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-2">
      <div className="px-[22px] pt-3 pb-1.5">
        <span className="eyebrow text-[10px]">{label}</span>
      </div>
      <div className="bg-surface border-y border-line-2 divide-y divide-line-2">
        {children}
      </div>
    </div>
  );
}

/** Mini action sheet para selección de tema */
function TemaSheet({
  visible,
  current,
  onSelect,
  onClose,
}: {
  visible: boolean;
  current: string;
  onSelect: (v: string) => void;
  onClose: () => void;
}) {
  return (
    <>
      {visible && (
        <div
          className="fixed inset-0 z-40 bg-overlay"
          style={{ animation: "fadeIn 200ms ease forwards" }}
          onClick={onClose}
        />
      )}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 bg-surface rounded-t-[20px] pb-[max(env(safe-area-inset-bottom),16px)]",
          "shadow-modal",
          "md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2",
          "md:w-full md:max-w-[340px] md:rounded-[20px]",
          visible ? "pointer-events-auto" : "pointer-events-none",
        )}
        style={{
          animation: visible ? "sheet-up 280ms cubic-bezier(0.32,0.72,0,1) forwards" : undefined,
          transform: visible ? undefined : "translateY(100%)",
        }}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 rounded-full bg-line" />
        </div>

        <div className="px-5 pb-2 pt-1">
          <p className="eyebrow text-[11px] pb-3">Tema visual</p>
          <div className="space-y-1">
            {TEMAS_OPTS.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => { onSelect(value); onClose(); }}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-3 rounded-lg text-sm",
                  "transition-colors duration-100 hover:bg-surface-2",
                  value === current ? "text-ink font-medium" : "text-ink-2",
                )}
              >
                <Icon
                  className={cn("size-4.5", value === current ? "text-accent" : "text-ink-3")}
                  strokeWidth={1.4}
                />
                <span className="flex-1 text-left">{label}</span>
                {value === current && (
                  <Check className="size-4 text-accent" strokeWidth={2} />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/** Sheet de búsqueda y selección de ciudad (PERCHA-023) */
function CiudadSheet({
  visible,
  currentNombre,
  currentPais,
  onSelect,
  onRemove,
  onClose,
}: {
  visible:       boolean;
  currentNombre: string | null;
  currentPais:   string | null;
  onSelect:      (ciudad: CiudadResult) => void;
  onRemove:      () => void;
  onClose:       () => void;
}) {
  const [query,     setQuery]     = useState("");
  const [results,   setResults]   = useState<CiudadResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched,  setSearched]  = useState(false); // ya hizo al menos 1 búsqueda
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef    = useRef<HTMLInputElement>(null);

  // Limpiar al cerrar
  useEffect(() => {
    if (!visible) {
      setQuery("");
      setResults([]);
      setSearched(false);
    } else {
      // Auto-focus al abrir (pequeño delay para que la animación no lo trague)
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [visible]);

  // Búsqueda con debounce 300ms
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/clima/ciudades?q=${encodeURIComponent(query.trim())}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setResults(data.ciudades ?? []);
        setSearched(true);
      } catch {
        setResults([]);
        setSearched(true);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, [query]);

  if (!visible) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-overlay"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal
        aria-label="Configurar ciudad del clima"
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 bg-bg rounded-t-[20px]",
          "pb-[max(env(safe-area-inset-bottom),16px)] shadow-modal",
          "max-h-[85dvh] flex flex-col",
        )}
        style={{ animation: "sheet-up 280ms cubic-bezier(0.32,0.72,0,1) forwards" }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-9 h-1 rounded-full bg-line" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 shrink-0">
          <h2 className="font-display font-bold text-lg uppercase tracking-tight text-ink">
            Ciudad del clima
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

        {/* Ciudad actual (si existe) */}
        {currentNombre && (
          <div className="mx-5 mb-3 px-3 py-2.5 bg-accent-tint flex items-center gap-2.5 shrink-0">
            <MapPin className="size-3.5 text-accent shrink-0" strokeWidth={1.5} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink truncate">{currentNombre}</p>
              {currentPais && (
                <p className="text-[11px] text-ink-3">{currentPais}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onRemove}
              className="text-[11px] text-danger underline shrink-0"
            >
              Quitar
            </button>
          </div>
        )}

        {/* Search input */}
        <div className="px-5 pb-3 shrink-0">
          <div className="flex items-center gap-2 border border-line px-3 h-11 bg-bg">
            <Search className="size-4 text-ink-3 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Buscar ciudad…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-3 outline-none"
              autoComplete="off"
            />
            {searching ? (
              <span
                aria-hidden
                className="size-4 rounded-full border-2 border-ink-3 border-r-transparent animate-spin shrink-0"
              />
            ) : query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="size-5 grid place-items-center text-ink-3"
              >
                <X className="size-3" />
              </button>
            ) : null}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-5 pb-4">
          {results.length > 0 ? (
            <ul className="space-y-0.5">
              {results.map((ciudad) => (
                <li key={ciudad.id}>
                  <button
                    type="button"
                    onClick={() => { onSelect(ciudad); onClose(); }}
                    className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-surface rounded-sm transition-colors"
                  >
                    <MapPin className="size-4 text-ink-3 shrink-0" strokeWidth={1.4} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-ink font-medium truncate">{ciudad.nombre}</p>
                      <p className="text-[11px] text-ink-3">{ciudad.pais}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : searched && query.trim().length >= 2 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-ink-2">No se encontró esa ciudad.</p>
              <p className="text-xs text-ink-3 mt-1">
                Probá con el nombre en inglés o una ciudad cercana.
              </p>
            </div>
          ) : query.trim().length < 2 && !currentNombre ? (
            <div className="py-8 text-center">
              <p className="text-xs text-ink-3">
                Escribí al menos 2 caracteres para buscar.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

/** Sheet de confirmación para cerrar sesión en todos los dispositivos — PERCHA-006 */
function GlobalSignOutSheet({
  visible,
  onConfirm,
  onClose,
  loading,
}: {
  visible:   boolean;
  onConfirm: () => void;
  onClose:   () => void;
  loading:   boolean;
}) {
  return (
    <>
      {visible && (
        <div
          className="fixed inset-0 z-40 bg-overlay"
          style={{ animation: "fadeIn 200ms ease forwards" }}
          onClick={!loading ? onClose : undefined}
        />
      )}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 bg-surface rounded-t-[20px]",
          "pb-[max(env(safe-area-inset-bottom),24px)] shadow-modal",
          "md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2",
          "md:-translate-x-1/2 md:-translate-y-1/2",
          "md:w-full md:max-w-[420px] md:rounded-[20px]",
          visible ? "pointer-events-auto" : "pointer-events-none",
        )}
        style={{
          animation: visible ? "sheet-up 280ms cubic-bezier(0.32,0.72,0,1) forwards" : undefined,
          transform: visible ? undefined : "translateY(100%)",
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 rounded-full bg-line" />
        </div>

        <div className="px-5 pt-3 pb-2">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-ink">
                Cerrar todas las sesiones
              </h3>
              <p className="text-xs text-ink-3 mt-1 leading-relaxed">
                Se cerrará tu sesión en todos los dispositivos donde tengas la app abierta.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              aria-label="Cancelar"
              className="size-8 grid place-items-center text-ink-3 hover:text-ink -mt-1"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 p-3 bg-surface-2 rounded-md mb-4">
            <AlertCircle className="size-4 text-ink-2 shrink-0 mt-0.5" strokeWidth={1.5} />
            <p className="text-xs text-ink-2 leading-relaxed">
              Cualquier dispositivo con sesión activa será desconectado
              y deberá volver a iniciar sesión.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 h-11 rounded-button text-sm font-medium border border-line text-ink-2 hover:border-ink-3 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className={cn(
                "flex-1 h-11 rounded-button text-sm font-medium transition-[transform,opacity] duration-150",
                "active:scale-[0.985] bg-ink text-bg",
                loading && "opacity-60 cursor-not-allowed",
              )}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  Cerrando…
                </span>
              ) : (
                "Cerrar todas"
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/** Sheet de confirmación para eliminar cuenta */
function DeleteAccountSheet({
  visible,
  email,
  onConfirm,
  onClose,
  deleting,
}: {
  visible: boolean;
  email: string;
  onConfirm: () => void;
  onClose: () => void;
  deleting: boolean;
}) {
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (!visible) setTyped("");
  }, [visible]);

  const match = typed.trim().toLowerCase() === email.toLowerCase();

  return (
    <>
      {visible && (
        <div
          className="fixed inset-0 z-40 bg-overlay"
          style={{ animation: "fadeIn 200ms ease forwards" }}
          onClick={!deleting ? onClose : undefined}
        />
      )}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 bg-surface rounded-t-[20px] pb-[max(env(safe-area-inset-bottom),24px)]",
          "shadow-modal",
          "md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2",
          "md:w-full md:max-w-[420px] md:rounded-[20px]",
          visible ? "pointer-events-auto" : "pointer-events-none",
        )}
        style={{
          animation: visible ? "sheet-up 280ms cubic-bezier(0.32,0.72,0,1) forwards" : undefined,
          transform: visible ? undefined : "translateY(100%)",
        }}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 rounded-full bg-line" />
        </div>

        <div className="px-5 pt-3 pb-2">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-ink">Eliminar cuenta</h3>
              <p className="text-xs text-ink-3 mt-1 leading-relaxed">
                Esta acción es irreversible. Se eliminarán todas tus prendas, looks y datos.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="size-8 grid place-items-center text-ink-3 hover:text-ink -mt-1"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="flex items-start gap-2 p-3 bg-[color:var(--color-terra-50)] rounded-md mb-4">
            <AlertCircle className="size-4 text-danger shrink-0 mt-0.5" strokeWidth={1.5} />
            <p className="text-xs text-danger leading-relaxed">
              Para confirmar, escribí tu email: <span className="font-medium">{email}</span>
            </p>
          </div>

          <input
            type="email"
            autoComplete="off"
            placeholder={email}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            disabled={deleting}
            className={cn(
              "w-full h-11 px-3 text-sm rounded-md border bg-bg text-ink",
              "placeholder:text-ink-3 outline-none transition-colors",
              "focus:ring-2 focus:ring-danger focus:border-danger",
              match ? "border-danger" : "border-line",
            )}
          />

          <button
            type="button"
            onClick={onConfirm}
            disabled={!match || deleting}
            className={cn(
              "mt-4 w-full h-11 rounded-button text-sm font-medium uppercase tracking-wide",
              "transition-[transform,opacity] duration-150 active:scale-[0.985]",
              match && !deleting
                ? "bg-danger text-white"
                : "bg-surface-2 text-ink-3 cursor-not-allowed",
            )}
          >
            {deleting ? "Eliminando…" : "Eliminar mi cuenta"}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Barras de uso de IA ───────────────────────────────────────────────────────

interface UsageBarItem {
  tipo:  string;
  label: string;
  usado: number;
  max:   number;
}

function UsageBars() {
  const [items, setItems] = useState<UsageBarItem[] | null>(null);

  useEffect(() => {
    fetch("/api/perfil/uso-ia")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.items) setItems(d.items); })
      .catch(() => {});
  }, []);

  if (!items) return null;

  return (
    <div className="px-[22px] pt-3 pb-[14px]">
      <p className="text-xs text-ink-3 mb-3">
        Uso de generaciones IA · últimas 24 h
      </p>
      <div className="space-y-2.5">
        {items.map((item) => {
          const pct = Math.min(100, Math.round((item.usado / item.max) * 100));
          const warning = pct >= 80;
          return (
            <div key={item.tipo}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-ink-2">{item.label}</span>
                <span className={cn("text-[11px] font-mono", warning ? "text-amber-600" : "text-ink-3")}>
                  {item.usado}/{item.max}
                </span>
              </div>
              <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    warning ? "bg-amber-500" : "bg-accent",
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export interface ProfileClientProps {
  email:               string;
  fullName:            string | null;
  avatarUrl:           string | null;
  idioma:              string;
  tema:                string;
  climaHabilitado:     boolean;
  ciudadNombre:        string | null;
  ciudadPais:          string | null;
  estilosFavoritos:    string[];
  ocasionesFrecuentes: string[];
  // PERCHA-033
  genero:              string | null;
  alturaCm:            number | null;
  pesoKg:              number | null;
  prendasCount:        number;
  looksCount:          number;
}

export function ProfileClient({
  email,
  fullName,
  avatarUrl:            initialAvatarUrl,
  idioma:               initialIdioma,
  tema:                 initialTema,
  climaHabilitado:      initialClima,
  ciudadNombre:         initialCiudadNombre,
  ciudadPais:           initialCiudadPais,
  estilosFavoritos:     initialEstilos,
  ocasionesFrecuentes:  initialOcasiones,
  genero,
  alturaCm,
  pesoKg,
  prendasCount,
  looksCount,
}: ProfileClientProps) {
  const router    = useRouter();
  const pathname  = usePathname();
  const { toast } = useToast();

  // ── State ─────────────────────────────────────────────────────────────────
  const [estilos,    setEstilos]    = useState<string[]>(initialEstilos);
  const [ocasiones,  setOcasiones]  = useState<string[]>(initialOcasiones);
  const [idioma,     setIdioma]     = useState(initialIdioma);
  const [tema,       setTema]       = useState(initialTema);
  const [clima,      setClima]      = useState(initialClima);

  // Avatar
  const [avatarUrl,       setAvatarUrl]       = useState<string | null>(initialAvatarUrl);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Nombre editable
  const [displayName,  setDisplayName]  = useState<string | null>(fullName);
  const [editingName,  setEditingName]  = useState(false);
  const [nameInput,    setNameInput]    = useState(fullName ?? "");
  const [savingName,   setSavingName]   = useState(false);

  // Ciudad configurada
  const [ciudadNombre, setCiudadNombre] = useState<string | null>(initialCiudadNombre);
  const [ciudadPais,   setCiudadPais]   = useState<string | null>(initialCiudadPais);

  const [temaSheetOpen,        setTemaSheetOpen]        = useState(false);
  const [ciudadSheetOpen,      setCiudadSheetOpen]      = useState(false);
  const [deleteSheetOpen,      setDeleteSheetOpen]      = useState(false);
  const [deleting,             setDeleting]             = useState(false);
  const [globalSignOutOpen,    setGlobalSignOutOpen]    = useState(false);
  const [signingOutGlobal,     setSigningOutGlobal]     = useState(false);
  const [savingEstilos,   setSavingEstilos]   = useState(false);
  const [savingOcasiones, setSavingOcasiones] = useState(false);

  // Debounce refs para chips
  const estilosTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ocasionesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Aplicar tema al montar ────────────────────────────────────────────────
  useEffect(() => {
    applyTheme(initialTema);
  }, [initialTema]);

  // ── System theme media query listener ────────────────────────────────────
  useEffect(() => {
    if (tema !== "sistema") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("sistema");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [tema]);

  // ── Helpers de guardado ────────────────────────────────────────────────────

  const toggleEstilo = useCallback(
    (val: string) => {
      const next = estilos.includes(val)
        ? estilos.filter((v) => v !== val)
        : [...estilos, val];
      setEstilos(next);
      if (estilosTimer.current) clearTimeout(estilosTimer.current);
      estilosTimer.current = setTimeout(async () => {
        setSavingEstilos(true);
        const ok = await patchPerfil({ estilos_favoritos: next });
        setSavingEstilos(false);
        if (!ok) {
          setEstilos(estilos);
          toast.error("Error guardando estilos");
        }
      }, 600);
    },
    [estilos, toast],
  );

  const toggleOcasion = useCallback(
    (val: string) => {
      const next = ocasiones.includes(val)
        ? ocasiones.filter((v) => v !== val)
        : [...ocasiones, val];
      setOcasiones(next);
      if (ocasionesTimer.current) clearTimeout(ocasionesTimer.current);
      ocasionesTimer.current = setTimeout(async () => {
        setSavingOcasiones(true);
        const ok = await patchPerfil({ ocasiones_frecuentes: next });
        setSavingOcasiones(false);
        if (!ok) {
          setOcasiones(ocasiones);
          toast.error("Error guardando ocasiones");
        }
      }, 600);
    },
    [ocasiones, toast],
  );

  const handleTema = useCallback(
    async (val: string) => {
      setTema(val);
      applyTheme(val);
      const ok = await patchPerfil({ tema: val });
      if (!ok) {
        setTema(tema);
        applyTheme(tema);
        toast.error("Error guardando tema");
      }
    },
    [tema, toast],
  );

  const handleClima = useCallback(
    async (val: boolean) => {
      setClima(val);
      const ok = await patchPerfil({ clima_habilitado: val });
      if (!ok) {
        setClima(!val);
        toast.error("Error guardando preferencia de clima");
      }
    },
    [toast],
  );

  const handleIdioma = useCallback(
    async (val: string) => {
      if (val === idioma) return;
      const ok = await patchPerfil({ idioma: val });
      if (!ok) {
        toast.error("Error guardando idioma");
        return;
      }
      setIdioma(val);
      const stripped = pathname.replace(/^\/en/, "") || "/";
      if (val === "en") {
        router.push(`/en${stripped}`);
      } else {
        router.push(stripped);
      }
    },
    [idioma, pathname, router, toast],
  );

  /** Guardar ciudad seleccionada desde el sheet */
  const handleCiudadSelect = useCallback(
    async (ciudad: CiudadResult) => {
      const prev = { nombre: ciudadNombre, pais: ciudadPais };
      setCiudadNombre(ciudad.nombre);
      setCiudadPais(ciudad.pais);
      const ok = await patchPerfil({
        ciudad_nombre:   ciudad.nombre,
        ciudad_latitud:  ciudad.latitud,
        ciudad_longitud: ciudad.longitud,
        ciudad_pais:     ciudad.pais,
      });
      if (!ok) {
        setCiudadNombre(prev.nombre);
        setCiudadPais(prev.pais);
        toast.error("Error guardando ciudad");
      } else {
        toast.success(`Ciudad actualizada: ${ciudad.nombre}`);
      }
    },
    [ciudadNombre, ciudadPais, toast],
  );

  /** Quitar ciudad configurada */
  const handleCiudadRemove = useCallback(async () => {
    const prev = { nombre: ciudadNombre, pais: ciudadPais };
    setCiudadNombre(null);
    setCiudadPais(null);
    setCiudadSheetOpen(false);
    const ok = await patchPerfil({
      ciudad_nombre:   null,
      ciudad_latitud:  null,
      ciudad_longitud: null,
      ciudad_pais:     null,
    });
    if (!ok) {
      setCiudadNombre(prev.nombre);
      setCiudadPais(prev.pais);
      toast.error("Error al quitar la ciudad");
    } else {
      toast.success("Ciudad eliminada");
    }
  }, [ciudadNombre, ciudadPais, toast]);

  // ── Avatar ────────────────────────────────────────────────────────────────

  const handleAvatarChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!e.target) return;
      // Resetear input para que el mismo archivo pueda seleccionarse de nuevo
      e.target.value = "";

      if (!file) return;

      // Validar tipo
      if (!(AVATAR_ALLOWED as readonly string[]).includes(file.type)) {
        toast.error("Formato no soportado. Usá JPG, PNG o WebP.");
        return;
      }

      // Validar tamaño (antes de comprimir)
      if (file.size > AVATAR_MAX_BYTES) {
        toast.error("La imagen supera el tamaño máximo de 5 MB.");
        return;
      }

      setAvatarUploading(true);
      try {
        // Comprimir con browser-image-compression (import dinámico: no corre en servidor)
        const { default: imageCompression } = await import("browser-image-compression");
        const compressed = await imageCompression(file, {
          maxSizeMB:        0.8,
          maxWidthOrHeight: 512,
          useWebWorker:     true,
          fileType:         file.type as "image/jpeg" | "image/png" | "image/webp",
        });

        const fd = new FormData();
        fd.append("file", compressed, file.name);

        const res = await fetch("/api/perfil/avatar", { method: "POST", body: fd });
        const json = await res.json() as { avatarUrl?: string; error?: string; message?: string };

        if (!res.ok) {
          toast.error(json.message ?? "No se pudo subir la foto. Intentá de nuevo.");
          return;
        }

        setAvatarUrl(json.avatarUrl ?? null);
        toast.success("Foto de perfil actualizada.");
      } catch (err) {
        console.error("[avatar] upload error:", err);
        toast.error("Error al subir la foto. Intentá de nuevo.");
      } finally {
        setAvatarUploading(false);
      }
    },
    [toast],
  );

  // ── Nombre ────────────────────────────────────────────────────────────────

  const handleNameSave = useCallback(async () => {
    const trimmed = nameInput.trim();
    if (trimmed === (displayName ?? "")) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    const ok = await patchPerfil({ full_name: trimmed || null });
    setSavingName(false);
    if (ok) {
      setDisplayName(trimmed || null);
      setEditingName(false);
    } else {
      toast.error("Error guardando el nombre. Intentá de nuevo.");
    }
  }, [nameInput, displayName, toast]);

  const handleNameCancel = useCallback(() => {
    setNameInput(displayName ?? "");
    setEditingName(false);
  }, [displayName]);

  /** Cierra la sesión en este dispositivo únicamente (scope: local) — PERCHA-006 */
  const handleSignOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut({ scope: "local" });
    router.push("/login");
  }, [router]);

  /** Cierra la sesión en TODOS los dispositivos (scope: global) — PERCHA-006 */
  const handleSignOutGlobal = useCallback(async () => {
    setSigningOutGlobal(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut({ scope: "global" });
      router.push("/login");
    } catch {
      toast.error("Error al cerrar las sesiones. Intentá de nuevo.");
      setSigningOutGlobal(false);
      setGlobalSignOutOpen(false);
    }
  }, [router, toast]);

  const handleDeleteAccount = useCallback(async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/perfil", { method: "DELETE" });
      if (!res.ok) throw new Error("delete_error");
      router.push("/login");
    } catch {
      toast.error("Error al eliminar la cuenta. Intentá más tarde.");
      setDeleting(false);
      setDeleteSheetOpen(false);
    }
  }, [router, toast]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const initials    = getInitials(displayName, email);
  const temaLabel   = TEMAS_OPTS.find((t) => t.value === tema)?.label ?? "Sistema";
  const idiomaLabel = IDIOMAS_OPTS.find((i) => i.value === idioma)?.label ?? "Español";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="flex flex-col min-h-dvh bg-bg">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-20 bg-bg/90 backdrop-blur-md border-b border-line-2 px-5 py-3">
          <span
            className="font-display font-bold uppercase text-ink leading-none"
            style={{ fontSize: 16, letterSpacing: "0.08em" }}
          >
            Percha
          </span>
        </header>

        {/* ── Perfil head — Handoff 16: flex row avatar + info ───────────── */}
        <div className="flex items-center gap-4 px-[22px] pt-2 pb-4">

          {/* Columna avatar */}
          <div className="relative shrink-0">
            <button
              type="button"
              aria-label="Cambiar foto de perfil"
              disabled={avatarUploading}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "relative size-[68px] rounded-full overflow-hidden group",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                avatarUploading && "opacity-70 cursor-not-allowed",
              )}
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt={displayName ?? email} className="size-full object-cover" />
              ) : (
                <div className="size-full bg-accent text-accent-ink grid place-items-center font-display font-bold text-2xl">
                  {initials}
                </div>
              )}
              {/* Overlay cámara en hover/upload */}
              <div
                aria-hidden
                className={cn(
                  "absolute inset-0 flex items-center justify-center transition-opacity duration-150 bg-black/40",
                  avatarUploading ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                )}
              >
                {avatarUploading
                  ? <Loader2 className="size-5 text-white animate-spin" />
                  : <Camera className="size-5 text-white" strokeWidth={1.6} />
                }
              </div>
            </button>

            {/* Badge cámara (siempre visible en mobile) */}
            {!avatarUploading && (
              <button
                type="button"
                aria-label="Cambiar foto de perfil"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-0.5 -right-0.5 size-6 rounded-full bg-ink text-bg flex items-center justify-center border-2 border-bg"
              >
                <Camera className="size-3" strokeWidth={2} />
              </button>
            )}

            {/* Input archivo oculto */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          {/* Columna info */}
          <div className="flex-1 min-w-0">

            {/* Nombre editable */}
            {editingName ? (
              <div className="flex items-center gap-2 mb-0.5">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter")  handleNameSave();
                    if (e.key === "Escape") handleNameCancel();
                  }}
                  maxLength={80}
                  disabled={savingName}
                  autoFocus
                  placeholder="Tu nombre"
                  className={cn(
                    "flex-1 h-9 px-2 text-xl font-bold font-display uppercase tracking-tight",
                    "bg-transparent border-b-2 border-accent outline-none text-ink",
                    "placeholder:text-ink-3 placeholder:normal-case placeholder:tracking-normal",
                  )}
                />
                <button
                  type="button"
                  onClick={handleNameSave}
                  disabled={savingName}
                  aria-label="Guardar nombre"
                  className="size-7 grid place-items-center text-accent hover:text-ink transition-colors disabled:opacity-50"
                >
                  {savingName
                    ? <Loader2 className="size-4 animate-spin" />
                    : <Check className="size-4" strokeWidth={2.5} />
                  }
                </button>
                <button
                  type="button"
                  onClick={handleNameCancel}
                  disabled={savingName}
                  aria-label="Cancelar"
                  className="size-7 grid place-items-center text-ink-3 hover:text-ink transition-colors"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2
                  className="font-display font-semibold uppercase text-ink leading-tight truncate"
                  style={{ fontSize: 24, letterSpacing: "-0.01em" }}
                >
                  {displayName ?? email.split("@")[0]}
                </h2>
                <button
                  type="button"
                  onClick={() => { setNameInput(displayName ?? ""); setEditingName(true); }}
                  aria-label="Editar nombre"
                  className="shrink-0 size-7 grid place-items-center text-ink-3 hover:text-ink transition-colors"
                >
                  <Pencil className="size-3.5" strokeWidth={1.8} />
                </button>
              </div>
            )}

            {/* Email */}
            <p className="text-xs text-ink-3 mt-0.5">{email}</p>

            {/* Stats: número encima, eyebrow abajo — Handoff 16 */}
            <div className="flex gap-4 mt-2.5">
              <div>
                <div className="text-[15px] font-semibold font-mono text-ink leading-none">{prendasCount}</div>
                <div className="eyebrow text-[9px] text-ink-3 mt-0.5">prendas</div>
              </div>
              <div>
                <div className="text-[15px] font-semibold font-mono text-ink leading-none">{looksCount}</div>
                <div className="eyebrow text-[9px] text-ink-3 mt-0.5">looks</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── UBICACIÓN ────────────────────────────────────────────────────── */}
        <SettingsSection label="UBICACIÓN">
          <SettingRow
            icon={MapPin}
            label="Ciudad"
            sublabel={
              ciudadNombre
                ? `${ciudadNombre}${ciudadPais ? `, ${ciudadPais}` : ""}`
                : "Sin configurar — usar geolocalización"
            }
            value={ciudadNombre ? "Cambiar" : "Configurar"}
            onClick={() => setCiudadSheetOpen(true)}
          />
        </SettingsSection>

        {/* ── DATOS PERSONALES (LSI-53) ────────────────────────────────────── */}
        <SettingsSection label="DATOS PERSONALES">
          <SettingRow
            icon={UserRound}
            label="Género, altura y peso"
            sublabel={
              genero
                ? [
                    genero === "hombre" ? "Hombre" : genero === "mujer" ? "Mujer" : "No especificado",
                    alturaCm ? `${alturaCm} cm` : null,
                    pesoKg   ? `${pesoKg} kg`   : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : "Sin completar — necesario para Vestir mi look"
            }
            value="Editar"
            onClick={() => router.push("/perfil/datos")}
          />
        </SettingsSection>

        {/* ── ESTILO (LSI-35) ───────────────────────────────────────────────── */}
        <SettingsSection label="ESTILO">
          {/* Estilos favoritos */}
          <div className="px-[22px] pt-3 pb-[14px]">
            <p className="text-xs text-ink-3 mb-2.5">
              Estilos favoritos
              {savingEstilos && (
                <span className="ml-2 text-accent"> Guardando…</span>
              )}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ESTILOS_OPTS.map(({ value, label }) => (
                <Chip key={value} size="sm" active={estilos.includes(value)} onClick={() => toggleEstilo(value)}>
                  {label}
                </Chip>
              ))}
            </div>
          </div>
          {/* Ocasiones frecuentes */}
          <div className="px-[22px] pt-3 pb-[14px]">
            <p className="text-xs text-ink-3 mb-2.5">
              Ocasiones frecuentes
              {savingOcasiones && (
                <span className="ml-2 text-accent"> Guardando…</span>
              )}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {OCASIONES_OPTS.map(({ value, label }) => (
                <Chip key={value} size="sm" active={ocasiones.includes(value)} onClick={() => toggleOcasion(value)}>
                  {label}
                </Chip>
              ))}
            </div>
          </div>
        </SettingsSection>

        {/* ── USO DE IA ────────────────────────────────────────────────────── */}
        <SettingsSection label="GENERACIONES IA">
          <UsageBars />
        </SettingsSection>

        {/* ── APP (LSI-36) ─────────────────────────────────────────────────── */}
        <SettingsSection label="APP">
          <SettingRow
            icon={Sun}
            label="Tema"
            value={temaLabel}
            onClick={() => setTemaSheetOpen(true)}
          />
          <SettingRow
            icon={Globe}
            label="Idioma"
            value={idiomaLabel}
            onClick={() => handleIdioma(idioma === "es" ? "en" : "es")}
          />
          <SettingRow
            icon={CloudSun}
            label="Clima en generador"
            sublabel={clima ? "Activo — se usa tu ubicación" : "Desactivado"}
            rightSlot={
              <Toggle checked={clima} onChange={handleClima} label="Activar clima en generador" />
            }
          />
          <SettingRow
            icon={Bell}
            label="Notificaciones"
            sublabel="Próximamente"
            rightSlot={
              <Toggle
                checked={false}
                onChange={() => toast.info("Las notificaciones estarán disponibles próximamente.")}
                label="Activar notificaciones"
              />
            }
          />
        </SettingsSection>

        {/* ── CUENTA ───────────────────────────────────────────────────────── */}
        <SettingsSection label="CUENTA">
          <SettingRow
            icon={LogOut}
            label="Cerrar sesión"
            sublabel="Solo en este dispositivo"
            onClick={handleSignOut}
          />
          <SettingRow
            icon={LogOut}
            label="Cerrar todas las sesiones"
            sublabel="Invalida todos los dispositivos"
            onClick={() => setGlobalSignOutOpen(true)}
          />
          <SettingRow
            icon={Trash2}
            label="Eliminar cuenta"
            onClick={() => setDeleteSheetOpen(true)}
            danger
          />
        </SettingsSection>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="flex-1" />
        <div className="py-8 text-center">
          <span className="eyebrow text-[10px] text-ink-3">Percha · v0.1.0 · BETA</span>
        </div>
        <div className="h-2" />
      </div>

      {/* ── Action sheets ─────────────────────────────────────────────────── */}
      <TemaSheet
        visible={temaSheetOpen}
        current={tema}
        onSelect={handleTema}
        onClose={() => setTemaSheetOpen(false)}
      />

      <CiudadSheet
        visible={ciudadSheetOpen}
        currentNombre={ciudadNombre}
        currentPais={ciudadPais}
        onSelect={handleCiudadSelect}
        onRemove={handleCiudadRemove}
        onClose={() => setCiudadSheetOpen(false)}
      />

      <GlobalSignOutSheet
        visible={globalSignOutOpen}
        onConfirm={handleSignOutGlobal}
        onClose={() => setGlobalSignOutOpen(false)}
        loading={signingOutGlobal}
      />

      <DeleteAccountSheet
        visible={deleteSheetOpen}
        email={email}
        onConfirm={handleDeleteAccount}
        onClose={() => setDeleteSheetOpen(false)}
        deleting={deleting}
      />
    </>
  );
}
