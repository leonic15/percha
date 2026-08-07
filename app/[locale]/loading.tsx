/**
 * Handoff 01 — Estado de carga de la pantalla de Bienvenida.
 * Se muestra mientras el Server Component chequea la sesión de Supabase.
 * Spec: "Wordmark + spinner pequeño centrados mientras se chequea sesión."
 */
import { LookLoopSpinner } from "@/components/ui";

export default function BienvenidaLoading() {
  return (
    <div className="min-h-dvh bg-bg flex flex-col items-center justify-center gap-5">
      <p className="font-display font-bold text-2xl uppercase tracking-[0.06em] text-ink">
        Percha<span className="text-accent">.</span>
      </p>
      <LookLoopSpinner size={56} />
    </div>
  );
}
