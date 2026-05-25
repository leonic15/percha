import type { Metadata, Viewport } from "next";
import { Inter, Archivo_Narrow } from "next/font/google";
import "./globals.css";
// critical.css: CSS puro sin @import tailwindcss → Turbopack lo extrae como
// <link rel="stylesheet"> estático, no bundleado en JS. Garantiza que el layout
// y los estilos clave estén disponibles sin esperar ningún script.
import "./critical.css";

/* ─── Fuentes (self-hosted por Next.js, optimizadas) ─── */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const archivoNarrow = Archivo_Narrow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-archivo",
  display: "swap",
});

/* ─── Metadata ─── */
export const metadata: Metadata = {
  title: {
    default: "LookSi",
    template: "%s · LookSi",
  },
  description: "Digitalizá tu ropa, analizá prendas con IA y armá looks pensados para hoy.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "LookSi",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#6b7563",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

/**
 * CSS crítico inline — independiente del bundle JS de Turbopack.
 *
 * En dev con Turbopack, globals.css y critical.css se bundlean como módulos JS
 * y se inyectan en el DOM vía script. En dispositivos físicos por LAN esos
 * chunks a veces no cargan, dejando la página sin estilos. Este bloque se
 * incrusta directamente en el HTML (React 19 hace hoisting a <head> via
 * href + precedence), garantizando estilos base sin depender de ningún script.
 *
 * Valores hardcodeados (no var()) para ser independiente del orden de carga.
 */
const CRITICAL_CSS = String.raw`
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;padding:0;overflow-x:hidden;background:#f7f5ef;color:#1a1a1a;font-family:var(--font-inter,"Inter"),ui-sans-serif,system-ui,sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
a{color:inherit;text-decoration:none}
/* Preflight: dentro de @layer base para NO ganar sobre @layer utilities de Tailwind.
   Sin el @layer, estas reglas unlayered sobreescriben cualquier utilidad (px-*, pl-*, etc.)
   porque el CSS unlayered tiene prioridad absoluta sobre cualquier capa nombrada. */
@layer base{button,input,optgroup,select,textarea{font-family:inherit;font-size:100%;font-weight:inherit;line-height:inherit;color:inherit;margin:0;padding:0}button,select{text-transform:none}input,button{border:0;background:transparent;-webkit-appearance:none;appearance:none}}
.antialiased{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
.hidden{display:none}
@media(min-width:48rem){.md\:grid{display:grid}.md\:hidden{display:none}.md\:flex{display:flex}}
.relative{position:relative}.absolute{position:absolute}.overflow-hidden{overflow:hidden}
.min-h-dvh{min-height:100dvh}.w-full{width:100%}.inset-0{inset:0}
.flex{display:flex}.flex-col{flex-direction:column}
.items-center{align-items:center}.justify-center{justify-content:center}.justify-between{justify-content:space-between}
.font-display{font-family:var(--font-archivo,"Archivo Narrow"),ui-sans-serif,sans-serif}
.font-sans{font-family:var(--font-inter,"Inter"),ui-sans-serif,sans-serif}
.font-medium{font-weight:500}.font-bold{font-weight:700}
.uppercase{text-transform:uppercase}.lowercase{text-transform:lowercase}
.text-base{font-size:14px;line-height:1.5}.text-sm{font-size:12px;line-height:1.45}
.underline{text-decoration-line:underline}.underline-offset-2{text-underline-offset:2px}
.text-ink{color:#1a1a1a}.text-ink-2{color:#4a4a48}.text-ink-3{color:#8a877f}
.text-accent{color:#6b7563}.text-bg{color:#f7f5ef}
.bg-bg{background-color:#f7f5ef}.bg-ink{background-color:#1a1a1a}
.bg-surface-2{background-color:#e5e0d2}.bg-transparent{background-color:transparent}
.border{border-width:1px;border-style:solid}.border-line{border-color:rgba(26,26,26,0.10)}
.rounded-button{border-radius:9999px}
.eyebrow{font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#8a877f;font-weight:500}
`;

/* ─── Root layout ─── */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      data-theme="light"
      className={`${inter.variable} ${archivoNarrow.variable}`}
      suppressHydrationWarning // data-theme se actualiza en cliente (LOOKSI-025)
    >
      <body className="bg-bg text-ink antialiased">
        {/* Estilos críticos inline: se inyectan en <head> vía React 19 style hoisting.
            Garantizan fondo, tipografía y layout base sin depender del bundle JS. */}
        <style href="looksi-critical" precedence="high">{CRITICAL_CSS}</style>
        {children}
      </body>
    </html>
  );
}
