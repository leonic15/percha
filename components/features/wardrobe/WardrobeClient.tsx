"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  Search, Bell, SlidersHorizontal, LayoutGrid, List,
  Heart, Plus, Grid2x2,
} from "lucide-react";
import { GarmentCard, GarmentCardSkeleton, Chip, GarmentImage, LookLoopSpinner } from "@/components/ui";
import type { Prenda, Category } from "@/lib/database.types";
import { cn } from "@/lib/cn";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type GarmentWithUrl = Prenda;

interface Filters {
  q:         string;
  category:  string;
  season:    string;
  occasion:  string;
  favorites: boolean;
}

interface WardrobeClientProps {
  initialGarments: GarmentWithUrl[];
  categories:      Category[];
  total:           number;
  totalAll:        number;
  pageSize:        number;
  filters:         Filters;
}

// ── Constantes ────────────────────────────────────────────────────────────────

const SEASONS = [
  { value: "primavera",   label: "Primavera" },
  { value: "verano",      label: "Verano"    },
  { value: "otoño",       label: "Otoño"     },
  { value: "invierno",    label: "Invierno"  },
  { value: "todo_el_año", label: "Todo el año" },
] as const;

const OCCASIONS = [
  { value: "casual",  label: "Casual"  },
  { value: "trabajo", label: "Trabajo" },
  { value: "formal",  label: "Formal"  },
  { value: "deporte", label: "Deporte" },
  { value: "salida",  label: "Salida"  },
] as const;

const CATEGORY_IMAGE: Record<string, string> = {
  "tops":                    "/images/category/tops.png",
  "pantalones-y-shorts":     "/images/category/jeans.png",
  "vestidos-y-faldas":       "/images/category/dress.png",
  "calzado":                 "/images/category/shoes.png",
  "abrigos-y-chaquetas":     "/images/category/Coats.png",
  "ropa-interior-y-pijamas": "/images/category/Pijama.png",
  "accesorios":              "/images/category/accesories.png",
  "otros":                   "/images/category/Others.png",
};

// ── Wordmark inline ────────────────────────────────────────────────────────────

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

// ── Componente principal ───────────────────────────────────────────────────────

export function WardrobeClient({
  initialGarments,
  categories,
  total,
  totalAll,
  pageSize,
  filters: serverFilters,
}: WardrobeClientProps) {
  const router   = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  // ── Filtros activos (sincronizados con URL) ──────────────────────────────
  const [q, setQ]               = useState(serverFilters.q);
  const [category, setCategory] = useState(serverFilters.category);
  const [season, setSeason]     = useState(serverFilters.season);
  const [occasion, setOccasion] = useState(serverFilters.occasion);
  const [favorites, setFavorites] = useState(serverFilters.favorites);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [showSearch, setShowSearch] = useState(Boolean(serverFilters.q));
  const [showSheet, setShowSheet]   = useState(false);
  const [viewMode, setViewMode]     = useState<"categories" | "grid" | "list">(
    serverFilters.category ? "grid" : "categories"
  );

  // ── Filtros pendientes (bottom sheet — se confirman al "Aplicar") ────────
  const [pQ, setPQ]               = useState(serverFilters.q);
  const [pCategory, setPCategory] = useState(serverFilters.category);
  const [pSeason, setPSeason]     = useState(serverFilters.season);
  const [pOccasion, setPOccasion] = useState(serverFilters.occasion);
  const [pFavorites, setPFavorites] = useState(serverFilters.favorites);

  // ── Datos de la grilla ────────────────────────────────────────────────────
  const [garments, setGarments]         = useState(initialGarments);
  const [page, setPage]                 = useState(1);
  const [loadingMore, setLoadingMore]   = useState(false);
  const [refreshing, setRefreshing]     = useState(false);
  const hasMore = garments.length < total;

  // ── Pull-to-refresh state ─────────────────────────────────────────────────
  const pullStartY  = useRef(0);
  const pullDelta   = useRef(0);
  const [pullActive, setPullActive] = useState(false);

  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  // ── Precargar imágenes de categorías en background ───────────────────────
  useEffect(() => {
    Object.values(CATEGORY_IMAGE).forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  // ── Bloquear scroll del body cuando el sheet está abierto ────────────────
  useEffect(() => {
    document.body.style.overflow = showSheet ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [showSheet]);

  // ── Actualizar URL ────────────────────────────────────────────────────────
  function pushFilters(f: Filters) {
    const params = new URLSearchParams();
    if (f.q)        params.set("q", f.q);
    if (f.category) params.set("category", f.category);
    if (f.season)   params.set("season", f.season);
    if (f.occasion) params.set("occasion", f.occasion);
    if (f.favorites) params.set("favorites", "1");
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  // ── Debounce búsqueda ─────────────────────────────────────────────────────
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function handleSearchChange(value: string) {
    setQ(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      pushFilters({ q: value, category, season, occasion, favorites });
    }, 400);
  }

  // ── Toggle categoría (chips rápidos) ─────────────────────────────────────
  function toggleCategory(slug: string) {
    const next = category === slug ? "" : slug;
    setCategory(next);
    pushFilters({ q, category: next, season, occasion, favorites });
  }

  // ── Limpiar todos los filtros ─────────────────────────────────────────────
  function clearAllFilters() {
    setQ(""); setCategory(""); setSeason(""); setOccasion(""); setFavorites(false);
    router.replace(pathname, { scroll: false });
  }

  // ── Seleccionar categoría desde la vista de categorías ────────────────────
  function handleCategorySelect(slug: string) {
    setCategory(slug);
    setViewMode("grid");
    pushFilters({ q, category: slug, season, occasion, favorites });
  }

  // ── Bottom sheet: abrir / cerrar / aplicar ────────────────────────────────
  function openSheet() {
    setPQ(q); setPCategory(category); setPSeason(season);
    setPOccasion(occasion); setPFavorites(favorites);
    setShowSheet(true);
  }

  function closeSheet() {
    setShowSheet(false);
  }

  function applySheet() {
    setQ(pQ); setCategory(pCategory); setSeason(pSeason);
    setOccasion(pOccasion); setFavorites(pFavorites);
    pushFilters({ q: pQ, category: pCategory, season: pSeason, occasion: pOccasion, favorites: pFavorites });
    setShowSheet(false);
  }

  function clearSheet() {
    setPQ(""); setPCategory(""); setPSeason(""); setPOccasion(""); setPFavorites(false);
  }

  // ── Contadores de filtros activos ─────────────────────────────────────────
  const activeFilterCount = [
    Boolean(category), Boolean(season), Boolean(occasion), favorites,
  ].filter(Boolean).length;

  // Texto resumen del sub-bar: "2 filtros · otoño · casual"
  const filterSummaryParts: string[] = [];
  if (season)   filterSummaryParts.push(SEASONS.find((s) => s.value === season)?.label  ?? season);
  if (occasion) filterSummaryParts.push(OCCASIONS.find((o) => o.value === occasion)?.label ?? occasion);
  if (favorites) filterSummaryParts.push("favoritos");
  const filterSummary = activeFilterCount > 0
    ? `${activeFilterCount} filtro${activeFilterCount > 1 ? "s" : ""} · ${filterSummaryParts.join(" · ")}`
    : "Filtros";

  // ── Toggle favorito (optimista) ───────────────────────────────────────────
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function handleToggleFavorite(id: string) {
    if (togglingId) return;
    const target = garments.find((g) => g.id === id);
    if (!target) return;
    setTogglingId(id);
    setGarments((prev) =>
      prev.map((g) => (g.id === id ? { ...g, is_favorite: !g.is_favorite } : g))
    );
    try {
      await fetch(`/api/garments/${id}/favorite`, { method: "POST" });
    } catch {
      setGarments((prev) =>
        prev.map((g) => (g.id === id ? { ...g, is_favorite: target.is_favorite } : g))
      );
    } finally {
      setTogglingId(null);
    }
  }

  // ── Refresh (pull-to-refresh) ─────────────────────────────────────────────
  const refresh = useCallback(async () => {
    setRefreshing(true);
    const params = new URLSearchParams();
    if (q)        params.set("q", q);
    if (category) params.set("category", category);
    if (season)   params.set("season", season);
    if (occasion) params.set("occasion", occasion);
    if (favorites) params.set("favorites", "1");
    params.set("page", "1");
    params.set("limit", String(pageSize));
    try {
      const res = await fetch(`/api/garments?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setGarments(json.garments as Prenda[]);
        setPage(1);
      }
    } finally {
      setRefreshing(false);
      setPullActive(false);
    }
  }, [q, category, season, occasion, favorites, pageSize]);

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
      if (pullDelta.current > 60) refresh();
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

  // ── Infinite scroll ───────────────────────────────────────────────────────
  const sentinelRef  = useRef<HTMLDivElement | null>(null);
  const fetchLockRef = useRef(false);

  const loadMore = useCallback(async () => {
    if (fetchLockRef.current || !hasMore) return;
    fetchLockRef.current = true;
    setLoadingMore(true);
    const nextPage = page + 1;
    const params = new URLSearchParams();
    if (q)        params.set("q", q);
    if (category) params.set("category", category);
    if (season)   params.set("season", season);
    if (occasion) params.set("occasion", occasion);
    if (favorites) params.set("favorites", "1");
    params.set("page",  String(nextPage));
    params.set("limit", String(pageSize));
    try {
      const res = await fetch(`/api/garments?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setGarments((prev) => [...prev, ...(json.garments as Prenda[])]);
        setPage(nextPage);
      }
    } finally {
      fetchLockRef.current = false;
      setLoadingMore(false);
    }
  }, [hasMore, page, q, category, season, occasion, favorites, pageSize]);

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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* ═══════════════ PULL-TO-REFRESH INDICATOR ═══════════════════════ */}
      {(pullActive || refreshing) && (
        <div className="fixed top-0 inset-x-0 z-50 flex justify-center pt-3 pointer-events-none">
          <div className="size-8 grid place-items-center bg-bg rounded-full shadow-card border border-line-2">
            <svg
              className={cn("size-4 text-accent", refreshing && "animate-spin")}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      )}

      {/* ═══════════════ HEADER STICKY ════════════════════════════════════ */}
      <header className="sticky top-0 z-20 bg-bg">

        {/* Fila 1: wordmark + iconos */}
        <div className="px-5 pt-3 pb-1 flex items-center justify-between">
          <Wordmark />
          <div className="flex items-center gap-4">
            <button
              type="button"
              aria-label="Buscar"
              onClick={() => {
                setShowSearch((v) => !v);
                if (showSearch) { setQ(""); pushFilters({ q: "", category, season, occasion, favorites }); }
              }}
              className={cn("transition-colors", showSearch ? "text-ink" : "text-ink-2 hover:text-ink")}
            >
              <Search className="size-5" aria-hidden />
            </button>
            <button type="button" aria-label="Notificaciones" className="text-ink-2 hover:text-ink transition-colors">
              <Bell className="size-5" aria-hidden />
            </button>
          </div>
        </div>

        {/* Búsqueda expandible */}
        {showSearch && (
          <div className="px-5 pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-ink-3 pointer-events-none" aria-hidden />
              <input
                autoFocus
                type="search"
                value={q}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Buscar prendas..."
                aria-label="Buscar prendas"
                className={cn(
                  "w-full h-9 pl-9 pr-4 text-sm",
                  "bg-surface-2 rounded-lg",
                  "placeholder:text-ink-3 text-ink",
                  "outline-none focus:ring-2 focus:ring-accent",
                )}
              />
            </div>
          </div>
        )}

        {/* Fila 2: H1 + contador */}
        <div className="px-5 pb-2 flex items-end justify-between">
          <h1
            className="font-display font-semibold uppercase text-ink leading-none"
            style={{ fontSize: 36, letterSpacing: "-0.01em" }}
          >
            Guardarropa
          </h1>
          {(totalAll || total) > 0 && (
            <div className="text-right leading-none pb-0.5">
              <div className="font-mono font-semibold text-ink" style={{ fontSize: 22, lineHeight: 1 }}>
                {totalAll || total}
              </div>
              <div className="eyebrow" style={{ fontSize: 9 }}>prendas</div>
            </div>
          )}
        </div>

        {/* Chips categorías — solo en vista de items o lista */}
        {viewMode !== "categories" && (
          <div
            className="px-5 pb-2 flex gap-1.5 overflow-x-auto [-webkit-overflow-scrolling:touch]"
            style={{ scrollbarWidth: "none" }}
          >
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
        )}

        {/* Sub-bar: resumen filtros + toggle vista */}
        <div className="px-5 pb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={openSheet}
            className={cn(
              "flex items-center gap-1.5 text-xs transition-colors",
              activeFilterCount > 0 ? "text-ink font-medium" : "text-ink-3 hover:text-ink-2",
            )}
          >
            <SlidersHorizontal className="size-3.5" aria-hidden />
            {filterSummary}
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Vista por categorías"
              onClick={() => setViewMode("categories")}
              className={cn("transition-colors", viewMode === "categories" ? "text-ink" : "text-ink-3 hover:text-ink-2")}
            >
              <Grid2x2 className="size-3.5" aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Vista en grilla"
              onClick={() => setViewMode("grid")}
              className={cn("transition-colors", viewMode === "grid" ? "text-ink" : "text-ink-3 hover:text-ink-2")}
            >
              <LayoutGrid className="size-3.5" aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Vista en lista"
              onClick={() => setViewMode("list")}
              className={cn("transition-colors", viewMode === "list" ? "text-ink" : "text-ink-3 hover:text-ink-2")}
            >
              <List className="size-3.5" aria-hidden />
            </button>
          </div>
        </div>

        <div className="h-px bg-line-2" />
      </header>

      {/* ═══════════════ CONTENIDO ════════════════════════════════════════ */}
      <div className="px-5 pt-4 pb-6">
        {isPending ? (
          <div className="flex items-center justify-center mt-24">
            <LookLoopSpinner size={72} />
          </div>
        ) : viewMode === "categories" ? (
          <CategoriesView categories={categories} onSelect={handleCategorySelect} />
        ) : garments.length === 0 ? (
          <EmptyState hasFilters={Boolean(q || activeFilterCount)} onClear={clearAllFilters} />
        ) : (
          <>
            {viewMode === "grid" ? (
              <div className="grid grid-cols-3 gap-[10px] md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {garments.map((g, i) => (
                  <GarmentCard
                    key={g.id}
                    garment={{
                      id:       g.id,
                      name:     g.nombre,
                      category: (g.category_id ? categoryMap.get(g.category_id)?.nombre : null) ?? "",
                      imageUrl: g.imagen_url ? `/api/garments/${g.id}/image` : "/icons/placeholder-garment.png",
                      favorite: g.is_favorite,
                    }}
                    href={`/guardarropas/${g.id}`}
                    onToggleFavorite={handleToggleFavorite}
                    showAIBadge={g.ia_analizada}
                    priority={i < 4}
                    onBeforeNavigate={() => {
                      if (!g.imagen_url) return;
                      // Precarga la URL estable del proxy en paralelo con el render del server.
                      // Si el SW ya tiene la imagen cacheada, este fetch retorna al instante.
                      const img = new window.Image();
                      img.src = `/api/garments/${g.id}/image`;
                    }}
                  />
                ))}
                {loadingMore && Array.from({ length: 4 }).map((_, i) => (
                  <GarmentCardSkeleton key={`sk-${i}`} />
                ))}
              </div>
            ) : (
              /* Vista lista */
              <div className="flex flex-col gap-2">
                {garments.map((g) => (
                  <GarmentListItem
                    key={g.id}
                    garment={{
                      id:       g.id,
                      name:     g.nombre,
                      category: (g.category_id ? categoryMap.get(g.category_id)?.nombre : null) ?? "",
                      imageUrl: g.imagen_url ? `/api/garments/${g.id}/image` : "/icons/placeholder-garment.png",
                      favorite: g.is_favorite,
                    }}
                    onToggleFavorite={handleToggleFavorite}
                  />
                ))}
              </div>
            )}

            {hasMore && <div ref={sentinelRef} className="h-8 mt-4" aria-hidden />}

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

      {/* ═══════════════ FAB (mobile) ═════════════════════════════════════ */}
      <Link
        href="/guardarropas/nueva"
        aria-label="Agregar prenda"
        className={cn(
          "fixed right-5 bottom-[108px] z-30 md:hidden",
          "flex items-center justify-center size-14 rounded-full",
          "bg-accent text-accent-ink",
          "shadow-[0_8px_24px_rgba(0,0,0,0.15)]",
          "hover:bg-sage-700 active:scale-95 transition-all",
        )}
      >
        <Plus className="size-6" strokeWidth={1.8} aria-hidden />
      </Link>

      {/* ═══════════════ BOTTOM SHEET — FILTROS ══════════════════════════ */}
      {showSheet && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/40"
            aria-hidden
            onClick={closeSheet}
          />

          {/* Sheet */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Filtros"
            className={cn(
              "fixed inset-x-0 bottom-0 z-50",
              "bg-bg rounded-t-[20px] max-h-[78vh] overflow-y-auto",
              "shadow-[0_-8px_30px_rgba(0,0,0,0.2)]",
              "[animation:sheet-up_280ms_cubic-bezier(0.32,0.72,0,1)_both]",
            )}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-9 h-1 rounded-full bg-line" />
            </div>

            <div className="px-5 pb-[max(env(safe-area-inset-bottom),28px)]">
              {/* Encabezado sheet */}
              <div className="flex items-center justify-between py-4">
                <h2
                  className="font-display font-semibold uppercase text-ink"
                  style={{ fontSize: 24, letterSpacing: "-0.01em" }}
                >
                  Filtros
                </h2>
                <button
                  type="button"
                  onClick={clearSheet}
                  className="text-sm text-accent hover:underline"
                >
                  Limpiar todo
                </button>
              </div>

              {/* Categoría */}
              <div className="mb-5">
                <p className="eyebrow mb-2.5">Categoría</p>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((cat) => (
                    <Chip
                      key={cat.id}
                      size="sm"
                      active={pCategory === cat.slug}
                      onClick={() => setPCategory(pCategory === cat.slug ? "" : cat.slug)}
                    >
                      {cat.nombre}
                    </Chip>
                  ))}
                </div>
              </div>

              {/* Temporada */}
              <div className="mb-5">
                <p className="eyebrow mb-2.5">Temporada</p>
                <div className="flex flex-wrap gap-1.5">
                  {SEASONS.map((s) => (
                    <Chip
                      key={s.value}
                      size="sm"
                      active={pSeason === s.value}
                      onClick={() => setPSeason(pSeason === s.value ? "" : s.value)}
                    >
                      {s.label}
                    </Chip>
                  ))}
                </div>
              </div>

              {/* Ocasión */}
              <div className="mb-5">
                <p className="eyebrow mb-2.5">Ocasión</p>
                <div className="flex flex-wrap gap-1.5">
                  {OCCASIONS.map((o) => (
                    <Chip
                      key={o.value}
                      size="sm"
                      active={pOccasion === o.value}
                      onClick={() => setPOccasion(pOccasion === o.value ? "" : o.value)}
                    >
                      {o.label}
                    </Chip>
                  ))}
                </div>
              </div>

              {/* Solo favoritos — toggle iOS-style */}
              <div className="flex items-center justify-between py-3 border-t border-line mb-5">
                <span className="text-sm text-ink">Solo favoritos</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={pFavorites}
                  aria-label="Solo favoritos"
                  onClick={() => setPFavorites((v) => !v)}
                  className={cn(
                    "relative inline-flex items-center h-6 w-10 rounded-full transition-colors duration-200",
                    pFavorites ? "bg-ink" : "bg-stone-300",
                  )}
                >
                  <span
                    className={cn(
                      "absolute inline-block size-[18px] rounded-full bg-bg shadow transition-transform duration-200",
                      pFavorites ? "translate-x-[22px]" : "translate-x-[2px]",
                    )}
                  />
                </button>
              </div>

              {/* CTA aplicar */}
              <button
                type="button"
                onClick={applySheet}
                className={cn(
                  "w-full h-13 rounded-button",
                  "text-sm font-medium uppercase tracking-wide",
                  "bg-ink text-bg",
                  "hover:bg-stone-800 active:scale-[0.985] transition-all",
                )}
              >
                Aplicar filtros
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Vista de categorías ───────────────────────────────────────────────────────

const CATEGORY_ORDER = [
  "tops",
  "pantalones-y-shorts",
  "vestidos-y-faldas",
  "abrigos-y-chaquetas",
  "ropa-interior-y-pijamas",
  "calzado",
  "accesorios",
  "otros",
];

function CategoriesView({
  categories,
  onSelect,
}: {
  categories: Category[];
  onSelect: (slug: string) => void;
}) {
  const sorted = [...categories].sort(
    (a, b) => (CATEGORY_ORDER.indexOf(a.slug) ?? 99) - (CATEGORY_ORDER.indexOf(b.slug) ?? 99)
  );

  return (
    <div className="grid grid-cols-2 gap-3">
      {sorted.map((cat) => {
        const imgSrc = CATEGORY_IMAGE[cat.slug];
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelect(cat.slug)}
            className={cn(
              "flex flex-col items-center justify-center gap-3",
              "bg-surface rounded-card shadow-[0_2px_12px_rgba(0,0,0,0.15)]",
              "py-4 px-3",
              "hover:bg-surface-2 active:scale-[0.97] transition-all",
            )}
          >
            <div className="w-[100px] h-[100px] flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imgSrc}
                alt={cat.nombre}
                className="w-full h-full object-contain"
                loading="eager"
                decoding="async"
              />
            </div>
            <span
              className="font-display font-semibold text-[15px] uppercase tracking-tight text-ink text-center leading-tight"
            >
              {cat.nombre}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Vista lista — item ────────────────────────────────────────────────────────

function GarmentListItem({
  garment,
  onToggleFavorite,
}: {
  garment: { id: string; name: string; category: string; imageUrl: string; favorite?: boolean };
  onToggleFavorite?: (id: string) => void;
}) {
  return (
    <Link href={`/guardarropas/${garment.id}`}>
      <article className="flex items-center gap-3 bg-surface rounded-card shadow-card p-2.5 hover:-translate-y-px transition-transform">
        <div className="relative size-14 rounded-sm overflow-hidden bg-surface-2 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={garment.imageUrl} alt={garment.name} className="size-full object-cover" loading="lazy" decoding="async" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold text-sm uppercase tracking-tight text-ink truncate">
            {garment.name}
          </p>
          <p className="eyebrow mt-0.5">{garment.category}</p>
        </div>
        {onToggleFavorite && (
          <button
            type="button"
            aria-label={garment.favorite ? "Quitar de favoritos" : "Marcar como favorito"}
            onClick={(e) => { e.preventDefault(); onToggleFavorite(garment.id); }}
            className="shrink-0 p-1.5"
          >
            <Heart
              className={cn("size-4", garment.favorite ? "fill-danger text-danger" : "text-ink-3")}
              strokeWidth={1.8}
            />
          </button>
        )}
      </article>
    </Link>
  );
}

// ── Estado vacío ──────────────────────────────────────────────────────────────

function EmptyState({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  if (hasFilters) {
    return (
      <div className="mt-20 flex flex-col items-center gap-4 text-center px-4">
        <div className="w-14 h-14 rounded-full bg-surface-2 flex items-center justify-center">
          <Search className="size-6 text-ink-3" aria-hidden />
        </div>
        <div>
          <p className="font-display font-semibold text-base text-ink uppercase tracking-tight">Sin resultados</p>
          <p className="text-sm text-ink-2 mt-1 leading-relaxed max-w-xs">Ninguna prenda coincide con los filtros aplicados.</p>
        </div>
        <button type="button" onClick={onClear} className="text-sm text-accent hover:underline font-medium">
          Limpiar filtros
        </button>
      </div>
    );
  }

  return (
    <div className="mt-10 flex flex-col items-center text-center px-4">
      {/* Ilustración 3 prendas apiladas */}
      <div aria-hidden style={{ position: "relative", width: 200, height: 200, marginBottom: 32 }}>
        <GarmentImage color="terra"  src="/api/img/cartera-roja.png"    label="cartera"   style={{ position: "absolute", left: 0,  top: 20, width: 90, height: 130, transform: "rotate(-8deg)" }} />
        <GarmentImage color="denim"  src="/api/img/blazer-azul.png"     label="blazer"    style={{ position: "absolute", right: 0, top: 0,  width: 90, height: 130, transform: "rotate(6deg)"  }} />
        <GarmentImage color="sand"   src="/api/img/pantalon-mostaza.png" label="pantalón" style={{ position: "absolute", left: 55, top: 65, width: 90, height: 130, transform: "rotate(-2deg)" }} />
      </div>

      <h2
        className="font-display font-semibold uppercase text-ink"
        style={{ fontSize: 32, letterSpacing: "-0.01em", lineHeight: 1.05, margin: "0 0 12px" }}
      >
        Tu armario<br />está esperando.
      </h2>
      <p className="text-sm text-ink-2 leading-relaxed mb-7 max-w-[280px]">
        Subí la primera prenda. Nuestra IA la va a analizar y completar los datos por vos.
      </p>

      <Link
        href="/guardarropas/nueva"
        className={cn(
          "inline-flex items-center gap-2 h-13 px-6 rounded-button",
          "text-sm font-medium uppercase tracking-wide",
          "bg-accent text-accent-ink hover:bg-sage-700 transition-colors active:scale-[0.985]",
        )}
      >
        <Plus className="size-4" aria-hidden />
        Agregar primera prenda
      </Link>

      <p className="mt-9 text-xs text-ink-3 flex items-center gap-1.5">
        <span className="inline-block w-4 h-px bg-line" />
        tip · 8 prendas mínimo para generar looks
        <span className="inline-block w-4 h-px bg-line" />
      </p>
    </div>
  );
}
