"use client";

/**
 * GeneratorResultClient — Handoff 13 · GENERADOR · RESULTADO
 * Ruta: /generador/resultado
 *
 * LOOKSI-019 — Revisar y ajustar look generado:
 * - Swap de prenda individual via POST /api/looks/cambiar-prenda
 * - Botón swap activo en hover/tap por prenda (loading state individual)
 * - Toast "sin alternativas" cuando la IA no encuentra candidatas
 * - Historial de sesión limitado a 5 versiones
 * - Versiones cacheadas client-side (stepper)
 * - "Otro" → regenera look completo con mismos parámetros
 *
 * LOOKSI-020 — Guardar look con nombre y fecha de uso:
 * - Bottom sheet con campo nombre (pre-filled con sugerencia IA)
 * - Selector de fecha de uso (Sin fecha / Hoy / Otra fecha)
 * - POST /api/looks/guardar → redirect a /guardarropas con toast éxito
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import posthog from "@/lib/posthog/client";
import {
  ArrowLeft,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Calendar,
  X,
  User,
  Sparkles,
  Download,
  ImageOff,
} from "lucide-react";
import Link from "next/link";
import { Button, useToast } from "@/components/ui";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { SS_RESULT_KEY, SS_PARAMS_KEY } from "./GeneratorConfigClient";
import type {
  GenerarLookResult,
  PrendaResult,
  ClimaData,
} from "@/app/api/looks/generar/route";

/** Máximo de versiones a guardar en sesión */
const MAX_VERSIONS = 5;

// ── Helpers de fecha ──────────────────────────────────────────────────────────

/** Devuelve la fecha de hoy en formato "YYYY-MM-DD" (local, no UTC). */
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const MONTHS_ES = [
  "ENE", "FEB", "MAR", "ABR", "MAY", "JUN",
  "JUL", "AGO", "SEP", "OCT", "NOV", "DIC",
];

/** Formatea "YYYY-MM-DD" → "22 · MAY · 2026" (mono, diseño Handoff 14). */
function formatDateMono(iso: string): string {
  const [y, m, d] = iso.split("-");
  const month = MONTHS_ES[parseInt(m) - 1] ?? m;
  return `${parseInt(d)} · ${month} · ${y}`;
}

// ── AI Badge ─────────────────────────────────────────────────────────────────

function AIBadge({ size = "sm" }: { size?: "sm" | "lg" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-sans font-semibold",
        "bg-accent-tint text-accent rounded-full px-2 py-0.5",
        size === "lg" ? "text-[11px]" : "text-[10px]",
      )}
    >
      <span aria-hidden>✦</span> IA
    </span>
  );
}

// ── Swap icon ─────────────────────────────────────────────────────────────────

function SwapIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M1 4.5h12M10 2l3 2.5L10 7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13 9.5H1M4 7l-3 2.5L4 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Spinner inline ────────────────────────────────────────────────────────────

function Spinner({ size = 14 }: { size?: number }) {
  return (
    <span
      style={{ width: size, height: size }}
      className="rounded-full border-[1.5px] border-ink border-r-transparent animate-spin inline-block"
    />
  );
}

// ── Garment tile ──────────────────────────────────────────────────────────────

interface GarmentTileProps {
  prenda:      PrendaResult;
  swapping:    boolean;
  onSwap:      (prendaId: string) => void;
}

function GarmentTile({ prenda, swapping, onSwap }: GarmentTileProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="relative bg-surface"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Image area */}
      <div className="relative aspect-[4/5] bg-surface-2 overflow-hidden">
        {prenda.signedUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={prenda.signedUrl}
            alt={prenda.nombre}
            className="w-full h-full object-cover"
          />
        ) : (
          <ColoredPlaceholder color={prenda.color} />
        )}

        {/* Overlay cuando está haciendo swap */}
        {swapping && (
          <div className="absolute inset-0 bg-bg/60 backdrop-blur-[2px] flex items-center justify-center">
            <Spinner size={20} />
          </div>
        )}

        {/* Swap button — visible en hover (desktop) o siempre (touch) */}
        <button
          type="button"
          aria-label={`Cambiar ${prenda.nombre}`}
          disabled={swapping}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSwap(prenda.id);
          }}
          className={cn(
            "absolute top-2 right-2 size-[30px] rounded-full",
            "bg-white/92 backdrop-blur-[6px] border-0",
            "flex items-center justify-center",
            "transition-opacity duration-150",
            "opacity-100 md:opacity-0",
            hovered && "md:opacity-100",
            swapping && "cursor-default",
          )}
        >
          {swapping ? <Spinner size={12} /> : <SwapIcon />}
        </button>
      </div>

      {/* Footer */}
      <div className="px-2.5 py-2">
        <div className="eyebrow text-[9px] mb-0.5">{prenda.categoria}</div>
        <div
          className="font-display font-semibold text-[12px] uppercase tracking-[0.02em] leading-tight truncate"
        >
          {prenda.nombre}
        </div>
      </div>
    </div>
  );
}

function ColoredPlaceholder({ color }: { color: string }) {
  const COLORS: Record<string, [string, string]> = {
    neutro:    ["#e8e3d8", "#d8d0c0"],
    blanco:    ["#f3efe5", "#e5dfd0"],
    negro:     ["#262522", "#15140f"],
    camel:     ["#c2a079", "#a78458"],
    olive:     ["#c9c8b0", "#a8a78a"],
    azul:      ["#8a9aa8", "#647383"],
    rojo:      ["#cc7752", "#a04a2d"],
    verde:     ["#7b8472", "#5e6755"],
    arena:     ["#d6c5a8", "#b8a37e"],
    rosa:      ["#e6cfc9", "#caa8a0"],
    chocolate: ["#5e4a39", "#3f3024"],
    crudo:     ["#ece3d2", "#d4c8af"],
  };
  const key = color.toLowerCase().split(" ")[0];
  const [a, b] = COLORS[key] ?? COLORS.neutro;
  const id     = `ph_${key}_${Math.random().toString(36).slice(2, 6)}`;

  return (
    <svg width="100%" height="100%" style={{ display: "block" }}>
      <defs>
        <pattern
          id={id}
          width="14"
          height="14"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="14" height="14" fill={a} />
          <rect width="7" height="14" fill={b} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} opacity="0.5" />
    </svg>
  );
}

// ── EscenarioSheet ────────────────────────────────────────────────────────────
// Pantalla 23 — SHEET · CONFIGURAR ESCENARIO
// Bottom sheet que aparece al tocar "Vestir mi look".
// Muestra la ocasión pre-llenada y un campo de texto libre de escenario.

interface EscenarioSheetProps {
  open:     boolean;
  ocasion:  string;
  onClose:  () => void;
  onGenerar: (escenario: string) => void;
  loading:  boolean;
}

const ESCENARIO_PLACEHOLDERS = [
  "Oficina moderna con luz natural",
  "Café en el centro de la ciudad",
  "Noche de salida urbana",
  "Parque al aire libre",
  "Reunión de negocios formal",
];

function EscenarioSheet({ open, ocasion, onClose, onGenerar, loading }: EscenarioSheetProps) {
  const [escenario, setEscenario] = useState("");
  const placeholder = ESCENARIO_PLACEHOLDERS[Math.floor(Math.random() * ESCENARIO_PLACEHOLDERS.length)];

  useEffect(() => {
    if (open) setEscenario("");
  }, [open]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/[0.45]"
        aria-hidden
        onClick={loading ? undefined : onClose}
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Configurar escenario"
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 bg-bg rounded-t-[20px]",
          "shadow-[0_-8px_30px_rgba(0,0,0,0.2)]",
          "[animation:sheet-up_280ms_cubic-bezier(0.32,0.72,0,1)_both]",
          "md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2",
          "md:-translate-x-1/2 md:-translate-y-1/2",
          "md:w-full md:max-w-[440px] md:rounded-[20px]",
        )}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-9 h-1 rounded-full bg-line" />
        </div>

        <div className="px-[22px] pb-[max(env(safe-area-inset-bottom),28px)] md:pb-7">

          {/* Header */}
          <div className="flex items-center justify-between py-4 md:py-5">
            <h2
              className="font-display font-semibold uppercase text-ink"
              style={{ fontSize: 24, letterSpacing: "-0.01em" }}
            >
              Configurar escenario
            </h2>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              aria-label="Cerrar"
              className="size-8 grid place-items-center text-ink-2 hover:text-ink disabled:opacity-40 transition-colors"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Ocasión pre-llenada */}
          <div className="mb-5">
            <p className="eyebrow mb-2">OCASIÓN</p>
            <div className="flex items-center gap-2 px-3.5 py-3 border border-line bg-surface">
              <Sparkles className="size-4 text-accent shrink-0" />
              <span className="text-base text-ink capitalize">{ocasion || "Casual"}</span>
            </div>
          </div>

          {/* Campo escenario */}
          <div className="mb-6">
            <p className="eyebrow mb-2">DESCRIBÍ EL ESCENARIO <span className="text-ink-3 lowercase normal-case">(opcional)</span></p>
            <textarea
              value={escenario}
              onChange={(e) => setEscenario(e.target.value)}
              placeholder={placeholder}
              disabled={loading}
              rows={3}
              className={cn(
                "w-full px-3.5 py-3 border border-line bg-surface",
                "text-base text-ink placeholder:text-ink-3",
                "resize-none outline-none",
                "focus:border-ink transition-colors",
                "disabled:opacity-50",
              )}
            />
            <p className="text-xs text-ink-3 mt-1.5">
              Ejemplo: "Terraza de un café en Palermo un domingo por la tarde"
            </p>
          </div>

          {/* CTA */}
          <Button
            type="button"
            variant="accent"
            size="lg"
            fullWidth
            loading={loading}
            icon={!loading ? <Sparkles className="size-4" /> : undefined}
            onClick={() => onGenerar(escenario.trim())}
            disabled={loading}
          >
            {loading ? "Generando…" : "Generar imagen"}
          </Button>
        </div>
      </div>
    </>
  );
}

// ── VestirGeneratingOverlay ────────────────────────────────────────────────────
// Pantalla 24 — GENERANDO · PANTALLA INTERMEDIA
// Full-screen overlay con animación mientras se genera la imagen.

function VestirGeneratingOverlay() {
  return (
    <div className="fixed inset-0 z-50 bg-bg flex flex-col items-center justify-center gap-8">
      {/* Animated ring */}
      <div className="relative size-24">
        <div className="absolute inset-0 rounded-full border-[3px] border-accent-tint" />
        <div
          className="absolute inset-0 rounded-full border-[3px] border-accent border-r-transparent animate-spin"
          style={{ animationDuration: "1.2s" }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <Sparkles className="size-9 text-accent" />
        </div>
      </div>

      {/* Text */}
      <div className="text-center px-8">
        <p
          className="font-display font-semibold uppercase text-ink"
          style={{ fontSize: 24, letterSpacing: "-0.01em" }}
        >
          Generando tu look…
        </p>
        <p className="text-sm text-ink-3 mt-2 leading-relaxed">
          Estamos creando una imagen fotorrealista con tu outfit. Esto puede tardar hasta 30 segundos.
        </p>
      </div>

      {/* Progress dots */}
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="size-2 rounded-full bg-accent"
            style={{
              animation: `pulse 1.4s ease-in-out infinite`,
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ── VestirResultScreen ─────────────────────────────────────────────────────────
// Pantalla 25 — RESULTADO · IMAGEN GENERADA
// Full-screen overlay que muestra la imagen generada con acciones.

interface VestirResultScreenProps {
  imageUrl:      string;
  onClose:       () => void;
  onSave:        () => void;
  onRegenerate:  () => void;
  saving:        boolean;
  regenerating:  boolean;
}

function VestirResultScreen({
  imageUrl,
  onClose,
  onSave,
  onRegenerate,
  saving,
  regenerating,
}: VestirResultScreenProps) {
  const isBusy = saving || regenerating;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">

      {/* Top bar — sobre la imagen */}
      <div
        className={cn(
          "absolute top-0 inset-x-0 z-10 flex items-center justify-between px-4",
          "pt-[max(env(safe-area-inset-top),16px)]",
          "pb-3",
          "bg-gradient-to-b from-black/60 to-transparent",
        )}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          disabled={isBusy}
          className="size-10 rounded-full bg-white/15 backdrop-blur-[6px] grid place-items-center text-white disabled:opacity-40"
        >
          <X className="size-5" />
        </button>
        <span className="eyebrow text-white/70">VESTIR MI LOOK</span>
        <div className="size-10" aria-hidden />
      </div>

      {/* Imagen — ocupa todo el espacio */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt="Look generado"
        className="w-full h-full object-cover"
      />

      {/* Bottom actions */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 z-10",
          "pb-[max(env(safe-area-inset-bottom),20px)]",
          "pt-4 px-5",
          "bg-gradient-to-t from-black/80 to-transparent",
          "flex flex-col gap-2.5",
        )}
      >
        <Button
          type="button"
          variant="accent"
          size="lg"
          fullWidth
          loading={saving}
          icon={!saving ? <Download className="size-4" /> : undefined}
          onClick={onSave}
          disabled={isBusy}
        >
          {saving ? "Guardando…" : "Guardar imagen"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="md"
          fullWidth
          loading={regenerating}
          icon={!regenerating ? <RefreshCw className="size-4" /> : undefined}
          onClick={onRegenerate}
          disabled={isBusy}
          className="text-white border-white/30 hover:bg-white/10"
        >
          Generar otra versión
        </Button>
      </div>
    </div>
  );
}

// ── SaveLookSheet ─────────────────────────────────────────────────────────────
// Handoff 14: bottom sheet mobile / dialog centrado desktop

interface SaveLookSheetProps {
  open:            boolean;
  nombreSugerido:  string;
  /** Hasta 4 prendas para el mini-collage */
  prendas:         PrendaResult[];
  onClose:         () => void;
  onSave:          (nombre: string, fechaUso: string | null) => Promise<void>;
  saving:          boolean;
}

function SaveLookSheet({
  open,
  nombreSugerido,
  prendas,
  onClose,
  onSave,
  saving,
}: SaveLookSheetProps) {
  const dateInputRef                    = useRef<HTMLInputElement>(null);
  const [nombre, setNombre]             = useState(nombreSugerido);
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [nombreError, setNombreError]   = useState("");

  // Reset al abrir
  useEffect(() => {
    if (open) {
      setNombre(nombreSugerido);
      setSelectedDate(todayISO());
      setNombreError("");
    }
  }, [open, nombreSugerido]);

  // Bloquear scroll del body
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  const isToday = selectedDate === todayISO();

  const handleSubmit = async () => {
    const trimmed = nombre.trim();
    if (!trimmed) {
      setNombreError("El nombre del look es requerido.");
      return;
    }
    setNombreError("");
    await onSave(trimmed, selectedDate);
  };

  // Thumbs: hasta 4 prendas para el collage
  const thumbs = prendas.slice(0, 4);

  const inner = (
    <>
      {/* Drag handle (solo mobile) */}
      <div className="flex justify-center pt-3 pb-1 md:hidden">
        <div className="w-9 h-1 rounded-full bg-line" />
      </div>

      <div className="px-[22px] pb-[max(env(safe-area-inset-bottom),28px)] md:pb-7">

        {/* Header */}
        <div className="flex items-center justify-between py-4 md:py-5">
          <h2
            className="font-display font-semibold uppercase text-ink"
            style={{ fontSize: 24, letterSpacing: "-0.01em" }}
          >
            Guardar look
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Cerrar"
            className="size-8 grid place-items-center text-ink-2 hover:text-ink disabled:opacity-40 transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Mini collage — 4 thumbs aspect 3/4, gap 6 */}
        {thumbs.length > 0 && (
          <div className="flex gap-1.5 mb-5">
            {thumbs.map((prenda) => (
              <div key={prenda.id} className="flex-1 relative overflow-hidden" style={{ aspectRatio: "3/4" }}>
                {prenda.signedUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={prenda.signedUrl}
                    alt={prenda.nombre}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ColoredPlaceholder color={prenda.color} />
                )}
              </div>
            ))}
            {/* Relleno si hay menos de 4 prendas para mantener proporción */}
            {thumbs.length < 4 && Array.from({ length: 4 - thumbs.length }).map((_, i) => (
              <div key={`empty-${i}`} className="flex-1 bg-surface-2" style={{ aspectRatio: "3/4" }} />
            ))}
          </div>
        )}

        {/* Campo nombre */}
        <div className="mb-[22px]">
          <Input
            label="NOMBRE DEL LOOK"
            ai
            name="nombre"
            value={nombre}
            onChange={(e) => {
              setNombre(e.target.value);
              if (e.target.value.trim()) setNombreError("");
            }}
            placeholder="Ej: Look casual de otoño"
            error={nombreError || undefined}
            disabled={saving}
            autoFocus
          />
        </div>

        {/* Fecha de uso — row tappable → date picker nativo */}
        <div className="mb-[22px]">
          <p className="eyebrow mb-2">FECHA DE USO</p>

          {/* Row tappable */}
          <button
            type="button"
            disabled={saving}
            onClick={() => dateInputRef.current?.showPicker?.()}
            className={cn(
              "w-full flex items-center gap-2.5 px-3.5 py-3",
              "border border-line text-left",
              "hover:bg-surface-2 transition-colors",
              "disabled:opacity-40",
            )}
          >
            <Calendar className="size-4 text-ink-2 shrink-0" />
            <span className="font-mono text-sm text-ink flex-1 tracking-wide">
              {formatDateMono(selectedDate)}
            </span>
            {isToday && (
              <span className="text-[11px] text-ink-3">Hoy</span>
            )}
          </button>

          {/* Date input nativo — invisible, controlado por el botón */}
          <input
            ref={dateInputRef}
            type="date"
            value={selectedDate}
            onChange={(e) => {
              if (e.target.value) setSelectedDate(e.target.value);
            }}
            disabled={saving}
            aria-hidden
            tabIndex={-1}
            className="sr-only"
          />
        </div>

        {/* CTA */}
        <Button
          type="button"
          variant="primary"
          size="lg"
          fullWidth
          loading={saving}
          onClick={handleSubmit}
          disabled={saving}
        >
          {saving ? "Guardando…" : "Confirmar"}
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/[0.45]"
        aria-hidden
        onClick={saving ? undefined : onClose}
      />

      {/* Mobile: bottom sheet / Desktop: dialog centrado max-w-[440px] */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Guardar look"
        className={cn(
          // mobile: bottom sheet
          "fixed inset-x-0 bottom-0 z-50 bg-bg rounded-t-[20px]",
          "shadow-[0_-8px_30px_rgba(0,0,0,0.2)]",
          "[animation:sheet-up_280ms_cubic-bezier(0.32,0.72,0,1)_both]",
          // desktop: dialog centrado
          "md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2",
          "md:-translate-x-1/2 md:-translate-y-1/2",
          "md:w-full md:max-w-[440px] md:rounded-[20px]",
        )}
      >
        {inner}
      </div>
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function GeneratorResultClient() {
  const router    = useRouter();
  const { toast } = useToast();

  // Array de versiones (máx MAX_VERSIONS) — cada swap o regeneración agrega una
  const [versions, setVersions] = useState<GenerarLookResult[]>([]);
  const [vIdx, setVIdx]         = useState(0);

  // Estado global de regeneración completa
  const [regenerating, setRegenerating] = useState(false);

  // ID de la prenda que se está swapeando (null = ninguna)
  const [swappingId, setSwappingId] = useState<string | null>(null);

  // LOOKSI-020 — sheet de guardado
  const [showSaveSheet, setShowSaveSheet] = useState(false);
  const [saving, setSaving]               = useState(false);

  // LOOKSI-035 — Vestir mi look
  const [profileReady, setProfileReady]         = useState<boolean | null>(null); // null=cargando
  const [savedLookId, setSavedLookId]           = useState<string | null>(null);
  const [vestirPhase, setVestirPhase]           = useState<"idle" | "escenario" | "generating" | "result">("idle");
  const [vestirEscenario, setVestirEscenario]   = useState("");
  const [vestirImageUrl, setVestirImageUrl]     = useState<string | null>(null);
  const [vestirImagePath, setVestirImagePath]   = useState<string | null>(null);
  const [vestirSaving, setVestirSaving]         = useState(false);
  const [vestirRegenerating, setVestirRegenerating] = useState(false);

  const paramsRef = useRef<Record<string, unknown> | null>(null);

  // ── Verificar si el perfil tiene datos corporales (LOOKSI-035) ────────────
  useEffect(() => {
    fetch("/api/perfil")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) { setProfileReady(false); return; }
        setProfileReady(
          !!(data.body_photo_url && data.altura_cm && data.peso_kg),
        );
      })
      .catch(() => setProfileReady(false));
  }, []);

  // ── Leer sessionStorage al montar ─────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SS_RESULT_KEY);
      if (!raw) { router.replace("/generador"); return; }
      const result: GenerarLookResult = JSON.parse(raw);
      setVersions([result]);

      const paramsRaw = sessionStorage.getItem(SS_PARAMS_KEY);
      if (paramsRaw) paramsRef.current = JSON.parse(paramsRaw);
    } catch {
      router.replace("/generador");
    }
  }, [router]);

  const current = versions[vIdx];

  // ── Helper: agregar nueva versión (respeta límite MAX_VERSIONS) ────────────
  const pushVersion = (newResult: GenerarLookResult) => {
    setVersions((prev) => {
      const next = [...prev, newResult];
      if (next.length > MAX_VERSIONS) next.splice(0, next.length - MAX_VERSIONS);
      return next;
    });
    setVIdx((prev) => Math.min(prev + 1, MAX_VERSIONS - 1));
    sessionStorage.setItem(SS_RESULT_KEY, JSON.stringify(newResult));
  };

  // ── Regenerar look completo ("Otro") ───────────────────────────────────────
  const handleOtro = async () => {
    if (!paramsRef.current) {
      toast.error("No se encontraron los parámetros. Volvé al generador.");
      return;
    }
    setRegenerating(true);
    try {
      const res = await fetch("/api/looks/generar", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(paramsRef.current),
      });
      if (!res.ok) throw new Error("api_error");
      const result: GenerarLookResult = await res.json();
      pushVersion(result);
      // ── PostHog: look regenerado ──────────────────────────────────────────
      posthog.capture("look_regenerado", {
        modo:    paramsRef.current?.modo,
        ocasion: paramsRef.current?.ocasion,
      });
    } catch {
      toast.error("No se pudo generar otro look. Intentá de nuevo.");
    } finally {
      setRegenerating(false);
    }
  };

  // ── Swap de prenda individual ──────────────────────────────────────────────
  const handleSwap = async (prendaId: string) => {
    if (!current || swappingId || regenerating) return;

    setSwappingId(prendaId);
    try {
      const params = paramsRef.current ?? {};
      const otrasIds = current.prendas_data
        .map((p) => p.id)
        .filter((id) => id !== prendaId);

      const res = await fetch("/api/looks/cambiar-prenda", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          prenda_id_a_reemplazar: prendaId,
          prendas_actuales:       otrasIds,
          ocasion:                params.ocasion ?? "",
          contexto:               params.contexto,
          clima:                  params.clima as ClimaData | undefined,
        }),
      });

      if (res.status === 422) {
        const data = await res.json() as { error: string; message?: string };
        if (data.error === "no_alternatives") {
          toast.warning(
            data.message ?? "No hay alternativas compatibles. Agregá más prendas al guardarropas.",
          );
          return;
        }
        throw new Error("api_422");
      }

      if (!res.ok) throw new Error("api_error");

      const { prenda_nueva } = await res.json() as { prenda_nueva: PrendaResult };

      const nuevasPrendas = current.prendas_data.map((p) =>
        p.id === prendaId ? prenda_nueva : p
      );
      const newVersion: GenerarLookResult = {
        ...current,
        prendas:      nuevasPrendas.map((p) => p.id),
        prendas_data: nuevasPrendas,
      };

      pushVersion(newVersion);
    } catch {
      toast.error("No se pudo cambiar la prenda. Intentá de nuevo.");
    } finally {
      setSwappingId(null);
    }
  };

  // ── Vestir mi look — generar imagen (LOOKSI-035) ──────────────────────────
  const handleVestirGenerar = async (escenario: string) => {
    if (!current) return;

    setVestirEscenario(escenario);
    setVestirPhase("generating");

    try {
      // Auto-guardar el look si aún no está guardado (necesario para generar-imagen)
      let lookId = savedLookId;
      if (!lookId) {
        const saveRes = await fetch("/api/looks/guardar", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            nombre:                current.nombre_sugerido,
            prendas:               current.prendas,
            descripcion_ia:        current.descripcion_look,
            parametros_generacion: current.parametros,
            fecha_uso:             null,
          }),
        });
        if (!saveRes.ok) {
          const d = await saveRes.json().catch(() => ({})) as { message?: string };
          toast.error(d.message ?? "No se pudo guardar el look. Intentá de nuevo.");
          setVestirPhase("escenario");
          return;
        }
        const { id } = await saveRes.json() as { id: string };
        lookId = id;
        setSavedLookId(id);
      }

      const res = await fetch("/api/looks/generar-imagen", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          look_id:  lookId,
          escenario,
          ocasion:  current.parametros.ocasion ?? "",
        }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { message?: string };
        toast.error(d.message ?? "No pudimos generar la imagen. Intentá de nuevo.");
        setVestirPhase("escenario");
        return;
      }

      const { imagen_url, path } = await res.json() as { imagen_url: string; path: string };
      setVestirImageUrl(imagen_url);
      setVestirImagePath(path);
      setVestirPhase("result");

      posthog.capture("vestir_imagen_generada", {
        con_escenario: !!escenario,
        ocasion:       current.parametros.ocasion,
      });

    } catch {
      toast.error("No pudimos generar la imagen. Intentá de nuevo.");
      setVestirPhase("escenario");
    }
  };

  // ── Guardar imagen de "Vestir mi look" ─────────────────────────────────────
  const handleVestirGuardar = async () => {
    if (!vestirImagePath || !current) return;
    setVestirSaving(true);
    try {
      const res = await fetch("/api/looks/guardar-imagen-vestir", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          look_id:            savedLookId,
          vestir_imagen_path: vestirImagePath,
          nombre:             current.nombre_sugerido,
          prendas:            current.prendas,
          descripcion_ia:     current.descripcion_look,
          parametros_generacion: current.parametros,
        }),
      });

      if (!res.ok) {
        toast.error("No se pudo guardar la imagen. Intentá de nuevo.");
        return;
      }

      const { look_id } = await res.json() as { look_id: string };
      if (!savedLookId) setSavedLookId(look_id);

      toast.success("Imagen guardada con tu look");
      setVestirPhase("idle");

      posthog.capture("vestir_imagen_guardada");
    } catch {
      toast.error("No se pudo guardar la imagen. Intentá de nuevo.");
    } finally {
      setVestirSaving(false);
    }
  };

  // ── Regenerar imagen de Vestir mi look ─────────────────────────────────────
  const handleVestirRegenerar = async () => {
    if (!vestirImageUrl) return;
    setVestirRegenerating(true);
    setVestirPhase("escenario"); // volver al sheet con el escenario previo pre-llenado
    setVestirRegenerating(false);
  };

  // ── Guardar look (LOOKSI-020) ──────────────────────────────────────────────
  // Handoff 14: tras guardar — cerrar sheet y quedarse en el resultado (no redirigir)
  const handleSave = async (nombre: string, fechaUso: string | null) => {
    if (!current) return;
    setSaving(true);
    try {
      const res = await fetch("/api/looks/guardar", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          nombre,
          prendas:               current.prendas,
          descripcion_ia:        current.descripcion_look,
          parametros_generacion: current.parametros,
          fecha_uso:             fechaUso,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string; message?: string };
        toast.error(data.message ?? "No se pudo guardar el look. Intentá de nuevo.");
        return;
      }

      const savedData = await res.json().catch(() => ({})) as { id?: string };
      if (savedData.id) setSavedLookId(savedData.id);

      setShowSaveSheet(false);
      toast.success("Look guardado");
      // ── PostHog: look guardado ──────────────────────────────────────────────
      posthog.capture("look_guardado", {
        con_fecha_uso:   !!fechaUso,
        prendas_count:   current?.prendas?.length ?? 0,
      });
    } catch {
      toast.error("No se pudo guardar el look. Intentá de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  // ── Loading state inicial ──────────────────────────────────────────────────
  if (!current) {
    return (
      <div className="flex flex-col min-h-dvh bg-bg items-center justify-center gap-4">
        <span
          aria-label="Cargando"
          className="size-6 rounded-full border-2 border-ink border-r-transparent animate-spin"
        />
        <p className="text-sm text-ink-3">Preparando tu look…</p>
      </div>
    );
  }

  const total      = versions.length;
  const versionNum = vIdx + 1;
  const piezas     = current.prendas_data.length;
  const meta       = [
    current.parametros.ocasion,
    current.parametros.clima
      ? `${current.parametros.clima.temperatura}°`
      : null,
    `${piezas} ${piezas === 1 ? "pieza" : "piezas"}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const isBusy         = regenerating || swappingId !== null || saving;
  const vestirDisabled = profileReady === false;
  const vestirTooltip  = vestirDisabled
    ? "Completá tu foto y datos corporales en el perfil para usar esta función"
    : undefined;

  return (
    <>
      <div className="flex flex-col min-h-dvh bg-bg">
        {/* ── Scrollable content ──────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto pb-[calc(60px+max(env(safe-area-inset-bottom),16px)+80px)] md:pb-4">

          {/* Top bar */}
          <div className="px-5 pt-3 pb-2.5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => router.push("/generador")}
              aria-label="Volver al configurador"
              className="size-9 grid place-items-center text-ink-2 hover:text-ink transition-colors"
            >
              <ArrowLeft className="size-[22px]" />
            </button>
            <span className="eyebrow text-ink-3">
              LOOK · v{versionNum} / {total}
            </span>
            <button
              type="button"
              onClick={handleOtro}
              disabled={isBusy}
              aria-label="Regenerar look"
              className="size-9 grid place-items-center text-ink-2 hover:text-ink transition-colors disabled:opacity-40"
            >
              <RefreshCw
                className={cn("size-[18px]", regenerating && "animate-spin")}
              />
            </button>
          </div>

          {/* Title block */}
          <div className="px-[22px] pb-3.5">
            <div className="flex items-center gap-2 mb-2">
              <AIBadge size="lg" />
              <span className="text-[10px] text-ink-3 uppercase tracking-[0.12em]">
                · {meta}
              </span>
            </div>
            <h1
              className="font-display font-bold uppercase leading-[0.95] text-ink"
              style={{ fontSize: 32 }}
            >
              {current.nombre_sugerido}
            </h1>
            <p className="mt-2 text-[13px] text-ink-2 leading-relaxed italic">
              &ldquo;{current.descripcion_look}&rdquo;
            </p>
          </div>

          {/* Version stepper */}
          {total > 1 && (
            <div className="px-[22px] pb-4 flex items-center gap-3">
              <button
                type="button"
                disabled={vIdx === 0}
                onClick={() => setVIdx((i) => i - 1)}
                aria-label="Versión anterior"
                className="text-ink-3 disabled:opacity-30 hover:text-ink transition-colors"
              >
                <ChevronLeft className="size-3.5" />
              </button>
              <div className="flex gap-1.5 flex-1">
                {versions.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setVIdx(i)}
                    aria-label={`Versión ${i + 1}`}
                    className={cn(
                      "h-[3px] flex-1 transition-colors",
                      i === vIdx ? "bg-ink" : "bg-line",
                    )}
                  />
                ))}
              </div>
              <button
                type="button"
                disabled={vIdx === total - 1}
                onClick={() => setVIdx((i) => i + 1)}
                aria-label="Siguiente versión"
                className="text-ink-3 disabled:opacity-30 hover:text-ink transition-colors"
              >
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          )}

          {/* Garment grid */}
          <div className="px-5 grid grid-cols-2 md:grid-cols-4 gap-2">
            {current.prendas_data.map((prenda) => (
              <Link
                key={prenda.id}
                href={`/guardarropas/${prenda.id}`}
                className="block"
                onClick={(e) => swappingId !== null && e.preventDefault()}
              >
                <GarmentTile
                  prenda={prenda}
                  swapping={swappingId === prenda.id}
                  onSwap={handleSwap}
                />
              </Link>
            ))}
          </div>

          {/* Prendas faltantes */}
          {current.prendas_faltantes.length > 0 && (
            <div className="px-5 mt-4">
              <div className="p-3.5 bg-surface border border-line-2 space-y-1.5">
                <div className="eyebrow text-ink-3 mb-2">PARA COMPLETAR ESTE LOOK</div>
                {current.prendas_faltantes.map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-ink-3 text-sm mt-px">·</span>
                    <span className="text-sm text-ink-2">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hint strip */}
          <div className="px-5 mt-4">
            <div className="flex items-center gap-2.5 px-3 py-3 bg-surface border border-line-2">
              <SwapIcon aria-hidden />
              <span className="text-[12px] text-ink-2 flex-1">
                Tocá <strong>⇄</strong> en cualquier prenda para ver alternativas de tu guardarropas.
              </span>
            </div>
          </div>
        </div>

        {/* ── Sticky actions — Pantalla 22 ────────────────────────────────────── */}
        <div
          className={cn(
            "fixed inset-x-0 z-20",
            "bottom-[calc(60px+max(env(safe-area-inset-bottom),16px))]",
            "px-5 pt-2.5 pb-3 bg-bg border-t border-line-2",
            "flex flex-col gap-2",
            "md:static md:border-t md:px-5 md:pb-8 md:pt-3",
          )}
        >
          {/* Row 1: Otro + Guardar look */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="md"
              className="flex-1"
              loading={regenerating}
              icon={!regenerating ? <RefreshCw className="size-4" /> : undefined}
              onClick={handleOtro}
              disabled={isBusy}
            >
              Otro
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              className="flex-[1.4]"
              onClick={() => setShowSaveSheet(true)}
              disabled={isBusy}
            >
              Guardar look
            </Button>
          </div>

          {/* Row 2: Vestir mi look — Pantalla 22 */}
          <div title={vestirTooltip}>
            <Button
              type="button"
              variant="accent"
              size="md"
              fullWidth
              icon={<User className="size-4" />}
              onClick={() => { if (!vestirDisabled && !isBusy) setVestirPhase("escenario"); }}
              disabled={isBusy || vestirDisabled || profileReady === null}
            >
              {profileReady === null ? "Verificando perfil…" : "Vestir mi look"}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Save bottom sheet (LOOKSI-020) ─────────────────────────────────── */}
      <SaveLookSheet
        open={showSaveSheet}
        nombreSugerido={current.nombre_sugerido}
        prendas={current.prendas_data}
        onClose={() => setShowSaveSheet(false)}
        onSave={handleSave}
        saving={saving}
      />

      {/* ── Pantalla 23: EscenarioSheet ─────────────────────────────────────── */}
      <EscenarioSheet
        open={vestirPhase === "escenario"}
        ocasion={current.parametros.ocasion ?? "Casual"}
        onClose={() => setVestirPhase("idle")}
        onGenerar={handleVestirGenerar}
        loading={vestirPhase === "generating"}
      />

      {/* ── Pantalla 24: Generando ──────────────────────────────────────────── */}
      {vestirPhase === "generating" && <VestirGeneratingOverlay />}

      {/* ── Pantalla 25: Resultado imagen ──────────────────────────────────── */}
      {vestirPhase === "result" && vestirImageUrl && (
        <VestirResultScreen
          imageUrl={vestirImageUrl}
          onClose={() => setVestirPhase("idle")}
          onSave={handleVestirGuardar}
          onRegenerate={handleVestirRegenerar}
          saving={vestirSaving}
          regenerating={vestirRegenerating}
        />
      )}
    </>
  );
}
