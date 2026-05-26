import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { Chip } from "./Chip";

/* ─────────────────────────────────────────────────────────────────────────
   LookCard — card de un look guardado.

   variant="row"  → lista horizontal mobile-first (Handoff 15)
   variant="tile" → grid desktop md:3cols / lg:4cols

   Collage 2×2 (Handoff 15):
   • grid-cols-2 grid-rows-2 gap-px bg-surface-2 → línea 1px entre fotos
   • < 4 prendas → celdas vacías bg-surface-2
   • Imágenes via <img> (Supabase signed URLs, ya configuradas en next.config.ts)
   ───────────────────────────────────────────────────────────────────────── */

export interface Look {
  id: string;
  nombre: string;
  /** Pre-formateado "20·MAY·26" o "Nunca usado" */
  lastUsed: string;
  usageCount: number;
  /** Hasta 4 signed URLs. "" = celda vacía */
  garmentImages: string[];
}

export interface LookCardProps {
  look: Look;
  variant?: "row" | "tile";
  href?: string;
}

export function LookCard({ look, variant = "row", href }: LookCardProps) {
  if (variant === "tile") return <LookTile look={look} href={href} />;
  return <LookRow look={look} href={href} />;
}

// ── Row ───────────────────────────────────────────────────────────────────────

function LookRow({ look, href }: { look: Look; href?: string }) {
  const content = (
    <article className="flex items-center gap-3.5 py-3.5 border-t border-line-2 first:border-t-0">
      <LookCollage images={look.garmentImages} size={88} />
      <div className="flex-1 min-w-0">
        <h3
          className="font-display font-semibold uppercase leading-tight text-ink truncate"
          style={{ fontSize: 17, letterSpacing: "0.02em" }}
        >
          {look.nombre}
        </h3>
        <div className="mt-1 font-mono text-[11px] text-ink-3 uppercase tracking-wide">
          Último uso · {look.lastUsed}
        </div>
        <div className="mt-2">
          <Chip size="sm" tabIndex={-1}>
            {look.usageCount} {look.usageCount === 1 ? "uso" : "usos"}
          </Chip>
        </div>
      </div>
      <ChevronRight className="size-4 text-ink-3 shrink-0" />
    </article>
  );
  return href ? <Link href={href} className="block">{content}</Link> : content;
}

// ── Tile ─────────────────────────────────────────────────────────────────────

function LookTile({ look, href }: { look: Look; href?: string }) {
  const content = (
    <article className="group">
      {/* Collage cuadrado que llena el ancho del tile */}
      <LookCollage images={look.garmentImages} fill />
      <h3
        className="mt-2 font-display font-semibold uppercase leading-tight text-ink line-clamp-1"
        style={{ fontSize: 14, letterSpacing: "0.02em" }}
      >
        {look.nombre}
      </h3>
      <div className="mt-0.5 font-mono text-[10px] text-ink-3 uppercase tracking-wide">
        {look.lastUsed} · {look.usageCount} {look.usageCount === 1 ? "uso" : "usos"}
      </div>
    </article>
  );
  return href ? <Link href={href} className="block">{content}</Link> : content;
}

// ── Collage 2×2 ───────────────────────────────────────────────────────────────

/**
 * Collage cuadrado 2×2.
 *
 * Handoff 15:
 * • grid-template-columns: 1fr 1fr + gap: 1px + background: --surface-2
 *   → la línea de 1px entre fotos proviene del fondo visible en el gap.
 * • < 4 imágenes → celdas vacías bg-surface-2 (NO repetir la primera).
 *
 * @param images  Hasta 4 signed URLs. "" = celda vacía (bg-surface-2).
 * @param size    Ancho/alto en px cuando no se usa `fill`.
 * @param fill    Expande al 100% del padre (usado en tiles desktop).
 */
export function LookCollage({
  images,
  size,
  fill,
}: {
  images: string[];
  size?: number;
  fill?: boolean;
}) {
  // Rellena hasta 4 con string vacío (→ celda vacía surface-2)
  const four = [...images, "", "", "", ""].slice(0, 4);
  const style = fill ? undefined : { width: size, height: size };

  return (
    <div
      className={cn(
        "grid grid-cols-2 grid-rows-2 gap-px bg-surface-2 shrink-0 overflow-hidden",
        fill ? "aspect-square w-full" : null,
      )}
      style={style}
    >
      {four.map((src, i) => (
        <div key={i} className="relative bg-surface-2 overflow-hidden">
          {src && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
        </div>
      ))}
    </div>
  );
}
