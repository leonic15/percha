import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/* ─────────────────────────────────────────────────────────────────────────
   Chip — opción seleccionable (multi o single) en pill.
   Usado en filtros de categoría, temporada, ocasión, estilo y en el
   formulario de prenda.

   • `active` controla el estado seleccionado.
   • `removable` muestra una × — útil para chips de filtros aplicados.
   • Es un <button>: cualquier `onClick` es la fuente de la verdad.
   ───────────────────────────────────────────────────────────────────────── */

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  removable?: boolean;
  size?: "sm" | "md";
  icon?: ReactNode;
}

export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { active = false, removable, size = "md", icon, children, className, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-chip border leading-none whitespace-nowrap",
        "font-medium transition-colors duration-150 ease-out-soft",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-sm",
        active
          ? "bg-ink text-bg border-ink"
          : "bg-transparent text-ink-2 border-line hover:bg-surface-2 hover:text-ink",
        className,
      )}
      {...rest}
    >
      {icon && <span className="[&_svg]:size-3.5">{icon}</span>}
      <span>{children}</span>
      {removable && (
        <svg
          aria-hidden
          width="10"
          height="10"
          viewBox="0 0 10 10"
          className="ml-0.5 opacity-70"
        >
          <path
            d="M1 1l8 8M9 1L1 9"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  );
});
