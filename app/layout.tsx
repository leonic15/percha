import type { Metadata, Viewport } from "next";
import { Inter, Archivo_Narrow } from "next/font/google";
import "./globals.css";

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
        {children}
      </body>
    </html>
  );
}
