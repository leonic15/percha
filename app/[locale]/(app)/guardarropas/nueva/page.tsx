"use client";

/**
 * LOOKSI-009 — Paso 1: Captura de imagen.
 * LOOKSI-036 — Validación de imagen con IA antes de continuar.
 * Spec 08 · /guardarropas/nueva
 *
 * El usuario elige una foto (cámara o galería).
 * La imagen se comprime client-side, luego se valida con IA (/api/validar-imagen).
 * Si es válida navega al Paso 2 (/guardarropas/nueva/analizar).
 * Si es rechazada muestra un bottom sheet de error con opciones para reintentar.
 */

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Camera, X, AlertCircle, AlertTriangle } from "lucide-react";
import { LookLoopSpinner } from "@/components/ui";
import imageCompression from "browser-image-compression";
import { useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { ValidarImagenResponse } from "@/app/api/validar-imagen/route";

// ── Constantes ────────────────────────────────────────────────────────────────

const SS_IMAGE_KEY = "looksi_nueva_imagen";
const SS_TYPE_KEY  = "looksi_nueva_tipo";
const SS_IA_KEY    = "looksi_nueva_ia";

const COMPRESSION_OPTIONS = {
  maxSizeMB:        0.8,
  maxWidthOrHeight: 1200,
  useWebWorker:     true,
} as const;

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// ── Corner bracket helper ────────────────────────────────────────────────────

function CornerBracket({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const t = pos.includes("t");
  const l = pos.includes("l");
  return (
    <span
      aria-hidden
      style={{
        position:     "absolute",
        width:        20,
        height:       20,
        ...(t ? { top: 14 }    : { bottom: 14 }),
        ...(l ? { left: 14 }   : { right: 14 }),
        borderTop:    t  ? "1.5px solid var(--color-ink-2, #4a4a48)" : undefined,
        borderBottom: !t ? "1.5px solid var(--color-ink-2, #4a4a48)" : undefined,
        borderLeft:   l  ? "1.5px solid var(--color-ink-2, #4a4a48)" : undefined,
        borderRight:  !l ? "1.5px solid var(--color-ink-2, #4a4a48)" : undefined,
      }}
    />
  );
}

// ── ValidationSheet ───────────────────────────────────────────────────────────
// Pantalla bloqueante de error de validación (escenarios 2, 6, 7 de LOOKSI-036).
// Aparece como bottom sheet; fuerza al usuario a reintentar o cambiar imagen.

type SheetMode = "error" | "warning";

interface ValidationSheetProps {
  mode:          SheetMode;
  motivo:        ValidarImagenResponse["motivo"];
  mensaje:       string;
  onRetakePhoto: () => void;
  onPickGallery: () => void;
  onContinue?:   () => void; // solo para warnings
  onClose:       () => void;
}

function ValidationSheet({
  mode,
  motivo,
  mensaje,
  onRetakePhoto,
  onPickGallery,
  onContinue,
  onClose,
}: ValidationSheetProps) {
  const isPartialBody = motivo === "cuerpo_parcial";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/[0.45]"
        aria-hidden
        onClick={mode === "warning" ? onClose : undefined}
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Validación de imagen"
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 bg-bg rounded-t-[20px]",
          "shadow-[0_-8px_30px_rgba(0,0,0,0.2)]",
          "[animation:sheet-up_280ms_cubic-bezier(0.32,0.72,0,1)_both]",
        )}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 rounded-full bg-line" />
        </div>

        <div className="px-[22px] pb-[max(env(safe-area-inset-bottom),28px)]">
          {/* Icon + título */}
          <div className="flex items-start gap-3 pt-3 pb-4">
            <div className={cn(
              "shrink-0 size-10 rounded-full flex items-center justify-center",
              mode === "error"   ? "bg-[color:var(--color-terra-100)] text-danger"
                                 : "bg-[color:var(--color-warning-50)] text-[color:var(--color-warning-700)]",
            )}>
              {mode === "error"
                ? <AlertCircle className="size-5" />
                : <AlertTriangle className="size-5" />
              }
            </div>
            <div className="flex-1 pt-0.5">
              <p className="text-base font-medium text-ink leading-snug">
                {mode === "error" ? "Imagen no válida" : "Imagen con advertencia"}
              </p>
              <p className="text-sm text-ink-2 mt-1 leading-relaxed">
                {mensaje}
              </p>
            </div>
          </div>

          {/* Checklist corporal (escenario 7) */}
          {isPartialBody && (
            <div className="mb-4 p-3 bg-surface border border-line-2 space-y-1.5">
              {[
                "Cuerpo completo (de cabeza a pies)",
                "Fondo claro o neutro",
                "Pose de frente",
                "Sin objetos que obstruyan la silueta",
              ].map((req) => (
                <div key={req} className="flex items-center gap-2 text-sm text-ink-2">
                  <span className="text-danger text-xs">✗</span>
                  {req}
                </div>
              ))}
            </div>
          )}

          {/* CTAs */}
          <div className="flex flex-col gap-2.5 mt-2">
            {mode === "warning" && onContinue && (
              <button
                type="button"
                onClick={onContinue}
                className={cn(
                  "w-full h-13 rounded-button flex items-center justify-center gap-2",
                  "text-sm font-medium uppercase tracking-wide",
                  "bg-ink text-bg hover:bg-stone-800 active:scale-[0.985] transition-all",
                )}
              >
                Continuar de todas formas
              </button>
            )}

            <button
              type="button"
              onClick={onRetakePhoto}
              className={cn(
                "w-full h-13 rounded-button flex items-center justify-center gap-2",
                "text-sm font-medium uppercase tracking-wide",
                mode === "error"
                  ? "bg-ink text-bg hover:bg-stone-800"
                  : "bg-transparent text-ink border border-line hover:bg-surface-2",
                "active:scale-[0.985] transition-all",
              )}
            >
              <Camera className="size-4" aria-hidden />
              {mode === "warning" ? "Cambiar imagen" : "Volver a tomar foto"}
            </button>

            <button
              type="button"
              onClick={onPickGallery}
              className={cn(
                "w-full h-13 rounded-button flex items-center justify-center gap-2",
                "text-sm font-medium uppercase tracking-wide",
                "bg-transparent text-ink border border-line",
                "hover:bg-surface-2 active:scale-[0.985] transition-all",
              )}
            >
              Elegir de galería
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Estados de carga ──────────────────────────────────────────────────────────

type LoadingState =
  | { phase: "idle" }
  | { phase: "compressing" }
  | { phase: "validating" }

// ── Componente ────────────────────────────────────────────────────────────────

export default function NuevaPrendaPage() {
  const router    = useRouter();
  const { toast } = useToast();

  const fileInputRef   = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [loadingState, setLoadingState] = useState<LoadingState>({ phase: "idle" });
  const [dragOver, setDragOver]         = useState(false);

  // Estado del sheet de validación
  const [validation, setValidation] = useState<{
    mode:    SheetMode;
    motivo:  ValidarImagenResponse["motivo"];
    mensaje: string;
    // base64 guardado para poder continuar en caso de warning
    savedBase64: string;
    savedMime:   string;
  } | null>(null);

  const isLoading = loadingState.phase !== "idle";

  // ── Mensaje de carga por fase ───────────────────────────────────────────────

  const loadingLabel =
    loadingState.phase === "compressing" ? "Procesando imagen…" :
    loadingState.phase === "validating"  ? "Verificando imagen…" :
    "";

  // ── Navegar al paso 2 ───────────────────────────────────────────────────────

  function navigateToAnalyze(base64: string, mime: string) {
    sessionStorage.setItem(SS_IMAGE_KEY, base64);
    sessionStorage.setItem(SS_TYPE_KEY,  mime);
    sessionStorage.removeItem(SS_IA_KEY);
    router.push("/guardarropas/nueva/analizar");
  }

  // ── Procesar imagen ─────────────────────────────────────────────────────────

  async function processImageFile(file: File) {
    if (file.size > MAX_SIZE_BYTES) {
      toast.error("La imagen no puede superar 10 MB.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Seleccioná una imagen (JPG, PNG, WebP).");
      return;
    }

    setLoadingState({ phase: "compressing" });
    let dataURL: string;
    let mimeType: string;

    try {
      const compressed = await imageCompression(file, COMPRESSION_OPTIONS);
      mimeType         = compressed.type || file.type;
      dataURL          = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(compressed);
      });
    } catch (err) {
      console.error("[NuevaPrenda] Error comprimiendo:", err);
      toast.error("Error al procesar la imagen. Intentá con otra foto.");
      setLoadingState({ phase: "idle" });
      return;
    }

    // ── LOOKSI-036: Validar con IA ──────────────────────────────────────────
    setLoadingState({ phase: "validating" });
    try {
      const res = await fetch("/api/validar-imagen", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ tipo: "prenda", imagen: dataURL }),
      });

      if (!res.ok) {
        // Fallo de red → fail-open, continuar sin bloquear
        console.warn("[NuevaPrenda] validar-imagen no-ok, fail-open");
        navigateToAnalyze(dataURL, mimeType);
        return;
      }

      const result: ValidarImagenResponse = await res.json();

      if (result.valida && !result.advertencia) {
        // Válida → continuar normalmente
        navigateToAnalyze(dataURL, mimeType);
        return;
      }

      if (result.valida && result.advertencia) {
        // Advertencia no bloqueante → mostrar sheet con opción de continuar
        setValidation({
          mode:        "warning",
          motivo:      result.motivo,
          mensaje:     result.mensaje,
          savedBase64: dataURL,
          savedMime:   mimeType,
        });
        return;
      }

      // No válida → mostrar sheet de error bloqueante
      // Limpiar sessionStorage para que no quede la imagen rechazada
      sessionStorage.removeItem(SS_IMAGE_KEY);
      sessionStorage.removeItem(SS_TYPE_KEY);
      sessionStorage.removeItem(SS_IA_KEY);

      setValidation({
        mode:        "error",
        motivo:      result.motivo,
        mensaje:     result.mensaje,
        savedBase64: "",
        savedMime:   "",
      });

    } catch (err) {
      // Error de red → fail-open
      console.warn("[NuevaPrenda] validar-imagen exception, fail-open:", err);
      navigateToAnalyze(dataURL, mimeType);
    } finally {
      setLoadingState({ phase: "idle" });
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processImageFile(file);
    e.target.value = ""; // permite re-selección del mismo archivo
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processImageFile(file);
  }

  // ── Handlers del sheet ──────────────────────────────────────────────────────

  function handleRetakePhoto() {
    setValidation(null);
    cameraInputRef.current?.click();
  }

  function handlePickGallery() {
    setValidation(null);
    fileInputRef.current?.click();
  }

  function handleContinueAnyway() {
    if (!validation?.savedBase64) return;
    const { savedBase64, savedMime } = validation;
    setValidation(null);
    navigateToAnalyze(savedBase64, savedMime);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="min-h-dvh bg-bg flex flex-col">

        {/* ── Top bar ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 pt-4 pb-4">
          <Link
            href="/guardarropas"
            aria-label="Cerrar"
            className="grid place-items-center size-9 rounded-full text-ink-2 hover:bg-surface-2 transition-colors"
          >
            <X className="size-5" aria-hidden />
          </Link>
          <span className="eyebrow">PASO 1 / 2</span>
          <div className="w-9" aria-hidden />
        </div>

        {/* ── Heading ───────────────────────────────────────────────────────── */}
        <div className="px-6 pb-6">
          <h1
            className="font-display font-semibold uppercase text-ink"
            style={{ fontSize: 36, lineHeight: 1, letterSpacing: "-0.01em", marginBottom: 8 }}
          >
            Agregar<br />prenda.
          </h1>
          <p className="text-sm text-ink-2" style={{ fontSize: 13 }}>
            Elegí una foto. La IA va a identificar la prenda por vos.
          </p>
        </div>

        {/* ── Drop zone ─────────────────────────────────────────────────────── */}
        <div className="px-5 flex-1">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            style={{ aspectRatio: "1 / 1.1" }}
            className={cn(
              "relative flex flex-col items-center justify-center gap-2",
              "border-dashed bg-surface-2",
              "transition-colors",
              dragOver
                ? "border-[1.5px] border-accent"
                : "border-[1.5px] border-line",
            )}
          >
            {/* Corner brackets */}
            <CornerBracket pos="tl" />
            <CornerBracket pos="tr" />
            <CornerBracket pos="bl" />
            <CornerBracket pos="br" />

            {isLoading ? (
              <div className="flex flex-col items-center gap-3">
                <LookLoopSpinner size={56} />
                <p
                  className="uppercase text-ink-3 text-center"
                  style={{ fontSize: 11, letterSpacing: "0.12em" }}
                >
                  {loadingLabel}
                </p>
              </div>
            ) : (
              <>
                <Camera className="size-9 text-ink-3" aria-hidden />
                <p
                  className="uppercase text-ink-3 text-center leading-snug"
                  style={{ fontSize: 12, letterSpacing: "0.12em" }}
                >
                  Tirá una foto<br />prenda sobre fondo claro
                </p>
              </>
            )}
          </div>
        </div>

        {/* ── CTAs ──────────────────────────────────────────────────────────── */}
        <div className="px-5 pt-5 flex flex-col gap-2.5">
          <button
            type="button"
            disabled={isLoading}
            onClick={() => cameraInputRef.current?.click()}
            className={cn(
              "w-full h-13 rounded-button flex items-center justify-center gap-2",
              "text-sm font-medium uppercase tracking-wide",
              "bg-ink text-bg",
              "hover:bg-stone-800 active:scale-[0.985] transition-all disabled:opacity-50",
            )}
          >
            <Camera className="size-4" aria-hidden />
            Usar cámara
          </button>

          <button
            type="button"
            disabled={isLoading}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "w-full h-13 rounded-button flex items-center justify-center gap-2",
              "text-sm font-medium uppercase tracking-wide",
              "bg-transparent text-ink border border-line",
              "hover:bg-surface-2 active:scale-[0.985] transition-all disabled:opacity-50",
            )}
          >
            Elegir de galería
          </button>
        </div>

        {/* ── Tip ───────────────────────────────────────────────────────────── */}
        <p
          className="text-center text-ink-3 mt-5 mb-6"
          style={{ fontSize: 11, lineHeight: 1.6 }}
        >
          Tip · usá fondo blanco o neutro para mejores resultados.
        </p>

        {/* ── Inputs ocultos ────────────────────────────────────────────────── */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={handleFileChange}
          aria-hidden
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={handleFileChange}
          aria-hidden
        />
      </div>

      {/* ── Validation sheet (LOOKSI-036) ─────────────────────────────────── */}
      {validation && (
        <ValidationSheet
          mode={validation.mode}
          motivo={validation.motivo}
          mensaje={validation.mensaje}
          onRetakePhoto={handleRetakePhoto}
          onPickGallery={handlePickGallery}
          onContinue={validation.mode === "warning" ? handleContinueAnyway : undefined}
          onClose={() => setValidation(null)}
        />
      )}
    </>
  );
}
