import { BottomNav, Sidebar } from "@/components/ui";

/**
 * Layout principal de la app (rutas protegidas).
 * Desktop: sidebar fija izquierda + contenido.
 * Mobile: contenido full-width + BottomNav fija abajo.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-bg">
      <Sidebar />
      {/*
        pb-[...] reserva espacio para el BottomNav en mobile.
        En md+ el BottomNav está oculto → sin padding.
      */}
      <main className="flex-1 min-w-0 pb-[calc(60px+max(env(safe-area-inset-bottom),16px))] md:pb-0">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
