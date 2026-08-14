import { BottomNav, Sidebar, NavigationProgress } from "@/components/ui";
import {
  CurrentUserProvider,
  type CurrentUser,
} from "@/components/providers/CurrentUserProvider";
import { createClient } from "@/lib/supabase/server";

/**
 * Layout principal de la app (rutas protegidas).
 * Desktop: sidebar fija izquierda + contenido.
 * Mobile: contenido full-width + BottomNav fija abajo.
 *
 * Carga los datos de la cuenta logueada (nombre, email, avatar) y los expone
 * por contexto para que la Sidebar los muestre.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  let currentUser: CurrentUser | null = null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", user.id)
        .single();

      // Fallback a la metadata del provider (Google) si el perfil está vacío.
      const meta = user.user_metadata ?? {};
      currentUser = {
        email: user.email ?? "",
        fullName:
          profile?.full_name ??
          (typeof meta.full_name === "string" ? meta.full_name : null) ??
          (typeof meta.name === "string" ? meta.name : null),
        avatarUrl:
          profile?.avatar_url ??
          (typeof meta.avatar_url === "string" ? meta.avatar_url : null) ??
          (typeof meta.picture === "string" ? meta.picture : null),
      };
    }
  } catch {
    // Error de red/config → la Sidebar simplemente no muestra el bloque de cuenta
  }

  return (
    <CurrentUserProvider user={currentUser}>
      <div className="flex min-h-dvh bg-bg">
        <NavigationProgress />
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
    </CurrentUserProvider>
  );
}
