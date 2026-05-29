import Link from "next/link";
import { Heart } from "lucide-react";
import { cn } from "@/lib/cn";
import { Badge } from "./Badge";

export interface Garment {
  id: string;
  name: string;
  category: string;
  imageUrl: string;
  favorite?: boolean;
}

export interface GarmentCardProps {
  garment: Garment;
  onToggleFavorite?: (id: string) => void;
  showAIBadge?: boolean;
  className?: string;
  /** href al detalle. Si no se pasa, no se envuelve en Link. */
  href?: string;
  /** true para las primeras cards above-the-fold — carga eager con fetchPriority high */
  priority?: boolean;
  /** Se llama justo antes de navegar — sirve para precargar la imagen */
  onBeforeNavigate?: () => void;
}

export function GarmentCard({
  garment,
  onToggleFavorite,
  showAIBadge,
  className,
  href,
  priority = false,
  onBeforeNavigate,
}: GarmentCardProps) {
  const inner = (
    <article
      className={cn(
        "group relative overflow-hidden bg-surface rounded-card shadow-card",
        "transition-transform duration-200 ease-out-soft hover:-translate-y-0.5",
        className,
      )}
    >
      <div className="relative aspect-[4/5] bg-surface-2 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={garment.imageUrl}
          alt={garment.name}
          className="absolute inset-0 w-full h-full object-cover"
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
        />
        {showAIBadge && (
          <div className="absolute left-2 top-2">
            <Badge variant="ai" />
          </div>
        )}
        <button
          type="button"
          aria-label={garment.favorite ? "Quitar de favoritos" : "Marcar como favorito"}
          aria-pressed={garment.favorite}
          onClick={(e) => {
            e.preventDefault();
            onToggleFavorite?.(garment.id);
          }}
          className={cn(
            "absolute right-2 top-2 grid place-items-center size-8 rounded-full",
            "bg-white/85 backdrop-blur-sm",
            "transition-transform duration-150 hover:scale-110 active:scale-95",
          )}
        >
          <Heart
            className={cn(
              "size-4",
              garment.favorite ? "fill-danger text-danger" : "text-ink",
            )}
            strokeWidth={1.8}
          />
        </button>
      </div>
      <div className="px-2.5 pt-2 pb-2.5">
        <h3 className="font-display font-semibold text-[13px] uppercase tracking-tight leading-tight line-clamp-1 text-ink">
          {garment.name}
        </h3>
        <div className="eyebrow mt-0.5">{garment.category}</div>
      </div>
    </article>
  );
  return href ? <Link href={href} onClick={onBeforeNavigate}>{inner}</Link> : inner;
}

/* ───────────── Skeleton específico del card ─────────────
   Se importa donde haya grillas para mostrar mientras carga. */
export function GarmentCardSkeleton() {
  return (
    <div className="bg-surface rounded-card shadow-card overflow-hidden">
      <div className="aspect-[4/5] bg-surface-2 animate-pulse" />
      <div className="px-2.5 pt-2 pb-2.5 space-y-1.5">
        <div className="h-3 w-3/4 bg-surface-2 animate-pulse rounded-sm" />
        <div className="h-2 w-1/3 bg-surface-2 animate-pulse rounded-sm" />
      </div>
    </div>
  );
}
