import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/cn";

/**
 * Handoff 01 — Bienvenida
 * Ruta: /
 *
 * Server Component: chequea sesión. Si el usuario ya tiene sesión activa,
 * redirige directamente a /guardarropas. De lo contrario renderiza la pantalla
 * de bienvenida con CTAs hacia /registro y /login.
 *
 * Spec (Handoff.html #screen-welcome):
 * - Mobile: eyebrow + H1 display 72px 3 líneas + 2 GarmentImages rotados + CTAs abajo
 * - Desktop: split grid-cols-[1fr_1.2fr] con mosaico de prendas en la derecha
 * - Sin scroll: cabe completo en viewport
 */
export default async function BienvenidaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/guardarropas");
  }

  return (
    <div className="min-h-dvh bg-bg overflow-hidden">
      {/* ── Mobile: full-screen stack ──────────────────────────────────────── */}
      <div className="md:hidden relative min-h-dvh flex flex-col">

        {/* Decoraciones absolutas (z-0) — dos garment cards rotados */}
        <GarmentDecoration
          className="absolute right-[-14px] top-[195px] w-[148px] rotate-[6deg] z-0"
        />
        <GarmentDecoration
          className="absolute right-[62px] top-[345px] w-[116px] rotate-[-8deg] z-0"
          dimmed
        />

        {/* Eyebrow — top */}
        <div className="relative z-10 pt-[82px] px-[28px]">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-3">
            BETA · v0.4 · BUENOS AIRES
          </p>
        </div>

        {/* Hero text — middle (flexible) */}
        <div className="relative z-10 flex-1 flex flex-col justify-center px-[28px] pt-8">
          <h1
            className="font-display font-bold uppercase leading-[0.88] tracking-[-0.01em] text-ink"
            style={{ fontSize: "72px" }}
          >
            TU<br />
            <span className="text-accent">GUARDARROPA,</span><br />
            DIGITAL.
          </h1>
          <p className="mt-5 text-sm leading-relaxed text-ink-2 max-w-[280px]">
            Digitalizá tu ropa, analizá prendas con IA y armá looks pensados para cada ocasión.
          </p>
        </div>

        {/* CTAs — bottom */}
        <div className="relative z-10 px-[28px] pb-10 space-y-3">
          <Link
            href="/registro"
            className={cn(
              "flex items-center justify-center w-full h-13 rounded-button",
              "font-sans font-medium uppercase tracking-wide text-base",
              "bg-ink text-bg",
              "transition-transform duration-[120ms] active:scale-[0.985]",
            )}
          >
            Empezar gratis
          </Link>
          <Link
            href="/login"
            className={cn(
              "flex items-center justify-center w-full h-13 rounded-button",
              "font-sans font-medium uppercase tracking-wide text-base",
              "bg-transparent text-ink border border-line",
              "transition-transform duration-[120ms] active:scale-[0.985]",
            )}
          >
            Ya tengo una cuenta
          </Link>
          <p className="text-center text-[11px] leading-relaxed text-ink-3 pt-1">
            Al continuar aceptás los{" "}
            <span className="underline underline-offset-2 cursor-pointer">Términos de servicio</span>
            {" "}y la{" "}
            <span className="underline underline-offset-2 cursor-pointer">Política de privacidad</span>.
          </p>
        </div>
      </div>

      {/* ── Desktop: split grid ──────────────────────────────────────────────── */}
      <div className="hidden md:grid md:grid-cols-[1fr_1.2fr] min-h-dvh">

        {/* Columna izquierda — contenido */}
        <div className="flex flex-col justify-between py-16 px-16 xl:px-20">
          {/* Wordmark */}
          <p className="font-display font-bold text-2xl uppercase tracking-[0.06em] text-ink">
            LookSi<span className="text-accent">.</span>
          </p>

          {/* Hero text */}
          <div className="space-y-6">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-3">
              BETA · v0.4 · BUENOS AIRES
            </p>
            <h1
              className="font-display font-bold uppercase leading-[0.88] tracking-[-0.01em] text-ink"
              style={{ fontSize: "clamp(64px, 7vw, 96px)" }}
            >
              TU<br />
              <span className="text-accent">GUARDARROPA,</span><br />
              DIGITAL.
            </h1>
            <p className="text-sm leading-relaxed text-ink-2 max-w-[300px]">
              Digitalizá tu ropa, analizá prendas con IA y armá looks pensados para cada ocasión.
            </p>
          </div>

          {/* CTAs + legal */}
          <div className="space-y-3 max-w-[360px]">
            <Link
              href="/registro"
              className={cn(
                "flex items-center justify-center w-full h-13 rounded-button",
                "font-sans font-medium uppercase tracking-wide text-base",
                "bg-ink text-bg",
                "transition-transform duration-[120ms] hover:bg-ink-2 active:scale-[0.985]",
              )}
            >
              Empezar gratis
            </Link>
            <Link
              href="/login"
              className={cn(
                "flex items-center justify-center w-full h-13 rounded-button",
                "font-sans font-medium uppercase tracking-wide text-base",
                "bg-transparent text-ink border border-line",
                "transition-[transform,background-color] duration-[120ms]",
                "hover:bg-surface-2 active:scale-[0.985]",
              )}
            >
              Ya tengo una cuenta
            </Link>
            <p className="text-center text-[11px] leading-relaxed text-ink-3 pt-1">
              Al continuar aceptás los{" "}
              <span className="underline underline-offset-2 cursor-pointer">Términos</span>
              {" "}y la{" "}
              <span className="underline underline-offset-2 cursor-pointer">Política de privacidad</span>.
            </p>
          </div>
        </div>

        {/* Columna derecha — mosaico de decoraciones */}
        <div className="relative bg-surface-2 overflow-hidden">
          {/* Patrón de fondo sutil */}
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, transparent 0 8px, rgb(0 0 0 / 0.03) 8px 16px)",
            }}
          />

          {/* Garment decorations — mosaico rotado */}
          <GarmentDecoration className="absolute left-[8%] top-[12%] w-[200px] rotate-[4deg] z-10" />
          <GarmentDecoration className="absolute left-[38%] top-[8%] w-[165px] rotate-[-6deg] z-10" dimmed />
          <GarmentDecoration className="absolute left-[-4%] top-[48%] w-[180px] rotate-[-5deg] z-10" />
          <GarmentDecoration className="absolute left-[32%] top-[44%] w-[210px] rotate-[7deg] z-10" dimmed />
          <GarmentDecoration className="absolute left-[18%] top-[74%] w-[155px] rotate-[-3deg] z-10" />

          {/* Eyebrow overlay */}
          <div className="absolute bottom-10 right-10 text-right">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-3/50">
              LookSi · v0.4
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Componente de decoración (garment card placeholder) ───────────────────────

function GarmentDecoration({
  className,
  dimmed = false,
}: {
  className?: string;
  dimmed?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-card shadow-card overflow-hidden",
        dimmed ? "opacity-55" : "opacity-90",
        className,
      )}
      aria-hidden
    >
      {/* Imagen placeholder — patrón rayado como en el Handoff */}
      <div
        className="aspect-[4/5] bg-surface-2"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, var(--color-stone-200) 0 6px, var(--color-stone-300) 6px 12px)",
        }}
      />
      {/* Metadata bar */}
      <div className="bg-surface px-2.5 pt-2 pb-2.5 space-y-1">
        <div className="h-2.5 w-3/4 bg-surface-2 rounded-sm" />
        <div className="h-2 w-1/3 bg-surface-2 rounded-sm opacity-60" />
      </div>
    </div>
  );
}
