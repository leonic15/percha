import { GarmentGridSkeleton } from "@/components/ui";

/**
 * Skeleton de carga mientras el servidor re-fetcha al cambiar filtros.
 * Next.js lo muestra automáticamente via Suspense del App Router.
 */
export default function GuardarropaLoading() {
  return (
    <div className="px-4 pt-5 md:px-6 md:pt-8 space-y-5">
      {/* header placeholder */}
      <div className="h-7 w-44 bg-surface-2 animate-pulse rounded-sm" />
      {/* search + filters placeholder */}
      <div className="flex gap-2">
        <div className="flex-1 h-10 bg-surface-2 animate-pulse rounded-lg" />
        <div className="h-10 w-24 bg-surface-2 animate-pulse rounded-lg" />
      </div>
      <GarmentGridSkeleton count={8} />
    </div>
  );
}
