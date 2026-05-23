import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/* ─────────────────────────────────────────────────────────────────────────
   Button
   Variantes: primary · accent · secondary · ghost · danger
   Tamaños:   sm · md · lg
   Las variantes apuntan a tokens semánticos definidos en globals.css —
   funcionan automáticamente en light y dark.
   ───────────────────────────────────────────────────────────────────────── */

type Variant = "primary" | "accent" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Icono opcional renderizado antes del texto (16px recomendado). */
  icon?: ReactNode;
  /** Ocupa el 100% del contenedor. */
  fullWidth?: boolean;
  /** Estado de carga: muestra spinner, deshabilita interacción. */
  loading?: boolean;
}

const base =
  "inline-flex items-center justify-center gap-2 " +
  "rounded-button font-sans font-medium uppercase tracking-wide " +
  "transition-[transform,background-color,opacity] duration-150 ease-out-soft " +
  "active:scale-[0.985] " +
  "disabled:opacity-40 disabled:pointer-events-none " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

const variants: Record<Variant, string> = {
  primary:   "bg-ink text-bg hover:bg-ink-2",
  accent:    "bg-accent text-accent-ink hover:bg-sage-700 dark:hover:bg-sage-300",
  secondary: "bg-surface text-ink border border-line hover:bg-surface-2",
  ghost:     "bg-transparent text-ink border border-line hover:bg-surface-2",
  danger:    "bg-danger text-white hover:bg-terra-600",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-xs",      //  36px — usar en barras densas
  md: "h-11 px-5 text-sm",     //  44px — default mobile (touch target)
  lg: "h-13 px-6 text-base",   //  52px — CTAs primarios
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", icon, fullWidth, loading, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      data-loading={loading || undefined}
      className={cn(
        base,
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        className,
      )}
      {...rest}
    >
      {loading ? (
        <span
          aria-hidden
          className="size-4 rounded-full border-2 border-current border-r-transparent animate-spin"
        />
      ) : (
        icon && <span className="shrink-0 [&_svg]:size-4">{icon}</span>
      )}
      <span>{children}</span>
    </button>
  );
});
