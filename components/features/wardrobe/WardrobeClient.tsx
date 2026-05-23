"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Search, SlidersHorizontal, X, Heart, Plus } from "lucide-react";
import { GarmentCard, GarmentCardSkeleton, Chip } from "@/components/ui";
import type { Prenda, Category } from "@/lib/database.types";
import { cn } from "@/lib/cn";

// ── Tipos ────────────────────────────────────────────────────────────────────

type GarmentWithUrl = Prenda & {
  signedUrl: string | null;
};

interface Filters {
  q: string;
  category: string; // slug
  season: string;
  occasion: string;
  favorites: boolean;
}

interface WardrobeClientProps {
  initialGarments: GarmentWithUrl[];
  categories: Category[];
  total: number;
  pageSize: number;
  filters: Filters;
}

// ── Constantes de filtros ────────────────────────────────────────────────────

const SEASONS = [
  { value: "primavera", label: "Primavera" },
  { value: "verano",    label: "Verano" },
  { value: "otoño",     label: "Otoño" },
  { value: "invierno",  label: "Invierno" },
  { value: "todo_el_año", label: "Todo el año" },
] as const;

const OCCASIONS = [
  { value: "casual",   label: "Casual" },
  { value: "trabajo",  label: "Trabajo" },
  { value: "formal",   label: "Formal" },
  { value: "deporte",  label: "Deporte" },
  { value: "salida",   label: "Salida" },
] as const;

// ── Componente ───────────────────────────────────────────────────────────────

export function WardrobeClient({
  initialGarments,
  categories,
  total,
  pageSize,
  filters: serverFilters,
}: WardrobeClientProps) {
  const router   = useRouter();
  const pathname = usePathname();

  // ── Estado de filtros (sincronizado con URL) ─────────────────────────────
  const [q, setQ]               = useState(serverFilters.q);
  const [category, setCategory] = useState(serverFilters.category);
  const [season, setSeason]     = useState(serverFilters.season);
  const [occasion, setOccasion] = useState(serverFilters.occasion);
  const [favorites, setFavorites] = useState(serverFilters.favorites);
  const [showFilters, setShowFilters] = useState(false);

  // ── Estado de la grilla ──────────────────────────────────────────────────
  const [garments, setGarments] = useState(initialGarments);
  const [page, setPage]         = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const hasMore = garments.length < total;

  // Mapa de categorías para lookup rápido por id
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  // ── Debounce de búsqueda ─────────────────────────────────────────────────
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSearchChange(value: string) {
    setQ(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      pushFilters({ q: value, category, season, occasion, favorites });
    }, 400);
  }

  // ── Actualizar URL ────────────────────────────────────────────────────────
  function pushFilters(f: Filters) {
    const params = new URLSearchParams();
    if (f.q)        params.set("q", f.q);
    if (f.category) params.set("category", f.category);
    if (f.season)   params.set("season", f.season);
    if (f.occasion) params.set("occasion", f.occasion);
    if (f.favorites) params.set("favorites", "1");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function toggleCategory(slug: string) {
    const next = category === slug ? "" : slug;
    setCategory(next);
    pushFilters({ q, category: next, season, occasion, favorites });
  }

  function toggleSeason(value: string) {
    const next = season === value ? "" : value;
    setSeason(next);
    pushFilters({ q, category, season: next, occasion, favorites });
  }

  function toggleOccasion(value: string) {
    const next = occasion === value ? "" : value;
    setOccasion(next);
    pushFilters({ q, category, season, occasion: next, favorites });
  }

  function toggleFavorites() {
    const next = !favorites;
    setFavorites(next);
    pushFilters({ q, category, season, occasion, favorites: next });
  }

  function clearAllFilters() {
    setQ("");
    setCategory("");
    setSeason("");
    setOccasion("");
    setFavorites(false);
    router.replace(pathname, { scroll: false });
  }

  const activeFilterCount = [
    Boolean(category),
    Boolean(season),
    Boolean(occasion),
    favorites,
  ].filter(Boolean).length;

  // ── Toggle favorito individual (optimista) ───────────────────────────────
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function handleToggleFavorite(id: string) {
    if (togglingId) return;
    const target = garments.find((g) => g.id === id);
    if (!target) return;

    // Actualización optimista
    setTogglingId(id);
    setGarments((prev) =>
      prev.map((g) => (g.id === id ? { ...g, is_favorite: !g.is_favorite } : g))
    );

    try {
      await fetch(`/api/garments/${id}/favorite`, { method: "POST" });
    } catch {
      // revert on error
      setGarments((prev) =>
        prev.map((g) => (g.id === id ? { ...g, is_favorite: target.is_favorite } : g))
      );
    } finally {
      setTogglingId(null);
    }
  }

  // ── Infinite scroll ──────────────────────────────────────────────────────
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);

    const nextPage = page + 1;
    const params = new URLSearchParams();
    if (q)        params.set("q", q);
    if (category) params.set("category", category);
    if (season)   params.set("season", season);
    if (occasion) params.set("occasion", occasion);
    if (favorites) params.set("favorites", "1");
    params.set("page", String(nextPage));
    params.set("limit", String(pageSize));

    try {
      const res = await fetch(`/api/garments?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setGarments((prev) => [...prev, ...(json.garments as GarmentWithUrl[])]);
        setPage(nextPage);
      }
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page, q, category, season, occasion, favorites, pageSize]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="px-4 pt-5 pb-6 md:px-6 md:pt-8 max-w-5xl mx-auto">
      {/* ── Encabezado ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display font-semibold text-xl text-ink">Mi guardarropas</h1>
        <Link
          href="/guardarropas/nueva"
          aria-label="Agregar prenda"
          className={cn(
            "md:hidden grid place-items-center size-9 rounded-full",
            "bg-accent text-accent-ink hover:bg-sage-700 transition-colors",
          )}
        >
          <Plus className="size-4.5" aria-hidden />
        </Link>
      </div>

      {/* ── Barra de búsqueda + toggle filtros ──────────────────────────── */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-ink-3 pointer-events-none"
            aria-hidden
          />
          <input
            type="search"
            value={q}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Buscar prendas..."
            aria-label="Buscar prendas"
            className={cn(
              "w-full h-10 pl-9 pr-4 rounded-lg text-sm",
              "bg-surface border border-line",
              "placeholder:text-ink-3 text-ink",
              "focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent",
            )}
          />
        </div>
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          aria-expanded={showFilters}
          aria-label={`Filtros${activeFilterCount ? ` (${activeFilterCount} activos)` : ""}`}
          className={cn(
            "flex items-center gap-1.5 h-10 px-3.5 rounded-lg text-sm font-medium border transition-colors",
            showFilters || activeFilterCount > 0
              ? "bg-ink text-bg border-ink"
              : "bg-surface text-ink-2 border-line hover:bg-surface-2 hover:text-ink",
          )}
        >
          <SlidersHorizontal className="size-4" aria-hidden />
          <span className="hidden sm:inline">Filtros</span>
          {activeFilterCount > 0 && (
            <span className="inline-flex items-center justify-center size-4.5 rounded-full bg-accent text-accent-ink text-[10px] font-semibold">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Panel de filtros ────────────────────────────────────────────── */}
      {showFilters && (
        <div className="mb-4 space-y-3 p-4 bg-surface rounded-xl border border-line-2">
          {/* Categorías */}
          <div>
            <p className="text-xs font-medium text-ink-3 uppercase tracking-wider mb-2">Categoría</p>
            <div className="flex flex-wrap gap-1.5">
              <Chip
                size="sm"
                active={!category}
                onClick={() => { setCategory(""); pushFilters({ q, category: "", season, occasion, favorites }); }}
              >
                Todas
              </Chip>
              {categories.map((cat) => (
                <Chip
                  key={cat.id}
                  size="sm"
                  active={category === cat.slug}
                  onClick={() => toggleCategory(cat.slug)}
                >
                  {cat.nombre}
                </Chip>
              ))}
            </div>
          </div>

          {/* Estación */}
          <div>
            <p className="text-xs font-medium text-ink-3 uppercase tracking-wider mb-2">Estación</p>
            <div className="flex flex-wrap gap-1.5">
              {SEASONS.map((s) => (
                <Chip
                  key={s.value}
                  size="sm"
                  active={season === s.value}
                  onClick={() => toggleSeason(s.value)}
                >
                  {s.label}
                </Chip>
              ))}
            </div>
          </div>

          {/* Ocasión */}
          <div>
            <p className="text-xs font-medium text-ink-3 uppercase tracking-wider mb-2">Ocasión</p>
            <div className="flex flex-wrap gap-1.5">
              {OCCASIONS.map((o) => (
                <Chip
                  key={o.value}
                  size="sm"
                  active={occasion === o.value}
                  onClick={() => toggleOccasion(o.value)}
                >
                  {o.label}
                </Chip>
              ))}
            </div>
          </div>

          {/* Favoritos */}
          <div className="flex items-center justify-between">
            <Chip
              size="sm"
              active={favorites}
              onClick={toggleFavorites}
              icon={<Heart className={cn("size-3.5", favorites && "fill-current")} />}
            >
              Solo favoritos
            </Chip>

            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-xs text-ink-3 hover:text-danger flex items-center gap-1 transition-colors"
              >
                <X className="size-3" aria-hidden />
                Limpiar filtros
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Filtros activos como chips removibles ────────────────────────── */}
      {activeFilterCount > 0 && !showFilters && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {category && (
            <Chip
              size="sm"
              active
              removable
              onClick={() => { setCategory(""); pushFilters({ q, category: "", season, occasion, favorites }); }}
            >
              {categories.find((c) => c.slug === category)?.nombre ?? category}
            </Chip>
          )}
          {season && (
            <Chip
              size="sm"
              active
              removable
              onClick={() => { setSeason(""); pushFilters({ q, category, season: "", occasion, favorites }); }}
            >
              {SEASONS.find((s) => s.value === season)?.label ?? season}
            </Chip>
          )}
          {occasion && (
            <Chip
              size="sm"
              active
              removable
              onClick={() => { setOccasion(""); pushFilters({ q, category, season, occasion: "", favorites }); }}
            >
              {OCCASIONS.find((o) => o.value === occasion)?.label ?? occasion}
            </Chip>
          )}
          {favorites && (
            <Chip size="sm" active removable onClick={toggleFavorites}>
              Favoritos
            </Chip>
          )}
        </div>
      )}

      {/* ── Grilla ──────────────────────────────────────────────────────── */}
      {garments.length === 0 ? (
        <EmptyState hasFilters={Boolean(q || activeFilterCount)} onClear={clearAllFilters} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-4">
            {garments.map((g) => (
              <GarmentCard
                key={g.id}
                garment={{
                  id: g.id,
                  name: g.nombre,
                  category: (g.category_id ? categoryMap.get(g.category_id)?.nombre : null) ?? "",
                  imageUrl: g.signedUrl ?? "/icons/placeholder-garment.png",
                  favorite: g.is_favorite,
                }}
                href={`/guardarropas/${g.id}`}
                onToggleFavorite={handleToggleFavorite}
                showAIBadge={g.ia_analizada}
              />
            ))}
            {/* Skeletons mientras carga la siguiente página */}
            {loadingMore &&
              Array.from({ length: 4 }).map((_, i) => (
                <GarmentCardSkeleton key={`sk-${i}`} />
              ))}
          </div>

          {/* Sentinel para infinite scroll */}
          {hasMore && (
            <div ref={sentinelRef} className="h-8 mt-4" aria-hidden />
          )}

          {/* Contador */}
          {!hasMore && garments.length > 0 && (
            <p className="mt-6 text-center text-xs text-ink-3">
              {garments.length === 1
                ? "1 prenda en tu guardarropas"
                : `${garments.length} prendas en tu guardarropas`}
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ── Estado vacío ─────────────────────────────────────────────────────────────

function EmptyState({
  hasFilters,
  onClear,
}: {
  hasFilters: boolean;
  onClear: () => void;
}) {
  if (hasFilters) {
    return (
      <div className="mt-16 flex flex-col items-center gap-4 text-center px-4">
        <div className="w-14 h-14 rounded-full bg-surface-2 flex items-center justify-center">
          <Search className="size-6 text-ink-3" />
        </div>
        <div>
          <p className="font-medium text-ink">Sin resultados</p>
          <p className="text-sm text-ink-3 mt-1">Ninguna prenda coincide con los filtros aplicados.</p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-sm text-accent hover:underline font-medium"
        >
          Limpiar filtros
        </button>
      </div>
    );
  }

  return (
    <div className="mt-16 flex flex-col items-center gap-5 text-center px-4">
      <div className="w-16 h-16 rounded-full bg-surface-2 flex items-center justify-center">
        <span className="text-3xl" role="img" aria-label="Guardarropas vacío">👗</span>
      </div>
      <div>
        <p className="font-display font-semibold text-lg text-ink">Todavía no tenés prendas</p>
        <p className="text-sm text-ink-3 mt-1 leading-relaxed">
          Empezá a armar tu guardarropas digital.<br />¡Agregá tu primera prenda!
        </p>
      </div>
      <Link
        href="/guardarropas/nueva"
        className={cn(
          "inline-flex items-center gap-2 h-11 px-5 rounded-button text-sm font-medium uppercase tracking-wide",
          "bg-accent text-accent-ink hover:bg-sage-700 transition-colors",
          "active:scale-[0.985]",
        )}
      >
        <Plus className="size-4" aria-hidden />
        Agregar prenda
      </Link>
    </div>
  );
}
