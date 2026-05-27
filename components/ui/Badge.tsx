import { type ReactNode } from "react";
import { cn } from "@/lib/cn";

/* ─────────────────────────────────────────────────────────────────────────
   Badge — etiqueta informativa NO seleccionable.
   Usar Chip para opciones seleccionables.

   Variantes:
   - default · neutra
   - ai      · "✦ IA" — para campos completados por IA
   - success · ok / guardado
   - warning · atención
   - error   · error
   - count   · contador numérico (ej. "47 prendas")
   ───────────────────────────────────────────────────────────────────────── */

type BadgeVariant = "default" | "ai" | "success" | "warning" | "error" | "count";

export interface BadgeProps {
  variant?: BadgeVariant;
  size?: "sm" | "md";
  children?: ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-surface-2 text-ink-2",
  ai:      "bg-accent-tint text-accent",
  success: "bg-success-50 text-success-700 dark:bg-success-900 dark:text-success-300",
  warning: "bg-warning-50 text-warning-700 dark:bg-warning-900 dark:text-warning-300",
  error:   "bg-error-50  text-error-700  dark:bg-error-900  dark:text-error-300",
  count:   "bg-transparent text-ink-3 font-mono",
};

export function Badge({ variant = "default", size = "sm", children, className }: BadgeProps) {
  const isAI = variant === "ai";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium uppercase tracking-wider leading-none",
        size === "sm" ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-1 text-[11px]",
        variantStyles[variant],
        className,
      )}
    >
      {isAI && <span aria-hidden className="text-[8px]">✦</span>}
      {children ?? (isAI ? "IA" : null)}
    </span>
  );
}
