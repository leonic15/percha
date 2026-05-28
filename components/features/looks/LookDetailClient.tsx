"use client";

/**
 * LookDetailClient — Handoff 16 (detalle look) + 17 (dialog eliminar)
 * Ruta: /looks/[id]
 * LOOKSI-021
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  Calendar,
  ChevronRight,
  Trash2,
  RefreshCw,
  Sparkles,
  AlertCircle,
  User,
  X,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { LookCollage } from "@/components/ui/LookCard";
import { BottomNav } from "@/components/ui/BottomNav";
import { Sidebar } from "@/components/ui/Sidebar";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import type { LookDetailData, PiezaData } from "@/app/api/looks/[id]/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTHS_ES = [
  "ENE", "FEB", "MAR", "ABR", "MAY", "JUN",
  "JUL", "AGO", "SEP", "OCT", "NOV", "DIC",
];

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  const month = MONTHS_ES[parseInt(m) - 1] ?? m;
  return `${parseInt(d)}·${month}·${y.slice(2)}`;
}

const OCASION_LABELS: Record<string, string> = {
  casual:  "CASUAL",
  trabajo: "TRABAJO",
  formal:  "FORMAL",
  deporte: "DEPORTE",
  salida:  "SALIDA",
};

// ── GlassBtn ──────────────────────────────────────────────────────────────────

function GlassBtn({
  onClick,
  label,
  children,
}: {
  onClick?: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{
        width: 38, height: 38, borderRadius: 9999,
        background: "rgba(255,255,255,0.88)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        border: "none",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer",
        color: "var(--color-ink)",
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

// ── AIBadge ───────────────────────────────────────────────────────────────────

function AIBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm font-mono uppercase text-accent"
      style={{ fontSize: 9, letterSpacing: "0.08em", background: "rgba(107,117,99,0.12)" }}
    >
      <Sparkles className="size-2.5" aria-hidden />
      IA
    </span>
  );
}

// ── StatCell ──────────────────────────────────────────────────────────────────

function StatCell({
  label,
  value,
  large,
}: {
  label: string;
  value: string;
  large?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-3 gap-0.5">
      <div
        className="font-mono uppercase text-ink-3"
        style={{ fontSize: 9, letterSpacing: "0.08em" }}
      >
        {label}
      </div>
      <div
        className={cn(
          "font-mono text-ink font-semibold leading-none",
          large ? "text-lg" : "text-sm",
        )}
      >
        {value}
      </div>
    </div>
  );
}

// ── PieceRow ──────────────────────────────────────────────────────────────────

function PieceRow({ pieza }: { pieza: PiezaData }) {
  const inner = (
    <div className="flex items-center gap-3 py-2 border border-line-2 px-3 rounded-sm bg-surface/60">
      {/* Thumb 52×52 */}
      <div
        className="shrink-0 bg-surface-2 overflow-hidden"
        style={{ width: 52, height: 52 }}
      >
        {pieza.signedUrl && !pieza.eliminada ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pieza.signedUrl}
            alt={pieza.nombre}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-surface-2 grid place-items-center">
            <span className="font-mono text-[8px] text-ink-3 uppercase">—</span>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        {pieza.categoria && !pieza.eliminada && (
          <div
            className="font-mono uppercase text-ink-3 mb-0.5"
            style={{ fontSize: 9, letterSpacing: "0.08em" }}
          >
            {pieza.categoria}
          </div>
        )}
        <div
          className={cn(
            "font-display font-semibold uppercase truncate leading-tight",
            pieza.eliminada ? "text-ink-3 italic" : "text-ink",
          )}
          style={{ fontSize: 13 }}
        >
          {pieza.nombre}
        </div>
      </div>

      {!pieza.eliminada && (
        <ChevronRight className="size-4 text-ink-3 shrink-0" />
      )}
    </div>
  );

  if (pieza.eliminada) return <div>{inner}</div>;
  return (
    <Link href={`/guardarropas/${pieza.id}`} className="block">
      {inner}
    </Link>
  );
}

// ── DeleteDialog (Handoff 17) ─────────────────────────────────────────────────

interface DeleteDialogProps {
  look: LookDetailData;
  onCancel: () => void;
  onDeleted: () => void;
}

function DeleteDialog({ look, onCancel, onDeleted }: DeleteDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const [inlineError, setInlineError] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const { toast } = useToast();

  // Focus inicial en Cancelar (a11y — el destructivo nunca arranca con foco)
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  // Trap focus + Esc
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    setInlineError(false);
    try {
      const res = await fetch(`/api/looks/${look.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("api_error");
      toast.success("Look eliminado");
      onDeleted();
    } catch {
      setInlineError(true);
      setDeleting(false);
    }
  }, [look.id, onCancel, onDeleted, toast]);

  return (
    <>
      {/* Backdrop — tap-out NO cierra */}
      <div
        className="fixed inset-0 z-50"
        style={{ background: "rgba(0,0,0,0.55)", animation: "fadeInBg 200ms ease forwards" }}
        aria-hidden
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="del-title"
        className="fixed z-50 inset-x-5 bg-bg md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-[440px]"
        style={{
          top: "50%",
          transform: "translateX(0) translateY(-50%)",
          boxShadow: "0 8px 48px rgba(0,0,0,0.22)",
          animation: "dialogIn 220ms cubic-bezier(0.32,0.72,0,1) forwards",
        }}
      >
        {/* Cabecera danger */}
        <div
          className="flex flex-col items-center px-[22px] py-[22px] pb-4 border-b border-line-2"
        >
          {/* Círculo con ícono */}
          <div
            className="grid place-items-center mb-[14px]"
            style={{
              width: 56, height: 56, borderRadius: 9999,
              background: "var(--color-danger)",
              color: "#fff",
            }}
          >
            <Trash2 size={24} />
          </div>

          {/* Eyebrow danger */}
          <div
            className="font-mono uppercase text-danger mb-2"
            style={{ fontSize: 9, letterSpacing: "0.12em" }}
          >
            ACCIÓN IRREVERSIBLE
          </div>

          {/* H2 */}
          <h2
            id="del-title"
            className="font-display font-bold text-center text-ink leading-tight"
            style={{ fontSize: 24 }}
          >
            ¿Eliminar{"\n"}este look?
          </h2>
        </div>

        {/* Resumen del look */}
        <div className="flex items-center gap-3 px-[18px] py-4 border-b border-line-2">
          <div className="shrink-0" style={{ width: 60, height: 60 }}>
            <LookCollage images={look.heroImages} size={60} />
          </div>
          <div className="min-w-0">
            <div
              className="font-display font-semibold uppercase truncate text-ink"
              style={{ fontSize: 15 }}
            >
              {look.nombre}
            </div>
            <div
              className="font-mono text-ink-3 uppercase mt-0.5"
              style={{ fontSize: 10, letterSpacing: "0.06em" }}
            >
              {look.piezas.length} PIEZAS · {look.usageCount} USOS
            </div>
          </div>
        </div>

        {/* Body copy */}
        <div className="px-[22px] pt-4 pb-2 text-ink-2" style={{ fontSize: 13, lineHeight: 1.55 }}>
          {look.usageCount > 0 ? (
            <>
              Se va a borrar el look y sus{" "}
              <strong className="text-ink font-medium">{look.usageCount} registros de uso</strong>.{" "}
              Las prendas individuales seguirán en tu guardarropa.
            </>
          ) : (
            <>Las prendas individuales seguirán en tu guardarropa.</>
          )}
        </div>

        {/* Error inline */}
        {inlineError && (
          <div className="mx-[18px] mb-2 flex items-center gap-2 text-danger" style={{ fontSize: 12 }}>
            <AlertCircle size={14} className="shrink-0" />
            No pudimos eliminar el look. Reintentar.
          </div>
        )}

        {/* Acciones */}
        <div className="px-[18px] py-3 pb-[18px] flex flex-col gap-2 md:flex-row-reverse md:gap-2">
          {/* Sí, eliminar */}
          <button
            type="button"
            disabled={deleting}
            onClick={handleDelete}
            className={cn(
              "flex items-center justify-center gap-2 w-full md:flex-1",
              "h-[52px] px-4 font-sans font-medium uppercase tracking-wide text-sm text-white",
              "transition-opacity disabled:opacity-50",
            )}
            style={{ background: "var(--color-danger)", borderRadius: 0 }}
          >
            {deleting ? (
              <>
                <span className="size-[14px] rounded-full border-2 border-white border-r-transparent animate-spin" aria-hidden />
                Eliminando…
              </>
            ) : (
              <>
                <Trash2 size={14} aria-hidden />
                Sí, eliminar
              </>
            )}
          </button>

          {/* Cancelar */}
          <Button
            ref={cancelRef}
            variant="ghost"
            size="lg"
            fullWidth
            disabled={deleting}
            onClick={onCancel}
            className="md:flex-1"
          >
            Cancelar
          </Button>
        </div>
      </div>

      <style>{`
        @keyframes fadeInBg {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes dialogIn {
          from { opacity: 0; transform: translateX(0) translateY(calc(-50% + 12px)) scale(0.96); }
          to   { opacity: 1; transform: translateX(0) translateY(-50%) scale(1); }
        }
      `}</style>
    </>
  );
}

// ── EscenarioSheet (Pantalla 23) ──────────────────────────────────────────────

const ESCENARIO_PLACEHOLDERS = [
  "Oficina moderna con luz natural",
  "Café en el centro de la ciudad",
  "Noche de salida urbana",
  "Parque al aire libre",
  "Reunión de negocios formal",
];

interface EscenarioSheetProps {
  open:      boolean;
  ocasion:   string;
  onClose:   () => void;
  onGenerar: (escenario: string) => void;
  loading:   boolean;
}

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
      <div className="fixed inset-0 z-40 bg-black/[0.45]" aria-hidden onClick={loading ? undefined : onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Configurar escenario"
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 bg-bg rounded-t-[20px]",
          "shadow-[0_-8px_30px_rgba(0,0,0,0.2)]",
          "[animation:sheet-up_280ms_cubic-bezier(0.32,0.72,0,1)_both]",
          "md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2",
          "md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-[440px] md:rounded-[20px]",
        )}
      >
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-9 h-1 rounded-full bg-line" />
        </div>
        <div className="px-[22px] pb-[max(env(safe-area-inset-bottom),28px)] md:pb-7">
          <div className="flex items-center justify-between py-4 md:py-5">
            <h2 className="font-display font-semibold uppercase text-ink" style={{ fontSize: 24, letterSpacing: "-0.01em" }}>
              Configurar escenario
            </h2>
            <button type="button" onClick={onClose} disabled={loading} aria-label="Cerrar"
              className="size-8 grid place-items-center text-ink-2 hover:text-ink disabled:opacity-40 transition-colors">
              <X className="size-5" />
            </button>
          </div>
          <div className="mb-5">
            <p className="font-mono uppercase text-ink-3 mb-2" style={{ fontSize: 9, letterSpacing: "0.1em" }}>OCASIÓN</p>
            <div className="flex items-center gap-2 px-3.5 py-3 border border-line bg-surface">
              <Sparkles className="size-4 text-accent shrink-0" />
              <span className="text-base text-ink capitalize">{ocasion || "Casual"}</span>
            </div>
          </div>
          <div className="mb-6">
            <p className="font-mono uppercase text-ink-3 mb-2" style={{ fontSize: 9, letterSpacing: "0.1em" }}>
              DESCRIBÍ EL ESCENARIO <span className="text-ink-3 lowercase normal-case">(opcional)</span>
            </p>
            <textarea
              value={escenario}
              onChange={(e) => setEscenario(e.target.value)}
              placeholder={placeholder}
              disabled={loading}
              rows={3}
              className={cn(
                "w-full px-3.5 py-3 border border-line bg-surface",
                "text-base text-ink placeholder:text-ink-3",
                "resize-none outline-none focus:border-ink transition-colors disabled:opacity-50",
              )}
            />
            <p className="text-xs text-ink-3 mt-1.5">Ejemplo: "Terraza de un café en Palermo un domingo por la tarde"</p>
          </div>
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

// ── VestirGeneratingOverlay (Pantalla 24) ─────────────────────────────────────

function VestirGeneratingOverlay() {
  return (
    <div className="fixed inset-0 z-50 bg-bg flex flex-col items-center justify-center gap-8">
      <div className="relative size-24">
        <div className="absolute inset-0 rounded-full border-[3px] border-accent-tint" />
        <div className="absolute inset-0 rounded-full border-[3px] border-accent border-r-transparent animate-spin" style={{ animationDuration: "1.2s" }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <Sparkles className="size-9 text-accent" />
        </div>
      </div>
      <div className="text-center px-8">
        <p className="font-display font-semibold uppercase text-ink" style={{ fontSize: 24, letterSpacing: "-0.01em" }}>
          Generando tu look…
        </p>
        <p className="text-sm text-ink-3 mt-2 leading-relaxed">
          Estamos creando una imagen fotorrealista con tu outfit. Esto puede tardar hasta 30 segundos.
        </p>
      </div>
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="size-2 rounded-full bg-accent"
            style={{ animation: "pulse 1.4s ease-in-out infinite", animationDelay: `${i * 0.2}s` }} />
        ))}
      </div>
    </div>
  );
}

// ── VestirResultScreen (Pantalla 25) ──────────────────────────────────────────

interface VestirResultScreenProps {
  imageUrl:     string;
  onClose:      () => void;
  onSave:       () => void;
  onRegenerate: () => void;
  saving:       boolean;
  regenerating: boolean;
}

function VestirResultScreen({ imageUrl, onClose, onSave, onRegenerate, saving, regenerating }: VestirResultScreenProps) {
  const isBusy = saving || regenerating;
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className={cn(
        "absolute top-0 inset-x-0 z-10 flex items-center justify-between px-4",
        "pt-[max(env(safe-area-inset-top),16px)] pb-3",
        "bg-gradient-to-b from-black/60 to-transparent",
      )}>
        <button type="button" onClick={onClose} aria-label="Cerrar" disabled={isBusy}
          className="size-10 rounded-full bg-white/15 backdrop-blur-[6px] grid place-items-center text-white disabled:opacity-40">
          <X className="size-5" />
        </button>
        <span className="font-mono uppercase text-white/70" style={{ fontSize: 10, letterSpacing: "0.08em" }}>VESTIR MI LOOK</span>
        <div className="size-10" aria-hidden />
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt="Look generado" className="w-full h-full object-cover" />
      <div className={cn(
        "absolute inset-x-0 bottom-0 z-10",
        "pb-[max(env(safe-area-inset-bottom),20px)] pt-4 px-5",
        "bg-gradient-to-t from-black/80 to-transparent flex flex-col gap-2.5",
      )}>
        <Button type="button" variant="accent" size="lg" fullWidth loading={saving}
          icon={!saving ? <Download className="size-4" /> : undefined} onClick={onSave} disabled={isBusy}>
          {saving ? "Guardando…" : "Guardar imagen"}
        </Button>
        <Button type="button" variant="ghost" size="md" fullWidth loading={regenerating}
          icon={!regenerating ? <RefreshCw className="size-4" /> : undefined} onClick={onRegenerate} disabled={isBusy}
          className="text-white border-white/30 hover:bg-white/10">
          Generar otra versión
        </Button>
      </div>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function LookDetailSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="w-full bg-surface-2" style={{ height: 360 }} />
      <div className="px-[22px] pt-5 space-y-3">
        <div className="h-3 w-24 bg-surface-2 rounded" />
        <div className="h-8 w-3/4 bg-surface-2 rounded" />
        <div className="h-16 bg-surface-2 rounded" />
      </div>
      <div className="px-5 mt-4 space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 bg-surface-2 rounded" />
        ))}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface LookDetailClientProps {
  detail: LookDetailData;
}

export function LookDetailClient({ detail }: LookDetailClientProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [data, setData] = useState<LookDetailData>(detail);
  const [showDelete, setShowDelete] = useState(false);
  const [loggingUso, setLoggingUso] = useState(false);

  // Vestir mi look
  const [profileReady, setProfileReady]               = useState<boolean | null>(null);
  const [vestirPhase, setVestirPhase]                 = useState<"idle" | "escenario" | "generating" | "result">("idle");
  const [vestirImageUrl, setVestirImageUrl]           = useState<string | null>(null);
  const [vestirImagePath, setVestirImagePath]         = useState<string | null>(null);
  const [vestirSaving, setVestirSaving]               = useState(false);
  const [vestirRegenerating, setVestirRegenerating]   = useState(false);

  useEffect(() => {
    fetch("/api/perfil")
      .then((r) => (r.ok ? r.json() : null))
      .then((perfil) => {
        if (!perfil) { setProfileReady(false); return; }
        setProfileReady(!!(perfil.body_photo_url && perfil.altura_cm && perfil.peso_kg));
      })
      .catch(() => setProfileReady(false));
  }, []);

  const handleVestirGenerar = useCallback(async (escenario: string) => {
    setVestirPhase("generating");
    try {
      const res = await fetch("/api/looks/generar-imagen", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ look_id: data.id, escenario, ocasion: data.ocasion }),
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
    } catch {
      toast.error("No pudimos generar la imagen. Intentá de nuevo.");
      setVestirPhase("escenario");
    }
  }, [data.id, data.ocasion, toast]);

  const handleVestirGuardar = useCallback(async () => {
    if (!vestirImagePath) return;
    setVestirSaving(true);
    try {
      const res = await fetch("/api/looks/guardar-imagen-vestir", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ look_id: data.id, vestir_imagen_path: vestirImagePath }),
      });
      if (!res.ok) { toast.error("No se pudo guardar la imagen. Intentá de nuevo."); return; }
      toast.success("Imagen guardada con tu look");
      setVestirPhase("idle");
    } catch {
      toast.error("No se pudo guardar la imagen. Intentá de nuevo.");
    } finally {
      setVestirSaving(false);
    }
  }, [data.id, vestirImagePath, toast]);

  const handleVestirRegenerar = useCallback(() => {
    setVestirPhase("escenario");
  }, []);

  const handleUsarHoy = useCallback(async () => {
    setLoggingUso(true);
    try {
      const res = await fetch(`/api/looks/${data.id}/log`, { method: "POST" });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData((prev) => ({
        ...prev,
        usageCount:  json.usageCount,
        lastUsedISO: json.lastUsedISO,
      }));
      toast.success("Registrado para hoy");
    } catch {
      toast.error("No se pudo registrar el uso. Intentá de nuevo.");
    } finally {
      setLoggingUso(false);
    }
  }, [data.id, toast]);

  const handleDeleted = useCallback(() => {
    setShowDelete(false);
    router.replace("/looks");
  }, [router]);

  const handleRegenerar = useCallback(() => {
    const params = new URLSearchParams();
    if (data.ocasion) params.set("ocasion", data.ocasion);
    if (data.contexto) params.set("contexto", data.contexto);
    router.push(`/generador?${params.toString()}`);
  }, [data.ocasion, data.contexto, router]);

  const ocasionLabel = OCASION_LABELS[data.ocasion] ?? data.ocasion.toUpperCase();
  const piezasCount = data.piezas.length;

  return (
    <>
      {/* ── Layout wrapper ─────────────────────────────────────────────────── */}
      <div className="flex min-h-dvh bg-bg">

        {/* Desktop sidebar */}
        <div className="hidden md:block">
          <Sidebar />
        </div>

        <div className="flex-1 flex flex-col md:flex-row md:gap-0 min-w-0">

          {/* ── LEFT: Hero collage ─────────────────────────────────────────── */}
          <div
            className="relative w-full md:w-1/2 md:sticky md:top-6 md:self-start"
            style={{ height: 360 }}
          >
            {/* Collage full-bleed 390×360 */}
            <div className="w-full h-full">
              <div
                className="grid grid-cols-2 grid-rows-2 gap-px bg-surface-2 w-full h-full"
              >
                {[...data.heroImages, "", "", "", ""].slice(0, 4).map((src, i) => (
                  <div key={i} className="relative bg-surface-2 overflow-hidden">
                    {src && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={src}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Top bar flotante (mobile) / breadcrumb (desktop dentro del content) */}
            <div
              className="absolute top-[56px] left-0 right-0 px-4 flex items-center justify-between md:hidden"
            >
              <GlassBtn label="Volver" onClick={() => router.back()}>
                <ArrowLeft size={18} />
              </GlassBtn>
              <div className="flex items-center gap-2">
                <GlassBtn label="Editar look">
                  <Pencil size={15} />
                </GlassBtn>
                <GlassBtn label="Agendar uso">
                  <Calendar size={15} />
                </GlassBtn>
              </div>
            </div>

            {/* Pill meta bottom-left */}
            <div
              className="absolute left-4 bottom-3 flex items-center gap-1.5 px-3 py-1.5"
              style={{ background: "rgba(0,0,0,0.72)", borderRadius: 9999 }}
            >
              {/* Dot pulse */}
              <span
                className="relative flex size-2"
                aria-hidden
              >
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-accent" />
              </span>
              <span
                className="font-mono uppercase text-white"
                style={{ fontSize: 10, letterSpacing: "0.08em" }}
              >
                LOOK · {piezasCount} {piezasCount === 1 ? "PIEZA" : "PIEZAS"}
              </span>
            </div>
          </div>

          {/* ── RIGHT: Content ─────────────────────────────────────────────── */}
          <div className="flex-1 flex flex-col min-w-0 pb-32 md:pb-8">

            {/* Breadcrumb desktop */}
            <div className="hidden md:flex items-center gap-2 px-8 pt-6 pb-0">
              <GlassBtn label="Volver" onClick={() => router.back()}>
                <ArrowLeft size={18} />
              </GlassBtn>
              <nav
                className="font-mono text-ink-3 text-xs uppercase tracking-wide ml-2"
                aria-label="Breadcrumb"
              >
                <Link href="/looks" className="hover:text-ink transition-colors">Looks</Link>
                <span className="mx-1.5">/</span>
                <span className="text-ink">{data.nombre}</span>
              </nav>
            </div>

            {/* Title block */}
            <div className="px-[22px] pt-5">
              {/* Eyebrow meta */}
              <div
                className="font-mono uppercase text-ink-3 mb-2"
                style={{ fontSize: 10, letterSpacing: "0.08em" }}
              >
                {[ocasionLabel].filter(Boolean).join(" · ")}
              </div>

              {/* H1 */}
              <h1
                className="font-display font-bold uppercase text-ink leading-tight"
                style={{ fontSize: 32, letterSpacing: "-0.01em" }}
              >
                {data.nombre}
              </h1>

              {/* AI description box */}
              {data.descripcion_ia && (
                <div
                  className="relative mt-3 px-4 py-3"
                  style={{ background: "var(--color-accent-tint, rgba(107,117,99,0.08))", borderRadius: 2 }}
                >
                  <div className="absolute top-2 right-2">
                    <AIBadge />
                  </div>
                  <p
                    className="italic text-ink-2 pr-10"
                    style={{ fontSize: 13, lineHeight: 1.6 }}
                  >
                    "{data.descripcion_ia}"
                  </p>
                </div>
              )}
            </div>

            {/* Stats row */}
            <div className="mt-4 mx-[22px] grid grid-cols-3 border-t border-b border-line-2">
              <StatCell
                label="Creado"
                value={formatDate(data.created_at.slice(0, 10))}
              />
              <div className="border-l border-r border-line-2">
                <StatCell
                  label="Último uso"
                  value={data.lastUsedISO ? formatDate(data.lastUsedISO) : "—"}
                />
              </div>
              <StatCell
                label="Usos"
                value={String(data.usageCount)}
                large
              />
            </div>

            {/* Sección piezas */}
            <div className="mt-5 px-[22px]">
              <div className="flex items-center justify-between mb-3">
                <div
                  className="font-mono uppercase text-ink-3"
                  style={{ fontSize: 9, letterSpacing: "0.1em" }}
                >
                  LAS PIEZAS · {piezasCount}
                </div>
              </div>

              {/* Lista vertical mobile / grid 2 cols desktop */}
              <div className="flex flex-col gap-2 md:grid md:grid-cols-2">
                {data.piezas.map((pieza, i) => (
                  <PieceRow key={pieza.id || i} pieza={pieza} />
                ))}
              </div>
            </div>

            {/* Acciones primarias */}
            <div className="mt-6 px-[22px] flex gap-3">
              <Button
                variant="primary"
                size="lg"
                fullWidth
                loading={loggingUso}
                icon={<Calendar size={16} />}
                onClick={handleUsarHoy}
              >
                Usar hoy
              </Button>
              <Button
                variant="ghost"
                size="lg"
                fullWidth
                icon={<RefreshCw size={16} />}
                onClick={handleRegenerar}
              >
                Regenerar
              </Button>
            </div>

            {/* Vestir mi look */}
            <div
              className="mt-3 px-[22px]"
              title={profileReady === false ? "Completá tu foto y datos corporales en el perfil para usar esta función" : undefined}
            >
              <Button
                variant="accent"
                size="lg"
                fullWidth
                icon={<User size={16} />}
                onClick={() => { if (profileReady === true) setVestirPhase("escenario"); }}
                disabled={profileReady !== true}
              >
                {profileReady === null ? "Verificando perfil…" : "Vestir mi look"}
              </Button>
            </div>

            {/* Danger zone */}
            <div className="mt-8 px-[22px] flex flex-col items-center">
              <button
                type="button"
                onClick={() => setShowDelete(true)}
                className="flex items-center justify-center gap-2 w-full h-11 border font-sans font-medium uppercase tracking-wide text-sm transition-opacity hover:opacity-80"
                style={{
                  borderColor: "var(--color-danger)",
                  color: "var(--color-danger)",
                  borderRadius: 0,
                }}
              >
                <Trash2 size={15} aria-hidden />
                Eliminar look
              </button>
              <p
                className="mt-2 text-ink-3 text-center"
                style={{ fontSize: 11 }}
              >
                Las prendas individuales seguirán en tu guardarropa.
              </p>
            </div>
          </div>
        </div>

        {/* Mobile bottom nav */}
        <div className="md:hidden">
          <BottomNav />
        </div>
      </div>

      {/* ── Delete dialog (Handoff 17) ──────────────────────────────────────── */}
      {showDelete && (
        <DeleteDialog
          look={data}
          onCancel={() => setShowDelete(false)}
          onDeleted={handleDeleted}
        />
      )}

      {/* ── Pantalla 23: EscenarioSheet ─────────────────────────────────────── */}
      <EscenarioSheet
        open={vestirPhase === "escenario"}
        ocasion={data.ocasion}
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
