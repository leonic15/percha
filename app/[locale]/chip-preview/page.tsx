import { Chip } from "@/components/ui";
import { Heart, Search } from "lucide-react";

export default function ChipPreviewPage() {
  return (
    <div className="bg-bg min-h-dvh p-6 space-y-6">
      {/* Searchbar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-ink-3 pointer-events-none" />
        <input
          type="search"
          placeholder="Buscar prendas..."
          readOnly
          className="w-full h-10 pl-10 pr-4 rounded-lg text-sm bg-surface border border-line placeholder:text-ink-3 text-ink"
        />
      </div>

      {/* Filter panel */}
      <div className="p-4 bg-surface rounded-xl border border-line-2 space-y-3">
        <div>
          <p className="text-xs font-medium text-ink-3 uppercase tracking-wider mb-2">Categoría</p>
          <div className="flex flex-wrap gap-1.5">
            <Chip size="sm" active>Todas</Chip>
            <Chip size="sm">Tops</Chip>
            <Chip size="sm">Pantalones</Chip>
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-ink-3 uppercase tracking-wider mb-2">Estación</p>
          <div className="flex flex-wrap gap-1.5">
            <Chip size="sm">Primavera</Chip>
            <Chip size="sm">Verano</Chip>
            <Chip size="sm">Otoño</Chip>
            <Chip size="sm">Invierno</Chip>
            <Chip size="sm">Todo el año</Chip>
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-ink-3 uppercase tracking-wider mb-2">Ocasión</p>
          <div className="flex flex-wrap gap-1.5">
            <Chip size="sm">Casual</Chip>
            <Chip size="sm">Trabajo</Chip>
            <Chip size="sm">Formal</Chip>
          </div>
        </div>
        <Chip size="sm" icon={<Heart className="size-3.5" />}>Solo favoritos</Chip>
      </div>

      {/* Active chips row */}
      <div className="flex flex-wrap gap-1.5">
        <Chip size="sm" active removable>Verano</Chip>
        <Chip size="sm" active removable>Casual</Chip>
      </div>
    </div>
  );
}
