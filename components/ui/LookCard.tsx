import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { Chip } from "./Chip";

/* ─────────────────────────────────────────────────────────────────────────
   LookCard — card de un look guardado, en formato lista horizontal:
   collage 2×2 de las prendas + nombre + último uso + contador.

   Para grilla (uso menos frecuente) usar variant="tile".
   ───────────────────────────────────────────────────────────────────────── */

export interface Look {
  id: string;
  name: string;
  lastUsed: string;      // ya formateada — ej. "20·MAY·26"
  usageCount: number;
  garmentImages: string[]; // 4 fotos (top-left → bottom-right)
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

function LookRow({ look, href }: { look: Look; href?: string }) {
  const content = (
    <article className="flex items-center gap-3.5 py-3.5 border-t border-line-2 first:border-t-0">
      <LookCollage images={look.garmentImages} size={88} />
      <div className="flex-1 min-w-0">
        <h3 className="font-display font-semibold uppercase tracking-tight text-lg leading-tight text-ink truncate">
          {look.name}
        </h3>
        <div className="mt-0.5 font-mono text-xs text-ink-3 uppercase tracking-wide">
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
  return href ? <Link href={href}>{content}</Link> : content;
}

function LookTile({ look, href }: { look: Look; href?: string }) {
  const content = (
    <article className="group">
      <div className="overflow-hidden rounded-card shadow-card">
        <LookCollage images={look.garmentImages} fill />
      </div>
      <h3 className="mt-2 font-display font-semibold uppercase tracking-tight text-base leading-tight text-ink line-clamp-1">
        {look.name}
      </h3>
      <div className="mt-0.5 font-mono text-xs text-ink-3 uppercase">
        {look.lastUsed} · {look.usageCount} {look.usageCount === 1 ? "uso" : "usos"}
      </div>
    </article>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

/* Collage 2×2 — siempre cuadrado. Si `fill` lo expande al ancho del padre. */
export function LookCollage({
  images,
  size,
  fill,
}: { images: string[]; size?: number; fill?: boolean }) {
  const four = [...images, ...Array(4).fill(images[0] ?? "")].slice(0, 4);
  const style = fill ? undefined : { width: size, height: size };
  return (
    <div
      className={cn(
        "grid grid-cols-2 grid-rows-2 gap-px bg-surface-2 shrink-0",
        fill ? "aspect-square w-full" : null,
      )}
      style={style}
    >
      {four.map((src, i) => (
        <div key={i} className="relative bg-surface-2 overflow-hidden">
          {src && (
            <Image
              src={src}
              alt=""
              fill
              sizes="50vw"
              className="object-cover"
            />
          )}
        </div>
      ))}
    </div>
  );
}
