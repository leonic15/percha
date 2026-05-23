"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { Check, X, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/cn";

/* ─────────────────────────────────────────────────────────────────────────
   Toast — sistema mínimo de notificaciones.

   API:
     const { toast } = useToast();
     toast.success("Prenda guardada");
     toast.error("No se pudo conectar");

   Montaje (en app/layout.tsx, dentro del <body>):
     <ToastProvider>{children}</ToastProvider>

   El provider mantiene una cola; cada toast se autodescarta a los 3.5s.
   ───────────────────────────────────────────────────────────────────────── */

type Kind = "success" | "error" | "warning" | "info";
interface ToastItem { id: string; kind: Kind; message: string }

interface ToastApi {
  toast: {
    success: (m: string) => void;
    error:   (m: string) => void;
    warning: (m: string) => void;
    info:    (m: string) => void;
  };
}

const ToastCtx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((kind: Kind, message: string) => {
    const id = Math.random().toString(36).slice(2);
    setItems((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  const api: ToastApi = {
    toast: {
      success: (m) => push("success", m),
      error:   (m) => push("error",   m),
      warning: (m) => push("warning", m),
      info:    (m) => push("info",    m),
    },
  };

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <ToastViewport items={items} onDismiss={(id) => setItems((p) => p.filter((t) => t.id !== id))} />
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast debe usarse dentro de <ToastProvider>");
  return ctx;
}

const kindIcons = {
  success: Check,
  error:   X,
  warning: AlertTriangle,
  info:    Info,
} as const;

const kindStyles: Record<Kind, string> = {
  success: "bg-ink text-bg",
  error:   "bg-danger text-white",
  warning: "bg-warning-500 text-stone-950",
  info:    "bg-ink text-bg",
};

function ToastViewport({
  items, onDismiss,
}: { items: ToastItem[]; onDismiss: (id: string) => void }) {
  return (
    <div
      role="region"
      aria-label="Notificaciones"
      className={cn(
        "fixed z-50 left-4 right-4 md:left-auto md:right-6",
        "bottom-[calc(6rem+env(safe-area-inset-bottom))] md:bottom-6",
        "flex flex-col gap-2 md:max-w-sm pointer-events-none",
      )}
    >
      {items.map((t) => {
        const Icon = kindIcons[t.kind];
        return (
          <output
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-center gap-2.5 px-3.5 py-3 rounded-md shadow-toast",
              "text-sm animate-in slide-in-from-bottom-2 fade-in",
              kindStyles[t.kind],
            )}
          >
            <Icon className="size-4 shrink-0" strokeWidth={1.8} aria-hidden />
            <span className="flex-1">{t.message}</span>
            <button
              type="button"
              aria-label="Cerrar"
              onClick={() => onDismiss(t.id)}
              className="opacity-70 hover:opacity-100"
            >
              <X className="size-3.5" strokeWidth={1.8} />
            </button>
          </output>
        );
      })}
    </div>
  );
}
