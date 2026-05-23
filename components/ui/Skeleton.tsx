import { cn } from "@/lib/cn";

/* ─────────────────────────────────────────────────────────────────────────
   Skeleton — bloque animado para indicar carga.
   Componer skeletons compuestos a partir de <Skeleton />:

     <div className="space-y-2">
       <Skeleton className="h-4 w-3/4" />
       <Skeleton className="h-3 w-1/2" />
     </div>

   Para grillas usar <GarmentCardSkeleton/> (definido en GarmentCard.tsx).
   ───────────────────────────────────────────────────────────────────────── */

export interface SkeletonProps {
  className?: string;
  /** rect | circle | text — afecta el border-radius */
  shape?: "rect" | "circle" | "text";
}

export function Skeleton({ className, shape = "rect" }: SkeletonProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "block bg-surface-2 animate-pulse",
        shape === "circle" && "rounded-full",
        shape === "text"   && "rounded-sm",
        shape === "rect"   && "rounded-card",
        className,
      )}
    />
  );
}

/* Skeleton compuesto: grilla de prendas con N items */
export function GarmentGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-surface rounded-card shadow-card overflow-hidden">
          <Skeleton className="aspect-[4/5] w-full" />
          <div className="px-2.5 pt-2 pb-2.5 space-y-1.5">
            <Skeleton shape="text" className="h-3 w-3/4" />
            <Skeleton shape="text" className="h-2 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* Skeleton compuesto: lista de looks (LookCard variant=row) */
export function LookListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="divide-y divide-line-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3.5 py-3.5">
          <Skeleton className="size-22 shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton shape="text" className="h-4 w-1/2" />
            <Skeleton shape="text" className="h-3 w-1/3" />
            <Skeleton shape="text" className="h-5 w-16 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
