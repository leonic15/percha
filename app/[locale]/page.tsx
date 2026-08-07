import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/cn";
import { GarmentImage } from "@/components/ui";

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
 *
 * Referencia visual: prototipo original / screens-1.jsx → ScreenWelcome()
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
    <>
    {/*
      ─── CSS crítico incrustado en HTML ────────────────────────────────────────
      React 19 hoists <style href precedence> al <head> durante SSR.
      El contenido CSS queda literalmente en el HTML del servidor — sin archivo
      externo, sin JS, sin dependencia de Turbopack o caché del navegador.
      Esto garantiza que el layout y los estilos visuales estén presentes
      desde el primer byte, incluso en iPhone via LAN con latencia alta.
    */}
    <style href="percha-welcome-v1" precedence="high">{`
      /* ── Reset full-bleed ───────────────────────────────────────── */
      /* body { margin: 8px } es default — sin esto hay bordes blancos.
         html.background cubre TAMBIÉN la zona del notch/status-bar en iOS
         Safari: el elemento <html> se pinta detrás de la barra de estado. */
      *, *::before, *::after { box-sizing: border-box; }
      html {
        margin: 0;
        padding: 0;
        overflow-x: hidden;
        background: #f7f5ef;
      }
      body {
        margin: 0;
        padding: 0;
        overflow-x: hidden;
      }
      a { color: inherit; text-decoration: none; }

      /* ── Show/hide mobile vs desktop ────────────────────────────── */
      /* mobile-first: desktop oculto, mobile visible */
      [data-layout="desktop"] { display: none !important; }
      [data-layout="mobile"]  { display: block; }
      @media (min-width: 48rem) {
        [data-layout="desktop"] { display: grid !important; grid-template-columns: 1fr 1.2fr; min-height: 100dvh; }
        [data-layout="mobile"]  { display: none !important; }
      }

      /* ── Base page ───────────────────────────────────────────────── */
      .lk-page { background: #f7f5ef; overflow: hidden; width: 100%; }

      /* ── Mobile full-screen ──────────────────────────────────────── */
      /* 100svh = "small viewport height": la altura con TODA la UI del
         browser visible (barra de Safari incluida). Es el valor más
         estable en iOS Safari — dvh puede computar como lvh (sin barra)
         en algunas versiones, generando un container más alto que el área
         visible y creando el espacio extra en top/bottom que reporta el user.
         display: flex + flex-direction: column → inner div usa flex:1. */
      .lk-mobile-shell {
        width: 100%;
        height: 100vh;     /* fallback para iOS < 15.4 sin svh support  */
        height: 100svh;    /* iOS Safari estable: incluye la barra siempre */
        display: flex;
        flex-direction: column;
        position: relative;
        overflow: hidden;
        background: #f7f5ef;
      }

      /* ── Tipografía ───────────────────────────────────────────────── */
      .lk-h1 {
        font-family: var(--font-archivo, "Archivo Narrow"), ui-sans-serif, sans-serif;
        text-transform: uppercase;
        color: #1a1a1a;
        font-weight: 600;
        line-height: 0.88;
        letter-spacing: -0.01em;
        margin: 0;
        /* "GUARDARROPA," en San Francisco (fuente iOS de fallback) es ~0.62em
           por carácter — más ancho que Archivo Narrow (~0.40em). A 48px max:
           12 chars × 0.62 × 48 = 357px → entra en los 362px disponibles (h1
           con width:calc(100%+28px)). Con Archivo Narrow: 12×0.40×48=230px ✓ */
        font-size: clamp(36px, 12vw, 48px);
      }
      .lk-accent { color: #6b7563; }
      .lk-eyebrow {
        font-size: 10px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: #8a877f;
        font-weight: 500;
      }
      .lk-body {
        font-family: var(--font-inter, "Inter"), ui-sans-serif, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        color: #4a4a48;
      }
      .lk-wordmark {
        font-family: var(--font-archivo, "Archivo Narrow"), ui-sans-serif, sans-serif;
        font-weight: 700;
        text-transform: uppercase;
        color: #1a1a1a;
        font-size: 24px;
        letter-spacing: 0.08em;
      }

      /* ── Botones ──────────────────────────────────────────────────── */
      .lk-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 54px;
        border-radius: 9999px;
        font-family: var(--font-inter, "Inter"), ui-sans-serif, sans-serif;
        font-weight: 500;
        font-size: 14px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        cursor: pointer;
        transition: transform 120ms ease, opacity 120ms ease, background-color 120ms ease;
        text-decoration: none;
      }
      .lk-btn:active { transform: scale(0.985); }
      .lk-btn-primary   { background: #1a1a1a; color: #f7f5ef; border: none; }
      .lk-btn-secondary {
        background: transparent;
        color: #1a1a1a;
        border: 1px solid rgba(26, 26, 26, 0.10);
      }
      @media (hover: hover) {
        .lk-btn-primary:hover   { opacity: 0.9; }
        .lk-btn-secondary:hover { background: #e5e0d2; }
      }

      /* ── Legal text ───────────────────────────────────────────────── */
      .lk-legal {
        text-align: center;
        font-size: 11px;
        line-height: 1.5;
        color: #8a877f;
      }
      .lk-legal span { text-decoration: underline; text-underline-offset: 2px; }

      /* ── Desktop columna derecha ──────────────────────────────────── */
      .lk-desktop-right {
        position: relative;
        background: #e5e0d2;
        overflow: hidden;
      }
      .lk-desktop-left {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 4rem;
        background: #f7f5ef;
      }
      @media (min-width: 80rem) {
        .lk-desktop-left { padding: 4rem 5rem; }
      }
    `}</style>

    <div className="lk-page bg-bg overflow-hidden">
      {/* ── Mobile: full-screen ────────────────────────────────────────────── */}
      <div data-layout="mobile" className="lk-mobile-shell md:hidden relative overflow-hidden">
        <div
          style={{
            flex: 1,
            position: "relative",   /* GarmentImages se posicionan dentro de este div */
            display: "flex",
            flexDirection: "column",
            /* Con viewport-fit=auto (default) el viewport ya empieza DEBAJO
               del Dynamic Island. 82px era el valor para viewport-fit=cover.
               Con svh+auto: 48px top = espaciado de diseño, 28px bottom = respira. */
            padding: "48px 28px 28px",
            minHeight: 0,           /* evita que flex item no encoja en Safari */
          }}
        >
          {/* Garment decorations — z-0, detrás del texto */}
          <GarmentImage
            color="camel"
            src="/api/img/camisa-caramel.png"
            style={{
              position: "absolute",
              right: -20,
              top: 100,
              width: 240,
              transform: "rotate(6deg)",
              opacity: 0.85,
              zIndex: 0,
            }}
          />
          <GarmentImage
            color="denim"
            src="/api/img/jean-azul.png"
            style={{
              position: "absolute",
              right: 80,
              top: 280,
              width: 165,
              transform: "rotate(-8deg)",
              zIndex: 0,
            }}
          />

          {/* Eyebrow */}
          <p
            className="lk-eyebrow eyebrow"
            style={{ position: "relative", zIndex: 10, marginBottom: 36 }}
          >
            BETA · V0.1
          </p>

          {/* Hero text */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              position: "relative",
              zIndex: 10,
            }}
          >
            <h1
              className="lk-h1 font-display uppercase text-ink"
              style={{
                lineHeight: 0.88,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                margin: 0,
                /* Cancela el padding-right del contenedor padre (28px) para que
                   "GUARDARROPA," tenga ~362px disponibles en lugar de 334px */
                width: "calc(100% + 28px)",
              }}
            >
              Tu<br />
              <span className="lk-accent text-accent">guardarropa,</span>
              <br />
              digital.
            </h1>
            <p
              className="lk-body text-base text-ink-2"
              style={{ marginTop: 22, lineHeight: 1.5, maxWidth: 280 }}
            >
              Digitalizá tu ropa, analizá tus prendas con IA y armá looks
              pensados para hoy.
            </p>
          </div>

          {/* CTAs */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              marginTop: 24,
              position: "relative",
              zIndex: 10,
            }}
          >
            <Link
              href="/registro"
              className={cn("lk-btn lk-btn-primary",
                "flex items-center justify-center w-full rounded-button",
                "font-sans font-medium uppercase bg-ink text-bg",
                "transition-transform duration-[120ms] active:scale-[0.985]",
              )}
            >
              Crear cuenta
            </Link>
            <Link
              href="/login"
              className={cn("lk-btn lk-btn-secondary",
                "flex items-center justify-center w-full rounded-button",
                "font-sans font-medium uppercase text-ink border border-line",
                "bg-transparent",
                "transition-transform duration-[120ms] active:scale-[0.985]",
              )}
            >
              Ya tengo cuenta
            </Link>
            <p
              className="lk-legal text-ink-3"
              style={{ marginTop: 14 }}
            >
              Al continuar aceptás los{" "}
              <span className="underline underline-offset-2">términos</span>
              {" "}y la{" "}
              <span className="underline underline-offset-2">
                política de privacidad
              </span>
              .
            </p>
          </div>
        </div>
      </div>

      {/* ── Desktop: split grid ──────────────────────────────────────────────── */}
      {/* data-layout="desktop" → controlado por el <style> incrustado arriba */}
      <div
        data-layout="desktop"
        className="hidden md:grid md:grid-cols-[1fr_1.2fr] min-h-dvh"
        style={{ gridTemplateColumns: "1fr 1.2fr" }}
      >
        {/* Columna izquierda — contenido */}
        <div className="lk-desktop-left flex flex-col justify-between py-16 px-16 xl:px-20">
          {/* Wordmark */}
          <p className="lk-wordmark font-display font-bold uppercase text-ink">
            Percha<span className="lk-accent text-accent">.</span>
          </p>

          {/* Hero text */}
          <div>
            <p className="lk-eyebrow eyebrow" style={{ marginBottom: 18 }}>
              BETA · V0.1
            </p>
            <h1
              className="lk-h1 font-display uppercase text-ink"
              style={{
                fontSize: "clamp(64px, 7vw, 96px)",
                lineHeight: 0.88,
                fontWeight: 600,
                letterSpacing: "-0.01em",
                margin: "0 0 20px",
              }}
            >
              Tu<br />
              <span className="lk-accent text-accent">guardarropa,</span>
              <br />
              digital.
            </h1>
            <p
              className="lk-body text-base text-ink-2"
              style={{ lineHeight: 1.5, maxWidth: 300 }}
            >
              Digitalizá tu ropa, analizá tus prendas con IA y armá looks
              pensados para hoy.
            </p>
          </div>

          {/* CTAs + legal */}
          <div style={{ maxWidth: 360 }}>
            <Link
              href="/registro"
              className={cn("lk-btn lk-btn-primary",
                "flex items-center justify-center w-full rounded-button",
                "font-sans font-medium uppercase bg-ink text-bg",
                "transition-[transform,opacity] duration-[120ms] hover:opacity-90 active:scale-[0.985]",
              )}
              style={{ marginBottom: 10 }}
            >
              Crear cuenta
            </Link>
            <Link
              href="/login"
              className={cn("lk-btn lk-btn-secondary",
                "flex items-center justify-center w-full rounded-button",
                "font-sans font-medium uppercase text-ink border border-line",
                "bg-transparent",
                "transition-[transform,background-color] duration-[120ms] hover:bg-surface-2 active:scale-[0.985]",
              )}
              style={{ marginBottom: 14 }}
            >
              Ya tengo cuenta
            </Link>
            <p className="lk-legal text-ink-3" style={{ textAlign: "center" }}>
              Al continuar aceptás los{" "}
              <span className="underline underline-offset-2">términos</span>
              {" "}y la{" "}
              <span className="underline underline-offset-2">
                política de privacidad
              </span>
              .
            </p>
          </div>
        </div>

        {/* Columna derecha — mosaico de prendas */}
        <div className="lk-desktop-right relative bg-surface-2 overflow-hidden">
          {/* Textura diagonal sutil */}
          <div
            className="absolute inset-0"
            style={{
              opacity: 0.25,
              backgroundImage:
                "repeating-linear-gradient(45deg, transparent 0 8px, rgb(0 0 0 / 0.03) 8px 16px)",
            }}
          />

          {/* Garment images — mosaico rotado */}
          <GarmentImage
            color="camel"
            label="abrigo camel"
            style={{ position: "absolute", left: "8%",  top: "12%", width: 200, transform: "rotate(4deg)",  zIndex: 10 }}
          />
          <GarmentImage
            color="denim"
            label="blusa denim"
            style={{ position: "absolute", left: "38%", top: "8%",  width: 165, transform: "rotate(-6deg)", zIndex: 10, opacity: 0.8 }}
          />
          <GarmentImage
            color="olive"
            label="falda oliva"
            style={{ position: "absolute", left: "-4%", top: "48%", width: 180, transform: "rotate(-5deg)", zIndex: 10 }}
          />
          <GarmentImage
            color="sand"
            label="pantalón arena"
            style={{ position: "absolute", left: "32%", top: "44%", width: 210, transform: "rotate(7deg)",  zIndex: 10, opacity: 0.85 }}
          />
          <GarmentImage
            color="cream"
            label="camisa cruda"
            style={{ position: "absolute", left: "18%", top: "74%", width: 155, transform: "rotate(-3deg)", zIndex: 10 }}
          />

          {/* Eyebrow overlay */}
          <div
            style={{
              position: "absolute",
              bottom: "2.5rem",
              right: "2.5rem",
              textAlign: "right",
            }}
          >
            <p
              className="text-ink-3"
              style={{
                fontSize: 10,
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                opacity: 0.5,
              }}
            >
              Percha · V0.1
            </p>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

