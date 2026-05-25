"use client";

/**
 * GeneratorResultClient — Handoff 13 · GENERADOR · RESULTADO
 * Ruta: /generador/resultado
 *
 * - Lee el resultado de sessionStorage (looksi_generar_result)
 * - Si no hay resultado, redirige a /generador
 * - Muestra: AIBadge + meta + H1 nombre + descripción italizada
 * - Versiones cacheadas client-side (stepper)
 * - Grid 2-col (md: 4-col) de prendas con botón swap decorativo
 * - "Otro" → regenera con mismos parámetros → nueva versión
 * - "Guardar look" → TODO LOOKSI-020
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import Link from "next/link";
import { Button, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { SS_RESULT_KEY, SS_PARAMS_KEY } from "./GeneratorConfigClient";
import type { GenerarLookResult, PrendaResult } from "@/app/api/looks/generar/route";

// ── AI Badge (inline, sin dep extra) ─────────────────────────────────────────

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

// ── Swap button ───────────────────────────────────────────────────────────────

function SwapIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M1 4.5h12M10 2l3 2.5L10 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M13 9.5H1M4 7l-3 2.5L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ── Garment tile ──────────────────────────────────────────────────────────────

function GarmentTile({ prenda }: { prenda: PrendaResult }) {
  return (
    <div className="relative bg-surface">
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
          /* Placeholder stripes */
          <ColoredPlaceholder color={prenda.color} />
        )}

        {/* Swap button — decorativo, LOOKSI-019 */}
        <button
          type="button"
          aria-label={`Cambiar ${prenda.nombre}`}
          title="Cambiar prenda (próximamente)"
          disabled
          className={cn(
            "absolute top-2 right-2 size-[30px] rounded-full",
            "bg-white/92 backdrop-blur-[6px] border-0",
            "flex items-center justify-center",
            "opacity-80 cursor-default",
          )}
        >
          <SwapIcon />
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
  // Mapa de colores → hex (mismo que GarmentImage)
  const COLORS: Record<string, [string, string]> = {
    neutro:     ["#e8e3d8", "#d8d0c0"],
    blanco:     ["#f3efe5", "#e5dfd0"],
    negro:      ["#262522", "#15140f"],
    camel:      ["#c2a079", "#a78458"],
    olive:      ["#c9c8b0", "#a8a78a"],
    azul:       ["#8a9aa8", "#647383"],
    rojo:       ["#cc7752", "#a04a2d"],
    verde:      ["#7b8472", "#5e6755"],
    arena:      ["#d6c5a8", "#b8a37e"],
    rosa:       ["#e6cfc9", "#caa8a0"],
    chocolate:  ["#5e4a39", "#3f3024"],
    crudo:      ["#ece3d2", "#d4c8af"],
  };
  const key = color.toLowerCase().split(" ")[0];
  const [a, b] = COLORS[key] ?? COLORS.neutro;
  const id     = `ph_${key}_${Math.random().toString(36).slice(2, 6)}`;

  return (
    <svg width="100%" height="100%" style={{ display: "block" }}>
      <defs>
        <pattern id={id} width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="14" height="14" fill={a} />
          <rect width="7" height="14" fill={b} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} opacity="0.5" />
    </svg>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function GeneratorResultClient() {
  const router      = useRouter();
  const { toast }   = useToast();

  // Versiones cacheadas client-side
  const [versions, setVersions] = useState<GenerarLookResult[]>([]);
  const [vIdx, setVIdx]         = useState(0);
  const [regenerating, setRegenerating] = useState(false);
  const paramsRef = useRef<Record<string, unknown> | null>(null);

  // Leer de sessionStorage al montar
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

  // ── Regenerar ("Otro") ──────────────────────────────────────────────────────
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
      setVersions((prev) => [...prev, result]);
      setVIdx((prev) => prev + 1);
      sessionStorage.setItem(SS_RESULT_KEY, JSON.stringify(result));
    } catch {
      toast.error("No se pudo generar otro look. Intentá de nuevo.");
    } finally {
      setRegenerating(false);
    }
  };

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
    current.parametros.clima ? `${current.parametros.clima.temperatura}°` : null,
    `${piezas} ${piezas === 1 ? "pieza" : "piezas"}`,
  ].filter(Boolean).join(" · ");

  return (
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
            disabled={regenerating}
            aria-label="Regenerar look"
            className="size-9 grid place-items-center text-ink-2 hover:text-ink transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn("size-[18px]", regenerating && "animate-spin")} />
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
            >
              <GarmentTile prenda={prenda} />
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
            <RotateCcw className="size-4 text-accent shrink-0" strokeWidth={1.6} />
            <span className="text-[12px] text-ink-2 flex-1">
              Usá <strong>Otro</strong> para generar una variante del look.
              Pronto podrás cambiar prendas individualmente.
            </span>
          </div>
        </div>
      </div>

      {/* ── Sticky actions ──────────────────────────────────────────────────── */}
      <div
        className={cn(
          "fixed inset-x-0 z-20",
          "bottom-[calc(60px+max(env(safe-area-inset-bottom),16px))]",
          "px-5 py-2.5 bg-bg border-t border-line-2",
          "flex gap-2",
          "md:static md:border-t md:px-5 md:pb-8 md:pt-3",
        )}
      >
        <Button
          type="button"
          variant="ghost"
          size="md"
          className="flex-1"
          loading={regenerating}
          icon={!regenerating ? <RefreshCw className="size-4" /> : undefined}
          onClick={handleOtro}
        >
          Otro
        </Button>
        <Button
          type="button"
          variant="primary"
          size="md"
          className="flex-[1.4]"
          disabled
          title="Próximamente — LOOKSI-020"
        >
          Guardar look
        </Button>
      </div>
    </div>
  );
}
