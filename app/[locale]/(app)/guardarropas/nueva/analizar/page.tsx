"use client";

/**
 * LOOKSI-009 — Paso 2: Analizando con IA.
 * Spec 09 · /guardarropas/nueva/analizar
 *
 * Lee la imagen de sessionStorage, lanza en paralelo:
 *  - POST /api/prendas/analizar  → metadatos Gemini
 *  - removeBackground()          → PNG sin fondo (guardado en SS_NOBG_KEY)
 *
 * Keyframes: scan-line, dot-pulse, spin (definidos en globals.css).
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X } from "lucide-react";
import type { GarmentAnalysis } from "@/app/api/prendas/analizar/route";

// ── SessionStorage keys ────────────────────────────────────────────────────────

const SS_IMAGE_KEY = "looksi_nueva_imagen";
const SS_TYPE_KEY  = "looksi_nueva_tipo";
const SS_IA_KEY    = "looksi_nueva_ia";
const SS_NOBG_KEY  = "looksi_nueva_imagen_nobg"; // PNG sin fondo (si bg-removal ok)

// ── Steps de progreso ──────────────────────────────────────────────────────────

const STEPS = [
  "Detectando contornos",
  "Identificando colores",
  "Clasificando estilo",
  "Generando sugerencias",
] as const;

const STEP_MS = [900, 800, 700, 500];

// ── Componente ─────────────────────────────────────────────────────────────────

export default function AnalyzeStep() {
  const router = useRouter();

  const [imageURL, setImageURL] = useState<string | null>(null);
  const [doneSteps, setDoneSteps] = useState<boolean[]>([false, false, false, false]);
  const [activeStep, setActiveStep] = useState(0);
  const [error, setError]           = useState<string | null>(null);
  const [showContinue, setShowContinue] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const dataURL = sessionStorage.getItem(SS_IMAGE_KEY);
    if (!dataURL) {
      router.replace("/guardarropas/nueva");
      return;
    }
    const existing = sessionStorage.getItem(SS_IA_KEY);
    if (existing) {
      router.replace("/guardarropas/nueva/formulario");
      return;
    }

    setImageURL(dataURL);
    runAnalysis(dataURL);

    timerRef.current = setTimeout(() => setShowContinue(true), 20_000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runAnalysis(dataURL: string) {
    const mimeType = sessionStorage.getItem(SS_TYPE_KEY) ?? "image/jpeg";
    const blob     = dataURLtoBlob(dataURL, mimeType);
    const file     = new File([blob], "prenda.jpg", { type: mimeType });

    const fd = new FormData();
    fd.append("imagen", file);

    // ── Lanzar Gemini + background-removal en PARALELO ─────────────────────
    const geminiPromise = fetch("/api/prendas/analizar", { method: "POST", body: fd });
    const nobgPromise   = runBackgroundRemoval(blob);

    // Animación de pasos mientras esperamos
    for (let i = 0; i < STEPS.length - 1; i++) {
      await delay(STEP_MS[i]);
      setDoneSteps((prev) => prev.map((v, idx) => idx <= i ? true : v));
      setActiveStep(i + 1);
    }

    // Esperar Gemini
    try {
      const apiRes = await geminiPromise;
      if (!apiRes.ok) throw new Error(`API error ${apiRes.status}`);

      const analysis: GarmentAnalysis = await apiRes.json();

      setDoneSteps([true, true, true, true]);
      setActiveStep(4);

      sessionStorage.setItem(SS_IA_KEY, JSON.stringify(analysis));

      // Esperar resultado de background removal (ya debería estar listo)
      const nobgDataURL = await nobgPromise;
      if (nobgDataURL) sessionStorage.setItem(SS_NOBG_KEY, nobgDataURL);

      await delay(500);
      router.push("/guardarropas/nueva/formulario");

    } catch (err) {
      console.error("[analizar] Error:", err);
      sessionStorage.setItem(SS_IA_KEY, "null");
      setError("No se pudo analizar la imagen.");
      setShowContinue(true);
      if (timerRef.current) clearTimeout(timerRef.current);
    }
  }

  function continueWithoutAI() {
    sessionStorage.setItem(SS_IA_KEY, "null");
    router.push("/guardarropas/nueva/formulario");
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-dvh bg-bg flex flex-col">

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-4 pb-4">
        <Link
          href="/guardarropas/nueva"
          aria-label="Volver"
          className="grid place-items-center size-9 rounded-full text-ink-3 hover:bg-surface-2 transition-colors"
        >
          <X className="size-5" aria-hidden />
        </Link>
        <span className="eyebrow">PASO 2 / 2 · ANALIZANDO</span>
        <div className="w-9" aria-hidden />
      </div>

      {/* Foto con overlay de scan */}
      <div className="px-5">
        <div style={{ position: "relative", aspectRatio: "1 / 1.1", overflow: "hidden", background: "var(--color-stone-100, #f1ede4)" }}>
          {imageURL && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageURL}
              alt="Prenda a analizar"
              style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
            />
          )}
          {!error && (
            <div
              aria-hidden
              style={{
                position: "absolute", left: 0, right: 0, height: 2,
                background: "var(--color-accent, #6b7563)",
                boxShadow: "0 0 18px var(--color-accent, #6b7563)",
                opacity: 0.8,
                animation: "scan-line 2.5s linear infinite",
              }}
            />
          )}
          {!error && (
            <svg aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
              {[[35,22],[58,30],[48,65],[32,80]].map(([cx, cy], i) => (
                <circle key={i} cx={`${cx}%`} cy={`${cy}%`} r="3"
                  fill="var(--color-accent, #6b7563)"
                  style={{ animation: `dot-pulse 1.4s ${i * 0.3}s infinite` }}
                />
              ))}
            </svg>
          )}
          {!error && (
            <div aria-hidden style={{
              position: "absolute", top: 12, right: 12,
              padding: "6px 10px",
              background: "rgba(0,0,0,0.7)", color: "#fff",
              fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
              display: "inline-flex", alignItems: "center", gap: 6,
              backdropFilter: "blur(8px)",
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: 6,
                background: "var(--color-accent, #6b7563)",
                animation: "dot-pulse 1.4s infinite",
              }} />
              ✦ Analizando con IA
            </div>
          )}
        </div>
      </div>

      {/* Info + pasos */}
      <div className="px-6 pt-7 flex-1">
        <h2 className="font-display font-semibold uppercase text-ink"
          style={{ fontSize: 28, lineHeight: 1.05, letterSpacing: "-0.01em", marginBottom: 6 }}>
          Identificando<br />tu prenda…
        </h2>
        <p className="text-sm text-ink-2 mb-6" style={{ fontSize: 12 }}>
          Categoría, color, temporada, ocasión y estilo.
        </p>

        <div className="flex flex-col gap-3.5">
          {STEPS.map((label, i) => {
            const done   = doneSteps[i];
            const active = !done && i === activeStep;
            return (
              <div key={label} className="flex items-center gap-3">
                <div style={{
                  position: "relative", width: 18, height: 18, borderRadius: 999,
                  flexShrink: 0,
                  background: done ? "var(--color-accent, #6b7563)" : "transparent",
                  border: done ? "none" : `1.5px solid ${active ? "transparent" : "var(--color-line, rgba(26,26,26,0.10))"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {done && (
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden>
                      <path d="M2 5.5L4.5 8L9 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                  {active && (
                    <span aria-hidden style={{
                      position: "absolute", inset: -2, borderRadius: 999,
                      border: "2px solid var(--color-accent, #6b7563)",
                      borderTopColor: "transparent",
                      animation: "spin 1s linear infinite",
                    }} />
                  )}
                </div>
                <span className={cn("text-sm", done || active ? "text-ink" : "text-ink-3")}
                  style={{ fontWeight: active ? 500 : 400 }}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>

        {error && <p className="mt-4 text-sm text-danger">{error}</p>}
        {showContinue && (
          <button type="button" onClick={continueWithoutAI}
            className="mt-6 text-sm text-ink-2 underline underline-offset-2 hover:text-ink transition-colors">
            Continuar sin IA →
          </button>
        )}
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(" ");
}

function dataURLtoBlob(dataURL: string, fallbackMime = "image/jpeg"): Blob {
  const [header, b64] = dataURL.split(",");
  const mime   = header.match(/:(.*?);/)?.[1] ?? fallbackMime;
  const binary = atob(b64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * Quita el fondo de la imagen usando @imgly/background-removal (ONNX en WASM).
 * Se importa dinámicamente para no bloquear el bundle principal.
 * Devuelve el data URL del PNG sin fondo, o null si falla.
 *
 * El resultado se redimensiona a ≤1200px para mantener el tamaño manejable.
 */
async function runBackgroundRemoval(blob: Blob): Promise<string | null> {
  try {
    const { removeBackground } = await import("@imgly/background-removal");

    const outputBlob = await removeBackground(blob, {
      output: { format: "image/png", quality: 0.85 },
    });

    // Redimensionar a ≤1200px en canvas para limitar el tamaño del PNG
    const resized = await resizePNG(outputBlob, 1200);
    return await blobToDataURL(resized);

  } catch (err) {
    // Background removal es opcional — si falla, el formulario usa la imagen original
    console.warn("[analizar] background-removal falló (no crítico):", err);
    return null;
  }
}

/** Redimensiona un PNG transparente a maxPx usando canvas. */
async function resizePNG(blob: Blob, maxPx: number): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale  = Math.min(1, maxPx / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => resolve(b ?? blob), "image/png");
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(blob); };
    img.src = url;
  });
}

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
