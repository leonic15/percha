"use client";

/**
 * LooksHistoryClient — Handoff 15 · HISTORIAL DE LOOKS
 * Ruta: /looks
 *
 * LOOKSI-021 — Ver historial de looks guardados:
 * - Header: wordmark + search (futuro) / H1 36px "Looks" + contador mono
 * - Filter row: 3 chips — Recientes / Más usados / Por ocasión
 * - Lista LookCard variant="row" con divider 1px line-2 (no en el primero)
 * - Desktop: grid LookCard variant="tile" md:grid-cols-3 lg:grid-cols-4
 * - Estado vacío: mensaje + ilustración 4 prendas + CTA al generador
 * - Estado carga: LookListSkeleton count=5
 * - Estado error: banner inline + "Reintentar"
 * - Pull-to-refresh mobile
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, RefreshCw, AlertCircle, Sparkles } from "lucide-react";
import { Chip, LookCard, LookListSkeleton } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { LookItemData } from "@/app/api/looks/route";
import type { Look } from "@/components/ui/LookCard";

// ── Constantes ────────────────────────────────────────────────────────────────

const MONTHS_ES = [
  "ENE", "FEB", "MAR", "ABR", "MAY", "JUN",
  "JUL", "AGO", "SEP", "OCT", "NOV", "DIC",
];

type SortMode = "recientes" | "mas_usados" | "por_ocasion";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** "YYYY-MM-DD" → "20·MAY·26" */
function formatLastUsed(iso: string): string {
  const [y, m, d] = iso.split("-");
  const month = MONTHS_ES[parseInt(m) - 1] ?? m;
  return `${parseInt(d)}·${month}·${y.slice(2)}`;
}

/** Convierte LookItemData → Look (shape que necesita LookCard) */
function toLookCard(item: LookItemData): Look {
  return {
    id:            item.id,
    nombre:        item.nombre,
    lastUsed:      item.lastUsedISO ? formatLastUsed(item.lastUsedISO) : "Nunca usado",
    usageCount:    item.usageCount,
    garmentImages: item.garmentImages,
  };
}

/** Ordena una lista de LookItemData según el modo elegido */
function sortLooks(items: LookItemData[], mode: SortMode): LookItemData[] {
  const copy = [...items];
  switch (mode) {
    case "recientes":
      return copy.sort((a, b) => {
        // Primero por último uso DESC; si no tiene uso, por created_at DESC
        const aDate = a.lastUsedISO ?? a.created_at.slice(0, 10);
        const bDate = b.lastUsedISO ?? b.created_at.slice(0, 10);
        return bDate.localeCompare(aDate);
      });
    case "mas_usados":
      return copy.sort((a, b) => {
        if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
        // Desempate: más reciente primero
        return b.created_at.localeCompare(a.created_at);
      });
    case "por_ocasion":
      return copy.sort((a, b) => {
        const oA = a.ocasion.toLowerCase();
        const oB = b.ocasion.toLowerCase();
        if (oA !== oB) return oA.localeCompare(oB, "es");
        return b.created_at.localeCompare(a.created_at);
      });
  }
}

// ── Wordmark ──────────────────────────────────────────────────────────────────

function Wordmark() {
  return (
    <span
      className="font-display font-bold uppercase text-ink leading-none"
      style={{ fontSize: 16, letterSpacing: "0.08em" }}
    >
      LookSi
    </span>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center px-8 py-16 text-center gap-6">
      {/* Ilustración: 4 prendas en collage estático */}
      <div
        className="grid grid-cols-2 gap-px bg-surface-2 w-24 h-24"
        aria-hidden
      >
        {["camel", "azul", "olive", "negro"].map((color) => (
          <div
            key={color}
            className="bg-surface-2"
            style={{ background: colorSwatchBg(color) }}
          />
        ))}
      </div>

      <div>
        <p className="font-display font-semibold uppercase text-ink text-xl leading-tight">
          Todavía no guardaste looks
        </p>
        <p className="mt-2 text-sm text-ink-2">
          Generá tu primer look y guardalo para verlo acá.
        </p>
      </div>

      <Link
        href="/generador"
        className={cn(
          "inline-flex items-center gap-2 h-11 px-6",
          "rounded-button font-sans font-medium uppercase tracking-wide text-sm",
          "bg-ink text-bg hover:bg-ink-2",
          "transition-[transform,background-color] duration-150 active:scale-[0.985]",
        )}
      >
        <Sparkles className="size-4" aria-hidden />
        Generá tu primer look
      </Link>
    </div>
  );
}

/** Devuelve un color de fondo aproximado para las 4 celdas decorativas */
function colorSwatchBg(color: string): string {
  const map: Record<string, string> = {
    camel: "#c2a079",
    azul:  "#8a9aa8",
    olive: "#c9c8b0",
    negro: "#262522",
  };
  return map[color] ?? "#e5e0d2";
}

// ── Error banner ──────────────────────────────────────────────────────────────

function ErrorBanner({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mx-5 mt-4 flex items-center gap-3 px-4 py-3 bg-surface border border-line-2">
      <AlertCircle className="size-4 text-danger shrink-0" />
      <span className="text-sm text-ink-2 flex-1">
        No se pudieron cargar los looks.
      </span>
      <button
        type="button"
        onClick={onRetry}
        className="text-sm text-accent font-medium hover:underline"
      >
        Reintentar
      </button>
    </div>
  );
}

// ── Skeleton lista ─────────────────────────────────────────────────────────────

function LoadingList() {
  return (
    <div className="px-5 mt-2">
      <LookListSkeleton count={5} />
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface LooksHistoryClientProps {
  initialLooks: LookItemData[];
  initialError?: boolean;
}

export function LooksHistoryClient({
  initialLooks,
  initialError = false,
}: LooksHistoryClientProps) {
  const router = useRouter();

  const [looks, setLooks]         = useState<LookItemData[]>(initialLooks);
  const [sortMode, setSortMode]   = useState<SortMode>("recientes");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(initialError);

  // Pull-to-refresh state
  const pullStartY  = useRef(0);
  const pullDelta   = useRef(0);
  const [pullActive, setPullActive] = useState(false);

  const sorted = sortLooks(looks, sortMode);

  // ── Refresh ───────────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/looks");
      if (!res.ok) throw new Error("api_error");
      const data: LookItemData[] = await res.json();
      setLooks(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setPullActive(false);
    }
  }, []);

  // ── Pull-to-refresh (mobile) ──────────────────────────────────────────────
  useEffect(() => {
    const el = document.documentElement;

    const onTouchStart = (e: TouchEvent) => {
      if (el.scrollTop === 0) pullStartY.current = e.touches[0].clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!pullStartY.current) return;
      pullDelta.current = e.touches[0].clientY - pullStartY.current;
      if (pullDelta.current > 60) setPullActive(true);
    };

    const onTouchEnd = () => {
      if (pullDelta.current > 60) {
        refresh();
      }
      pullStartY.current = 0;
      pullDelta.current  = 0;
      setPullActive(false);
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove",  onTouchMove,  { passive: true });
    window.addEventListener("touchend",   onTouchEnd);
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove",  onTouchMove);
      window.removeEventListener("touchend",   onTouchEnd);
    };
  }, [refresh]);

  const total = looks.length;

  return (
    <div className="flex flex-col min-h-dvh bg-bg">

      {/* ── Pull-to-refresh indicator ────────────────────────────────────────── */}
      {pullActive && (
        <div className="fixed top-0 inset-x-0 z-50 flex justify-center pt-3 pointer-events-none">
          <div className="size-8 grid place-items-center bg-bg rounded-full shadow-card border border-line-2">
            <RefreshCw className="size-4 text-ink-2 animate-spin" />
          </div>
        </div>
      )}

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-bg/90 backdrop-blur-md border-b border-line-2 px-5 pt-3 pb-0">
        {/* Row 1: wordmark + search */}
        <div className="flex items-center justify-between mb-2">
          <Wordmark />
          {/* Placeholder search — funcionalidad futura */}
          <button
            type="button"
            aria-label="Buscar looks"
            className="size-9 grid place-items-center text-ink-2 hover:text-ink transition-colors"
          >
            <Search className="size-5" />
          </button>
        </div>

        {/* Row 2: H1 + contador */}
        <div className="flex items-end justify-between pb-3">
          <h1
            className="font-display font-bold uppercase text-ink leading-none"
            style={{ fontSize: 36, letterSpacing: "-0.01em" }}
          >
            Looks
          </h1>
          <div className="text-right pb-0.5">
            <div
              className="font-mono font-semibold text-ink leading-none"
              style={{ fontSize: 22 }}
            >
              {total}
            </div>
            <div className="eyebrow text-[9px] text-ink-3">guardados</div>
          </div>
        </div>

        {/* Filter row */}
        <div className="flex gap-1.5 pb-3 overflow-x-auto scrollbar-none">
          {(
            [
              { mode: "recientes"   as SortMode, label: "Recientes"   },
              { mode: "mas_usados"  as SortMode, label: "Más usados"  },
              { mode: "por_ocasion" as SortMode, label: "Por ocasión" },
            ] as const
          ).map(({ mode, label }) => (
            <Chip
              key={mode}
              size="sm"
              active={sortMode === mode}
              onClick={() => setSortMode(mode)}
            >
              {label}
            </Chip>
          ))}
        </div>
      </header>

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <div className="flex-1">

        {/* Error banner */}
        {error && !loading && (
          <ErrorBanner onRetry={refresh} />
        )}

        {/* Loading skeleton */}
        {loading && <LoadingList />}

        {/* Empty state */}
        {!loading && !error && sorted.length === 0 && <EmptyState />}

        {/* Look list / grid */}
        {!loading && sorted.length > 0 && (
          <>
            {/* Mobile: lista vertical */}
            <div className="md:hidden px-5 pb-4">
              {sorted.map((item) => (
                <LookCard
                  key={item.id}
                  look={toLookCard(item)}
                  variant="row"
                  href={`/looks/${item.id}`}
                />
              ))}
            </div>

            {/* Desktop: grid de tiles */}
            <div className="hidden md:grid md:grid-cols-3 lg:grid-cols-4 gap-4 px-8 py-6">
              {sorted.map((item) => (
                <LookCard
                  key={item.id}
                  look={toLookCard(item)}
                  variant="tile"
                  href={`/looks/${item.id}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
