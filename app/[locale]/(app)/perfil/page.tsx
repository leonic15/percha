import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileClient } from "@/components/features/settings/ProfileClient";

export const dynamic = "force-dynamic";

/**
 * PERCHA-024 / PERCHA-025 (LSI-35 / LSI-36)
 * PERCHA-023 (LSI-34) — configuración de ciudad del clima
 * Handoff 16 · Configuración · perfil
 * Ruta: /perfil
 *
 * Server Component:
 *  - Verifica sesión
 *  - Obtiene perfil + stats (prendas + looks)
 *  - Pasa datos al ProfileClient para renderizado interactivo
 */
export default async function PerfilPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profileRes, prendasRes, looksRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("prendas")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("deleted_at", null),
    supabase
      .from("looks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
  ]);

  const p = profileRes.data;

  return (
    <div className="md:max-w-[680px] md:mx-auto md:w-full">
      <ProfileClient
        email={user.email ?? ""}
        fullName={p?.full_name ?? null}
        avatarUrl={p?.avatar_url ?? null}
        idioma={p?.idioma ?? "es"}
        tema={p?.tema ?? "sistema"}
        climaHabilitado={p?.clima_habilitado ?? true}
        ciudadNombre={p?.ciudad_nombre ?? null}
        ciudadPais={p?.ciudad_pais ?? null}
        estilosFavoritos={p?.estilos_favoritos ?? []}
        ocasionesFrecuentes={p?.ocasiones_frecuentes ?? []}
        genero={p?.genero ?? null}
        alturaCm={p?.altura_cm ?? null}
        pesoKg={p?.peso_kg ?? null}
        prendasCount={prendasRes.count ?? 0}
        looksCount={looksRes.count ?? 0}
      />
    </div>
  );
}
