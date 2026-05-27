import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Badge } from "./Badge";

/* ─────────────────────────────────────────────────────────────────────────
   Input — alineado al sistema editorial. Underline en vez de box.
   Soporta label, hint, error, prefix/suffix, y el badge "✦ IA"
   cuando el campo fue completado por la IA.
   ───────────────────────────────────────────────────────────────────────── */

// Omitimos 'prefix' del HTMLAttributes porque el nativo espera string|undefined
// y aquí queremos aceptar ReactNode (íconos, etc.)
export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "prefix"> {
  label?: string;
  hint?: string;
  error?: string;
  ai?: boolean;
  suffix?: ReactNode;
  prefix?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, ai, suffix, prefix, id, className, ...rest },
  ref,
) {
  const inputId = id ?? rest.name;
  return (
    <label htmlFor={inputId} className="block">
      {label && (
        <div className="mb-1.5 flex items-center gap-1.5">
          <span className="eyebrow">{label}</span>
          {ai && <Badge variant="ai" />}
        </div>
      )}
      <div
        className={cn(
          "flex h-11 items-center gap-2 border-b transition-colors",
          error ? "border-danger" : "border-line focus-within:border-ink",
        )}
      >
        {prefix && <span className="text-ink-3 [&_svg]:size-4">{prefix}</span>}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "h-full flex-1 bg-transparent text-base text-ink",
            "placeholder:text-ink-3 placeholder:font-normal",
            "outline-none",
            className,
          )}
          {...rest}
        />
        {suffix && <span className="text-ink-3 [&_svg]:size-4 shrink-0">{suffix}</span>}
      </div>
      {(hint || error) && (
        <div
          className={cn(
            "mt-1.5 text-xs",
            error ? "text-danger" : "text-ink-3",
          )}
        >
          {error ?? hint}
        </div>
      )}
    </label>
  );
});

/* ───────────── Textarea ───────────── */
export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
  ai?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, ai, id, className, ...rest },
  ref,
) {
  const tid = id ?? rest.name;
  return (
    <label htmlFor={tid} className="block">
      {label && (
        <div className="mb-1.5 flex items-center gap-1.5">
          <span className="eyebrow">{label}</span>
          {ai && <Badge variant="ai" />}
        </div>
      )}
      <textarea
        ref={ref}
        id={tid}
        rows={4}
        className={cn(
          "block w-full resize-none rounded-none border p-3 text-sm text-ink bg-transparent",
          "placeholder:text-ink-3 outline-none transition-colors",
          error ? "border-danger" : "border-line focus:border-ink",
          className,
        )}
        {...rest}
      />
      {(hint || error) && (
        <div className={cn("mt-1.5 text-xs", error ? "text-danger" : "text-ink-3")}>
          {error ?? hint}
        </div>
      )}
    </label>
  );
});
