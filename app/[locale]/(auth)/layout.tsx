/**
 * Layout compartido para las páginas de autenticación.
 * Centra el contenido vertical y horizontalmente, fondo bg-bg.
 * Las páginas bajo este layout: /login, /registro, /recuperar-password.
 *
 * AUTH_CSS: cubre todas las clases Tailwind usadas en estas páginas y sus
 * componentes (Input, Button primary/lg, GoogleSignInButton). Se inyecta
 * inline vía React 19 style hoisting → disponible sin bundle JS de Turbopack.
 */

/**
 * CSS de auth inline — cubre todas las clases Tailwind de las páginas de auth
 * y sus componentes (Input, Button, GoogleSignInButton).
 * Valores hardcodeados (no var()) para no depender del orden de carga de CSS.
 * NOTA: las clases ya cubiertas por CRITICAL_CSS en layout.tsx se omiten aquí.
 */
const AUTH_CSS = String.raw`
/* ── Layout auth ── */
.px-4{padding-left:1rem;padding-right:1rem}
.py-12{padding-top:3rem;padding-bottom:3rem}
.max-w-sm{max-width:24rem}

/* ── Full-height mobile (handoff layout) ── */
.flex-col{flex-direction:column}
.min-h-dvh{min-height:100dvh}
.pt-\[70px\]{padding-top:70px}
.pb-\[30px\]{padding-bottom:30px}
.px-6{padding-left:1.5rem;padding-right:1.5rem}

/* ── Spacing ── */
.space-y-8>*+*{margin-top:2rem}
.space-y-6>*+*{margin-top:1.5rem}
.space-y-4>*+*{margin-top:1rem}
.space-y-1>*+*{margin-top:0.25rem}
.gap-1\.5{gap:0.375rem}
.gap-2{gap:0.5rem}
.gap-3{gap:0.75rem}
.gap-6{gap:1.5rem}
.mb-1\.5{margin-bottom:0.375rem}
.mb-7{margin-bottom:1.75rem}
.mb-9{margin-bottom:2.25rem}
.mb-12{margin-bottom:3rem}
.mt-1{margin-top:0.25rem}
.mt-1\.5{margin-top:0.375rem}
.mt-2{margin-top:0.5rem}
.mt-5{margin-top:1.25rem}
.mt-auto{margin-top:auto}
.w-\[22px\]{width:22px}

/* ── Display ── */
.block{display:block}
.inline-flex{display:inline-flex}
.flex-1{flex:1 1 0%}
.shrink-0{flex-shrink:0}

/* ── Tipografía ── */
.text-center{text-align:center}
.text-right{text-align:right}
.text-2xl{font-size:24px;line-height:1.15}
.text-xl{font-size:20px;line-height:1.3}
.text-xs{font-size:11px;line-height:1.45}
.font-medium{font-weight:500}
.font-semibold{font-weight:600}
.tracking-tight{letter-spacing:-0.025em}
.tracking-wide{letter-spacing:0.025em}
.leading-relaxed{line-height:1.625}
.underline{text-decoration-line:underline}
.underline-offset-\[3px\]{text-underline-offset:3px}
.uppercase{text-transform:uppercase}

/* ── Colores ── */
.text-ink{color:#1a1a1a}
.text-ink-2{color:#4a4a48}
.text-ink-3{color:#8a877f}
.text-ink\/70{color:rgba(26,26,26,0.7)}
.text-ink\/60{color:rgba(26,26,26,0.6)}
.text-ink\/50{color:rgba(26,26,26,0.5)}
.text-ink\/40{color:rgba(26,26,26,0.4)}
.text-danger{color:#b85c3a}
.border-danger{border-color:#b85c3a}
.border-stone-200{border-color:#e5e0d2}
.border-stone-300{border-color:#d2cbb8}
.border-t-ink{border-top-color:#1a1a1a}

/* ── Tamaños (input, botones) ── */
.h-9{height:2.25rem}
.h-11{height:2.75rem}
.h-13{height:52px}
.h-full{height:100%}
.h-5{height:1.25rem}
.w-5{width:1.25rem}

/* ── Padding botones ── */
.px-5{padding-left:1.25rem;padding-right:1.25rem}
.px-6{padding-left:1.5rem;padding-right:1.5rem}
.py-2\.5{padding-top:0.625rem;padding-bottom:0.625rem}

/* ── Bordes ── */
.border-b{border-bottom-width:1px;border-bottom-style:solid}
.border-t{border-top-width:1px;border-top-style:solid}
.border-2{border-width:2px;border-style:solid}
.rounded-full{border-radius:9999px}

/* ── Transiciones ── */
.transition-colors{transition-property:color,background-color,border-color;transition-timing-function:cubic-bezier(0.4,0,0.2,1);transition-duration:150ms}
.duration-150{transition-duration:150ms}

/* ── Formulario / Input ── */
.outline-none{outline:2px solid transparent;outline-offset:2px}
.focus-within\:border-ink:focus-within{border-color:#1a1a1a}
.placeholder\:text-ink-3::placeholder{color:#8a877f}
.placeholder\:font-normal::placeholder{font-weight:400}

/* ── Estados de botón ── */
.active\:scale-\[0\.985\]:active{transform:scale(0.985)}
.disabled\:opacity-40:disabled{opacity:0.4}
.disabled\:opacity-60:disabled{opacity:0.6}
.disabled\:pointer-events-none:disabled{pointer-events:none}
.disabled\:cursor-not-allowed:disabled{cursor:not-allowed}

/* ── Hover / active ── */
.hover\:underline:hover{text-decoration-line:underline}
.hover\:bg-stone-50:hover{background-color:#f7f5ef}
.hover\:bg-ink-2:hover{background-color:#4a4a48}
.hover\:text-accent:hover{color:#6b7563}
.active\:bg-stone-100:active{background-color:#f1ede4}

/* ── Animación spinner ── */
@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
.animate-spin{animation:spin 1s linear infinite}

/* ── Focus visible (accesibilidad) ── */
.focus-visible\:outline-none:focus-visible{outline:none}
.focus-visible\:ring-2:focus-visible{box-shadow:0 0 0 2px #6b7563}
`;

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Estilos específicos de auth: cubre todas las clases Tailwind
          de Input, Button y GoogleSignInButton usadas en estas páginas. */}
      <style href="percha-auth" precedence="default">{AUTH_CSS}</style>

      {/*
        Mobile: flex-col full-height → cada página rellena con flex-1 + padding propio.
        Desktop (md+): centra el card horizontalmente con max-w-sm.
      */}
      <div className="min-h-dvh flex flex-col bg-bg md:items-center md:justify-center md:py-12">
        <div className="flex-1 flex flex-col w-full md:flex-none md:w-full md:max-w-sm md:px-4">
          {children}
        </div>
      </div>
    </>
  );
}
