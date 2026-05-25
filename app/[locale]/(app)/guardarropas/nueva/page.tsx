"use client";

/**
 * LOOKSI-009 — Paso 1: Captura de imagen.
 * Spec 08 · /guardarropas/nueva
 *
 * El usuario elige una foto (cámara o galería).
 * La imagen se comprime client-side y se guarda en sessionStorage como base64.
 * Luego navega automáticamente a /guardarropas/nueva/analizar.
 */

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Camera, X, Loader2 } from "lucide-react";
import imageCompression from "browser-image-compression";
import { useToast } from "@/components/ui";
import { cn } from "@/lib/cn";

// ── Constantes ────────────────────────────────────────────────────────────────

const SS_IMAGE_KEY = "looksi_nueva_imagen";
const SS_TYPE_KEY  = "looksi_nueva_tipo";
const SS_IA_KEY    = "looksi_nueva_ia";

const COMPRESSION_OPTIONS = {
  maxSizeMB:       0.8,
  maxWidthOrHeight: 1200,
  useWebWorker:    true,
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
        position:    "absolute",
        width:       20,
        height:      20,
        ...(t ? { top: 14 }    : { bottom: 14 }),
        ...(l ? { left: 14 }   : { right: 14 }),
        borderTop:    t ? "1.5px solid var(--color-ink-2, #4a4a48)" : undefined,
        borderBottom: !t ? "1.5px solid var(--color-ink-2, #4a4a48)" : undefined,
        borderLeft:   l ? "1.5px solid var(--color-ink-2, #4a4a48)" : undefined,
        borderRight:  !l ? "1.5px solid var(--color-ink-2, #4a4a48)" : undefined,
      }}
    />
  );
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function NuevaPrendaPage() {
  const router = useRouter();
  const { toast } = useToast();

  const fileInputRef   = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // ── Procesar imagen ─────────────────────────────────────────────────────
  async function processImageFile(file: File) {
    if (file.size > MAX_SIZE_BYTES) {
      toast.error("La imagen no puede superar 10 MB.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Seleccioná una imagen (JPG, PNG, WebP).");
      return;
    }

    setLoading(true);
    try {
      // Comprimir client-side
      const compressed = await imageCompression(file, COMPRESSION_OPTIONS);

      // Convertir a base64 data URL
      const dataURL = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(compressed);
      });

      // Guardar en sessionStorage (limpiar AI previa si la hay)
      sessionStorage.setItem(SS_IMAGE_KEY, dataURL);
      sessionStorage.setItem(SS_TYPE_KEY,  compressed.type || file.type);
      sessionStorage.removeItem(SS_IA_KEY);

      // Navegar al siguiente paso
      router.push("/guardarropas/nueva/analizar");
    } catch (err) {
      console.error("[NuevaPrenda] Error procesando imagen:", err);
      toast.error("Error al procesar la imagen. Intentá con otra foto.");
    } finally {
      setLoading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processImageFile(file);
    e.target.value = ""; // limpiar para permitir re-selección del mismo archivo
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processImageFile(file);
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-dvh bg-bg flex flex-col"
      style={{ paddingTop: 0 }}
    >
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

          {loading ? (
            <Loader2 className="size-9 text-ink-3 animate-spin" />
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
          disabled={loading}
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
          disabled={loading}
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
  );
}
