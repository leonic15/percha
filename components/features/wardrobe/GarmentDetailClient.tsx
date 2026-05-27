"use client";

import { useState, useTransition, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Heart, ArrowLeft, Pencil, Trash2, Sparkles, RefreshCw } from "lucide-react";
import { Chip } from "@/components/ui/Chip";
import { BottomNav } from "@/components/ui/BottomNav";
import { Sidebar } from "@/components/ui/Sidebar";
import { useToast } from "@/components/ui/Toast";
import { GarmentImage } from "@/components/ui/GarmentImage";
import type { Prenda, Category } from "@/lib/database.types";
import type { GarmentAnalysis } from "@/app/api/prendas/analizar/route";
import { cn } from "@/lib/cn";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type GarmentWithMeta = Prenda & {
  signedUrl: string | null;
  category: Pick<Category, "nombre" | "slug"> | null;
};

interface GarmentDetailClientProps {
  garment: GarmentWithMeta;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Formatea fecha ISO en "DD·MMM·YY" (ej. "14·MAR·25") */
function formatDateShort(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const mon = d.toLocaleString("es-AR", { month: "short" }).toUpperCase().replace(".", "");
  const yr  = String(d.getFullYear()).slice(-2);
  return `${day}·${mon}·${yr}`;
}

// ── Labels de dominio ─────────────────────────────────────────────────────────

const SEASON_LABELS: Record<string, string> = {
  primavera: "Primavera",
  verano:    "Verano",
  "otoño":   "Otoño",
  invierno:  "Invierno",
  todo_el_año: "Todo el año",
};

const OCCASION_LABELS: Record<string, string> = {
  casual:  "Casual",
  trabajo: "Trabajo",
  formal:  "Formal",
  deporte: "Deporte",
  salida:  "Salida",
};

const STYLE_LABELS: Record<string, string> = {
  clasico:      "Clásico",
  minimalista:  "Minimalista",
  bohemio:      "Bohemio",
  urbano:       "Urbano",
  romantico:    "Romántico",
  sporty:       "Sporty",
  elegante:     "Elegante",
  vintage:      "Vintage",
};

// ── Botón de círculo glass (top bar) ─────────────────────────────────────────

function GlassBtn({
  onClick,
  children,
  label,
  danger,
}: {
  onClick?: () => void;
  children: React.ReactNode;
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{
        width: 38, height: 38,
        borderRadius: 9999,
        background: "rgba(255,255,255,0.85)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        border: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        color: danger ? "var(--color-danger)" : "var(--color-ink)",
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

// ── Dialog de confirmación ────────────────────────────────────────────────────

function ConfirmDeleteDialog({
  onConfirm,
  onCancel,
  loading,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        background: "rgba(0,0,0,0.45)",
        padding: "0 0 env(safe-area-inset-bottom)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          background: "var(--color-bg)",
          borderRadius: "20px 20px 0 0",
          padding: "28px 24px 32px",
          animation: "sheet-up 220ms cubic-bezier(0.32,0.72,0,1) both",
        }}
        className="md:rounded-2xl md:mb-8 md:max-w-sm"
      >
        {/* Drag handle */}
        <div style={{
          width: 36, height: 4,
          background: "var(--color-line)",
          borderRadius: 999,
          margin: "0 auto 24px",
        }} />

        <h2
          id="dialog-title"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 20,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.02em",
            marginBottom: 10,
            color: "var(--color-ink)",
          }}
        >
          Eliminar prenda
        </h2>

        <p style={{ fontSize: 14, color: "var(--color-ink-2)", marginBottom: 28, lineHeight: 1.5 }}>
          Esta acción no se puede deshacer. La prenda se eliminará de tu guardarropa y de todos los looks donde aparece.
        </p>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{
              flex: 1,
              height: 48,
              borderRadius: "var(--radius-button)",
              border: "1px solid var(--color-line)",
              background: "transparent",
              color: "var(--color-ink)",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            style={{
              flex: 1,
              height: 48,
              borderRadius: "var(--radius-button)",
              border: "none",
              background: "var(--color-danger)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              opacity: loading ? 0.65 : 1,
            }}
          >
            {loading ? "Eliminando…" : "Eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Inline scan overlay (LOOKSI-016) ─────────────────────────────────────────

const SCAN_STEPS = [
  "Detectando contornos",
  "Identificando colores",
  "Clasificando estilo",
  "Generando sugerencias",
] as const;

interface InlineScanOverlayProps {
  /** null = analizando · string = error · false = no se muestra */
  error:       string | null;
  doneSteps:   boolean[];
  activeStep:  number;
  onRetry:     () => void;
}

function InlineScanOverlay({
  error,
  doneSteps,
  activeStep,
  onRetry,
}: InlineScanOverlayProps) {
  return (
    <div
      style={{
        padding: "18px 16px",
        background: "var(--color-surface)",
        border: "1px solid var(--color-line-2)",
        borderRadius: 4,
        marginBottom: 24,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 16,
        }}
      >
        {/* Spinner / check */}
        {!error ? (
          <span
            aria-hidden
            style={{
              display: "inline-block",
              width: 16,
              height: 16,
              borderRadius: 999,
              border: "2px solid var(--color-accent)",
              borderTopColor: "transparent",
              animation: "spin 0.9s linear infinite",
            }}
          />
        ) : (
          <RefreshCw size={15} style={{ color: "var(--color-danger)" }} />
        )}
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: error ? "var(--color-danger)" : "var(--color-accent)",
          }}
        >
          {error ? "Error en el análisis" : "✦ Analizando con IA"}
        </span>
      </div>

      {/* Steps */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {SCAN_STEPS.map((label, i) => {
          const done   = doneSteps[i];
          const active = !done && i === activeStep;
          return (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* Indicador */}
              <div
                style={{
                  position: "relative",
                  width: 16,
                  height: 16,
                  borderRadius: 999,
                  flexShrink: 0,
                  background: done ? "var(--color-accent)" : "transparent",
                  border: done
                    ? "none"
                    : `1.5px solid ${active ? "transparent" : "var(--color-line)"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {done && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
                    <path
                      d="M1.5 5L4 7.5L8.5 2.5"
                      stroke="white"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
                {active && (
                  <span
                    aria-hidden
                    style={{
                      position: "absolute",
                      inset: -2,
                      borderRadius: 999,
                      border: "2px solid var(--color-accent)",
                      borderTopColor: "transparent",
                      animation: "spin 1s linear infinite",
                    }}
                  />
                )}
              </div>
              <span
                style={{
                  fontSize: 12,
                  color: done || active ? "var(--color-ink)" : "var(--color-ink-3)",
                  fontWeight: active ? 500 : 400,
                }}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Error message + retry */}
      {error && (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontSize: 12, color: "var(--color-danger)", margin: "0 0 10px" }}>
            {error}
          </p>
          <button
            type="button"
            onClick={onRetry}
            style={{
              fontSize: 12,
              color: "var(--color-accent)",
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              textDecoration: "underline",
              textUnderlineOffset: 2,
            }}
          >
            Reintentar análisis →
          </button>
        </div>
      )}
    </div>
  );
}

// ── Skeleton de carga (usado por Suspense boundary superior) ─────────────────

export function GarmentDetailSkeleton() {
  return (
    <div style={{ minHeight: "100dvh", background: "var(--color-bg)" }}>
      {/* Hero skeleton */}
      <div
        className="animate-pulse bg-surface-2"
        style={{ width: "100%", aspectRatio: "1/1.15" }}
      />
      <div style={{ padding: "22px 22px 0" }}>
        {/* eyebrow */}
        <div className="animate-pulse bg-surface-2" style={{ height: 10, width: 100, borderRadius: 4, marginBottom: 12 }} />
        {/* h1 */}
        <div className="animate-pulse bg-surface-2" style={{ height: 32, width: "65%", borderRadius: 4, marginBottom: 8 }} />
        <div className="animate-pulse bg-surface-2" style={{ height: 32, width: "45%", borderRadius: 4, marginBottom: 24 }} />
        {/* AI box */}
        <div className="animate-pulse bg-surface-2" style={{ height: 80, borderRadius: 4, marginBottom: 24 }} />
        {/* chips */}
        {[0,1,2].map((i) => (
          <div key={i} style={{ marginBottom: 18 }}>
            <div className="animate-pulse bg-surface-2" style={{ height: 10, width: 70, borderRadius: 4, marginBottom: 10 }} />
            <div style={{ display: "flex", gap: 6 }}>
              <div className="animate-pulse bg-surface-2" style={{ height: 28, width: 64, borderRadius: 999 }} />
              <div className="animate-pulse bg-surface-2" style={{ height: 28, width: 80, borderRadius: 999 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────

export function GarmentDetailClient({ garment }: GarmentDetailClientProps) {
  const router  = useRouter();
  const { toast } = useToast();

  // Favorito — optimistic
  const [isFavorite, setIsFavorite] = useState(garment.is_favorite);
  const [favoriteLoading, setFavoriteLoading] = useState(false);

  // Dialog eliminar
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [, startDelete] = useTransition();
  const [deleteLoading, setDeleteLoading] = useState(false);

  // LOOKSI-016 — Análisis IA inline
  const [iaDescripcion, setIaDescripcion] = useState(garment.ia_descripcion);
  const [iaAnalizada,   setIaAnalizada]   = useState(garment.ia_analizada);
  const [analyzing,     setAnalyzing]     = useState(false);
  const [analyzeError,  setAnalyzeError]  = useState<string | null>(null);
  const [doneSteps,     setDoneSteps]     = useState<boolean[]>([false, false, false, false]);
  const [activeStep,    setActiveStep]    = useState(0);
  const analyzeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Nombres de categoría
  const categoryName  = garment.category?.nombre ?? "";
  const colorDisplay  = garment.color_principal
    ? garment.color_principal.charAt(0).toUpperCase() + garment.color_principal.slice(1)
    : "";
  const eyebrow = [categoryName, colorDisplay].filter(Boolean).join(" · ").toUpperCase();

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleToggleFavorite = useCallback(async () => {
    if (favoriteLoading) return;
    const prev = isFavorite;
    setIsFavorite(!prev); // optimistic
    setFavoriteLoading(true);
    try {
      const res = await fetch(`/api/garments/${garment.id}/favorite`, { method: "POST" });
      if (!res.ok) throw new Error("network");
      const json = await res.json() as { is_favorite: boolean };
      setIsFavorite(json.is_favorite);
    } catch {
      setIsFavorite(prev); // revert
      toast.error("No se pudo actualizar favorito");
    } finally {
      setFavoriteLoading(false);
    }
  }, [favoriteLoading, isFavorite, garment.id, toast]);

  const handleDeleteConfirm = useCallback(() => {
    setDeleteLoading(true);
    startDelete(async () => {
      try {
        const res = await fetch(`/api/garments/${garment.id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("network");
        toast.success("Prenda eliminada");
        router.replace("/guardarropas");
      } catch {
        setDeleteLoading(false);
        setShowDeleteDialog(false);
        toast.error("No se pudo eliminar la prenda");
      }
    });
  }, [garment.id, router, toast]);

  const handleEditClick = useCallback(() => {
    // LOOKSI-011 (próximo): por ahora navega a la ruta de edición
    router.push(`/guardarropas/${garment.id}/editar`);
  }, [garment.id, router]);

  /** LOOKSI-016 — Lanza análisis IA desde el detalle */
  const handleAnalyze = useCallback(async () => {
    if (analyzing) return;

    // Reset
    setAnalyzing(true);
    setAnalyzeError(null);
    setDoneSteps([false, false, false, false]);
    setActiveStep(0);

    // Animación de pasos mientras esperamos la API
    const STEP_MS = [900, 800, 700];
    const advanceSteps = async () => {
      for (let i = 0; i < 3; i++) {
        await new Promise<void>((r) => {
          analyzeTimerRef.current = setTimeout(r, STEP_MS[i]);
        });
        setDoneSteps((prev) => prev.map((v, idx) => idx <= i ? true : v));
        setActiveStep(i + 1);
      }
    };

    const stepsPromise = advanceSteps();

    try {
      const res = await fetch(`/api/garments/${garment.id}/analizar`, { method: "POST" });

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string; message?: string };
        const msg = data.error === "sin_imagen"
          ? "Esta prenda no tiene imagen. Agregá una foto primero."
          : data.error === "ai_timeout"
          ? "El análisis tardó demasiado. Intentá de nuevo."
          : "No se pudo analizar la prenda. Intentá de nuevo.";
        throw new Error(msg);
      }

      const analysis: GarmentAnalysis = await res.json();

      // Esperar que terminen los steps visuales antes de marcar completo
      await stepsPromise;
      setDoneSteps([true, true, true, true]);
      setActiveStep(4);

      // Actualizar estado local
      setIaDescripcion(analysis.descripcion ?? null);
      setIaAnalizada(true);

      await new Promise<void>((r) => setTimeout(r, 400));
      setAnalyzing(false);
      toast.success("Análisis completado");

    } catch (err: unknown) {
      if (analyzeTimerRef.current) clearTimeout(analyzeTimerRef.current);
      const msg = err instanceof Error ? err.message : "No se pudo analizar la prenda.";
      setAnalyzeError(msg);
      setAnalyzing(false);
    }
  }, [analyzing, garment.id, toast]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Layout wrapper: mobile columna, desktop grid 2 cols */}
      <div
        className="md:grid md:gap-0"
        style={{
          minHeight: "100dvh",
          background: "var(--color-bg)",
          // Desktop: sidebar 240px + content
        }}
      >
        {/* Desktop sidebar */}
        <div className="hidden md:block">
          <Sidebar />
        </div>

        {/* Contenido principal */}
        <div
          className="md:ml-60"
          style={{ minHeight: "100dvh", paddingBottom: 88 }}
        >
          {/* ── Desktop: breadcrumb en vez de top bar flotante ── */}
          <div
            className="hidden md:flex items-center gap-3 px-8 py-5 border-b"
            style={{ borderColor: "var(--color-line)" }}
          >
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-1.5 text-ink-2 hover:text-ink transition-colors"
              style={{ fontSize: 13, background: "none", border: "none", cursor: "pointer" }}
            >
              <ArrowLeft size={16} />
              Guardarropas
            </button>
            <span style={{ color: "var(--color-ink-3)", fontSize: 13 }}>/</span>
            <span style={{ fontSize: 13, color: "var(--color-ink)" }}>{garment.nombre}</span>
          </div>

          {/* ── Cuerpo — mobile: columna / desktop: two-column ── */}
          <div className="md:flex md:gap-0">

            {/* ─── Foto: full-width mobile, sticky izq 50% desktop ─── */}
            <div
              className="md:sticky md:top-6 md:w-1/2 md:self-start"
              style={{ position: "relative" }}
            >
              {/* Hero photo */}
              <div style={{ position: "relative", width: "100%", aspectRatio: "1/1.15" }}>
                {garment.signedUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={garment.signedUrl}
                    alt={garment.nombre}
                    style={{
                      display: "block",
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <GarmentImage
                    color={garment.color_principal ?? "neutral"}
                    label={garment.nombre}
                    style={{ width: "100%", aspectRatio: "1/1.15" }}
                  />
                )}

                {/* Top bar flotante — solo mobile */}
                <div
                  className="md:hidden"
                  style={{
                    position: "absolute",
                    top: 56,
                    left: 16,
                    right: 16,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    zIndex: 10,
                  }}
                >
                  <GlassBtn onClick={handleBack} label="Volver">
                    <ArrowLeft size={18} />
                  </GlassBtn>
                  <div style={{ display: "flex", gap: 8 }}>
                    <GlassBtn
                      onClick={handleToggleFavorite}
                      label={isFavorite ? "Quitar de favoritos" : "Agregar a favoritos"}
                      danger={isFavorite}
                    >
                      <Heart
                        size={18}
                        fill={isFavorite ? "var(--color-danger)" : "none"}
                        color={isFavorite ? "var(--color-danger)" : "var(--color-ink)"}
                      />
                    </GlassBtn>
                    <GlassBtn onClick={handleEditClick} label="Editar prenda">
                      <Pencil size={16} />
                    </GlassBtn>
                  </div>
                </div>

                {/* Pagination dots */}
                <div style={{
                  position: "absolute",
                  bottom: 14,
                  left: 0,
                  right: 0,
                  display: "flex",
                  justifyContent: "center",
                  gap: 5,
                  zIndex: 5,
                }}>
                  {[0, 1, 2].map((i) => (
                    <div key={i} style={{
                      width: 5,
                      height: 5,
                      borderRadius: 999,
                      background: i === 0
                        ? (garment.signedUrl ? "#fff" : "var(--color-ink)")
                        : "rgba(255,255,255,0.5)",
                    }} />
                  ))}
                </div>
              </div>

              {/* Desktop: acciones bajo la foto */}
              <div
                className="hidden md:flex items-center gap-3 px-6 pt-4"
              >
                <button
                  type="button"
                  onClick={handleToggleFavorite}
                  className={cn(
                    "flex items-center gap-2 h-9 px-4 rounded-button border text-sm font-medium transition-colors",
                    isFavorite
                      ? "border-transparent bg-red-50 text-danger"
                      : "border-line text-ink-2 hover:text-ink",
                  )}
                  style={{ fontSize: 13 }}
                >
                  <Heart
                    size={15}
                    fill={isFavorite ? "var(--color-danger)" : "none"}
                    color={isFavorite ? "var(--color-danger)" : "currentColor"}
                  />
                  {isFavorite ? "En favoritos" : "Favorito"}
                </button>
                <button
                  type="button"
                  onClick={handleEditClick}
                  className="flex items-center gap-2 h-9 px-4 rounded-button border border-line text-ink-2 hover:text-ink text-sm font-medium transition-colors"
                  style={{ fontSize: 13 }}
                >
                  <Pencil size={15} />
                  Editar
                </button>
              </div>
            </div>

            {/* ─── Contenido: scroll derecho en desktop ─── */}
            <div
              className="md:w-1/2 md:overflow-y-auto"
              style={{ padding: "22px 22px 0" }}
            >
              {/* Eyebrow */}
              <div
                className="eyebrow"
                style={{ marginBottom: 6, fontSize: 10 }}
              >
                {eyebrow || "PRENDA"}
              </div>

              {/* H1 */}
              <h1
                className="h1-display"
                style={{ fontSize: 32, marginBottom: 14, lineHeight: 1.05 }}
              >
                {garment.nombre}
              </h1>

              {/* Descripción IA + botón analizar (LOOKSI-016) */}

              {/* Overlay de scan — activo durante el análisis */}
              {analyzing && (
                <InlineScanOverlay
                  error={null}
                  doneSteps={doneSteps}
                  activeStep={activeStep}
                  onRetry={handleAnalyze}
                />
              )}

              {/* Error del análisis (sin overlay activo) */}
              {!analyzing && analyzeError && (
                <InlineScanOverlay
                  error={analyzeError}
                  doneSteps={doneSteps}
                  activeStep={activeStep}
                  onRetry={handleAnalyze}
                />
              )}

              {/* Caja de descripción IA */}
              {!analyzing && iaDescripcion && (
                <div
                  style={{
                    padding: 14,
                    background: "var(--color-accent-tint)",
                    color: "var(--color-ink-2)",
                    position: "relative",
                    marginBottom: 10,
                    borderRadius: 4,
                  }}
                >
                  {/* AIBadge */}
                  <div style={{ position: "absolute", top: 14, right: 12 }} aria-hidden>
                    <span className="ai-badge">IA</span>
                  </div>
                  <p style={{ fontSize: 13, lineHeight: 1.55, fontStyle: "italic", paddingRight: 48, margin: 0 }}>
                    &ldquo;{iaDescripcion}&rdquo;
                  </p>
                </div>
              )}

              {/* Botón principal "Analizar con IA" — prenda sin análisis */}
              {!analyzing && !iaAnalizada && !analyzeError && garment.imagen_url && (
                <button
                  type="button"
                  onClick={handleAnalyze}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "10px 16px",
                    border: "1px solid var(--color-accent)",
                    borderRadius: 4,
                    background: "var(--color-accent-tint)",
                    color: "var(--color-accent)",
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                    marginBottom: 24,
                  }}
                >
                  <Sparkles size={14} aria-hidden />
                  Analizar con IA
                </button>
              )}

              {/* Botón secundario "Re-analizar" — prenda ya analizada */}
              {!analyzing && iaAnalizada && !analyzeError && garment.imagen_url && (
                <div style={{ marginBottom: 20 }}>
                  <button
                    type="button"
                    onClick={handleAnalyze}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 10px",
                      border: "none",
                      background: "none",
                      color: "var(--color-ink-3)",
                      fontSize: 11,
                      fontWeight: 500,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      cursor: "pointer",
                      textDecoration: "underline",
                      textUnderlineOffset: 3,
                    }}
                  >
                    <RefreshCw size={11} aria-hidden />
                    Re-analizar con IA
                  </button>
                </div>
              )}

              {/* Atributos — Temporada */}
              {garment.estaciones.length > 0 && (
                <div style={{ marginBottom: 22 }}>
                  <div className="eyebrow" style={{ marginBottom: 10, fontSize: 10 }}>Temporada</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {garment.estaciones.map((s) => (
                      <Chip key={s} size="sm" active>
                        {SEASON_LABELS[s] ?? s}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}

              {/* Ocasión */}
              {garment.ocasiones.length > 0 && (
                <div style={{ marginBottom: 22 }}>
                  <div className="eyebrow" style={{ marginBottom: 10, fontSize: 10 }}>Ocasión</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {garment.ocasiones.map((o) => (
                      <Chip key={o} size="sm" active>
                        {OCCASION_LABELS[o] ?? o}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}

              {/* Estilo */}
              {garment.estilos.length > 0 && (
                <div style={{ marginBottom: 22 }}>
                  <div className="eyebrow" style={{ marginBottom: 10, fontSize: 10 }}>Estilo</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {garment.estilos.map((e) => (
                      <Chip key={e} size="sm" active>
                        {STYLE_LABELS[e] ?? e}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}

              {/* Notas (si tiene) */}
              {garment.notas && (
                <div style={{ marginBottom: 22 }}>
                  <div className="eyebrow" style={{ marginBottom: 8, fontSize: 10 }}>Notas</div>
                  <p style={{ fontSize: 13, color: "var(--color-ink-2)", lineHeight: 1.5, margin: 0 }}>
                    {garment.notas}
                  </p>
                </div>
              )}

              {/* Usado en looks — placeholder (EP-04 pendiente) */}
              <div style={{ borderTop: "1px solid var(--color-line)", paddingTop: 20, marginBottom: 16 }}>
                <div style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  marginBottom: 12,
                }}>
                  <h3 style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 16,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    margin: 0,
                    letterSpacing: "0.02em",
                  }}>
                    Usado en looks
                  </h3>
                  <span style={{ fontSize: 11, color: "var(--color-ink-3)" }}>Ver todos →</span>
                </div>
                {/* Thumbs placeholder scroll */}
                <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                  {/* Placeholder vacío con mensaje sutil */}
                  <p style={{ fontSize: 12, color: "var(--color-ink-3)", margin: 0, alignSelf: "center" }}>
                    Todavía no se usó en ningún look.
                  </p>
                </div>
              </div>

              {/* Meta: Agregada / Último uso */}
              <div style={{ display: "flex", gap: 24, marginBottom: 28 }}>
                <div>
                  <div className="eyebrow" style={{ marginBottom: 4, fontSize: 10 }}>Agregada</div>
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 13,
                      color: "var(--color-ink-2)",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {formatDateShort(garment.created_at)}
                  </div>
                </div>
                <div>
                  <div className="eyebrow" style={{ marginBottom: 4, fontSize: 10 }}>Último uso</div>
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 13,
                      color: "var(--color-ink-3)",
                      letterSpacing: "0.04em",
                    }}
                  >
                    —
                  </div>
                </div>
              </div>

              {/* Danger CTA — Eliminar */}
              <button
                type="button"
                onClick={() => setShowDeleteDialog(true)}
                style={{
                  width: "100%",
                  padding: "14px 0",
                  background: "transparent",
                  border: "1px solid var(--color-line)",
                  color: "var(--color-danger)",
                  fontFamily: "var(--font-body)",
                  fontSize: 12,
                  fontWeight: 500,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  cursor: "pointer",
                  borderRadius: 4,
                  marginBottom: 60,
                }}
              >
                <Trash2 size={14} />
                Eliminar prenda
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom nav — solo mobile */}
      <div className="md:hidden">
        <BottomNav />
      </div>

      {/* Dialog confirmar eliminación */}
      {showDeleteDialog && (
        <ConfirmDeleteDialog
          onConfirm={handleDeleteConfirm}
          onCancel={() => setShowDeleteDialog(false)}
          loading={deleteLoading}
        />
      )}
    </>
  );
}
