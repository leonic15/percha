/**
 * Handoff 01 — Estado de carga de la pantalla de Bienvenida.
 * Se muestra mientras el Server Component chequea la sesión de Supabase.
 * Spec: "Wordmark + spinner pequeño centrados mientras se chequea sesión."
 */
export default function BienvenidaLoading() {
  return (
    <div className="min-h-dvh bg-bg flex flex-col items-center justify-center gap-4">
      <p className="font-display font-bold text-2xl uppercase tracking-[0.06em] text-ink">
        LookSi<span className="text-accent">.</span>
      </p>
      <div className="w-4 h-4 border-[1.5px] border-ink/20 border-t-ink rounded-full animate-spin" />
    </div>
  );
}
