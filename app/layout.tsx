import type { Metadata, Viewport } from "next";
import { Inter, Archivo_Narrow } from "next/font/google";
import {
  DARK_THEME_COLOR,
  LIGHT_THEME_COLOR,
  THEME_STORAGE_KEY,
} from "@/lib/theme";
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
    default: "Percha",
    template: "%s · Percha",
  },
  description: "Digitalizá tu ropa, analizá prendas con IA y armá looks pensados para hoy.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Percha",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  // Pintan la barra de estado / chrome del navegador. El bootstrap de tema
  // reescribe el <meta> activo al resolver data-theme, para que el notch no
  // quede claro sobre una app en oscuro.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: LIGHT_THEME_COLOR },
    { media: "(prefers-color-scheme: dark)",  color: DARK_THEME_COLOR },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

/**
 * Bootstrap de tema — corre antes del primer paint (PERCHA-025).
 *
 * `applyTheme()` en ProfileClient solo se ejecuta al montar /perfil, así que
 * fuera de esa pantalla (y tras cualquier recarga) el usuario perdía su tema.
 * Este script bloqueante resuelve la preferencia guardada y fija data-theme en
 * <html> antes de que el navegador pinte, sin flash.
 *
 * Debe quedar en sintaxis ES5 y sin dependencias: se ejecuta antes que el bundle.
 */
const THEME_BOOTSTRAP = String.raw`
(function(){try{
var t=localStorage.getItem("${THEME_STORAGE_KEY}")||"sistema";
var d=t==="oscuro"||(t!=="claro"&&window.matchMedia("(prefers-color-scheme: dark)").matches);
document.documentElement.setAttribute("data-theme",d?"dark":"light");
var m=document.querySelector('meta[name="theme-color"]:not([media])')||document.querySelector('meta[name="theme-color"]');
if(m)m.setAttribute("content",d?"${DARK_THEME_COLOR}":"${LIGHT_THEME_COLOR}");
}catch(e){}})();
`;

/**
 * CSS crítico inline — independiente del bundle JS de Turbopack.
 *
 * En dev con Turbopack, globals.css y critical.css se bundlean como módulos JS
 * y se inyectan en el DOM vía script. En dispositivos físicos por LAN esos
 * chunks a veces no cargan, dejando la página sin estilos. Este bloque se
 * incrusta directamente en el HTML (React 19 hace hoisting a <head> via
 * href + precedence), garantizando estilos base sin depender de ningún script.
 *
 * Colores vía var(--color-*, var(--pc-*)) — ver nota de tema en critical.css.
 * Estas reglas son unlayered y le ganan a las utilidades de Tailwind, así que
 * hardcodear colores claros acá rompía el modo oscuro (PERCHA-025). Los
 * fallbacks --pc-* se definen para light y dark, de modo que el primer paint
 * ya respeta data-theme aunque globals.css todavía no haya cargado.
 */
const CRITICAL_CSS = String.raw`
:root{--pc-bg:#f7f5ef;--pc-ink:#1a1a1a;--pc-ink-2:#4a4a48;--pc-ink-3:#66635b;--pc-accent:#6b7563;--pc-danger:#b85c3a;--pc-surface-2:#e5e0d2;--pc-line:rgba(26,26,26,0.10);color-scheme:light}
[data-theme="dark"]{--pc-bg:#0d0c0a;--pc-ink:#f1ede5;--pc-ink-2:#b8b3a8;--pc-ink-3:#98948a;--pc-accent:#97a386;--pc-danger:#cc7752;--pc-surface-2:#2e2b25;--pc-line:rgba(241,237,229,0.10);color-scheme:dark}
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;padding:0;overflow-x:hidden;background:var(--color-bg,var(--pc-bg));color:var(--color-ink,var(--pc-ink));font-family:var(--font-inter,"Inter"),ui-sans-serif,system-ui,sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
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
.text-ink{color:var(--color-ink,var(--pc-ink))}.text-ink-2{color:var(--color-ink-2,var(--pc-ink-2))}.text-ink-3{color:var(--color-ink-3,var(--pc-ink-3))}
.text-accent{color:var(--color-accent,var(--pc-accent))}.text-bg{color:var(--color-bg,var(--pc-bg))}
.bg-bg{background-color:var(--color-bg,var(--pc-bg))}.bg-ink{background-color:var(--color-ink,var(--pc-ink))}
.bg-surface-2{background-color:var(--color-surface-2,var(--pc-surface-2))}.bg-transparent{background-color:transparent}
.border{border-width:1px;border-style:solid}.border-line{border-color:var(--color-line,var(--pc-line))}
.rounded-button{border-radius:9999px}
.eyebrow{font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:var(--color-ink-3,var(--pc-ink-3));font-weight:500}
`;

/* ─── Root layout ─── */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      data-theme="light"
      className={`${inter.variable} ${archivoNarrow.variable}`}
      suppressHydrationWarning // data-theme lo reescribe el bootstrap (PERCHA-025)
    >
      <body className="bg-bg text-ink antialiased">
        {/* Estilos críticos inline: se inyectan en <head> vía React 19 style hoisting.
            Garantizan fondo, tipografía y layout base sin depender del bundle JS. */}
        <style href="percha-critical" precedence="high">{CRITICAL_CSS}</style>
        {/* Bootstrap de tema: bloqueante y antes de cualquier contenido, para
            que data-theme quede fijado sin flash claro en modo oscuro. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
        {children}
      </body>
    </html>
  );
}
