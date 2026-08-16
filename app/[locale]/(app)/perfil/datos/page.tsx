import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DatosPersonalesClient } from "@/components/features/settings/DatosPersonalesClient";
import { storageImageUrl } from "@/lib/storage/urls";

export const dynamic = "force-dynamic";

/**
 * PERCHA-033/034 — Datos corporales en perfil
 * Handoff 19 · Datos personales
 * Ruta: /perfil/datos
 */
export default async function DatosPersonalesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: p } = await supabase
    .from("profiles")
    .select("genero, altura_cm, peso_kg, body_photo_url")
    .eq("id", user.id)
    .single();

  // URL estable del proxy autenticado: la foto no se expone públicamente y,
  // a diferencia de una signed URL, no expira con la app abierta.
  const bodyPhotoSignedUrl = storageImageUrl("body-photos", p?.body_photo_url);

  return (
    <DatosPersonalesClient
      genero={p?.genero ?? null}
      alturaCm={p?.altura_cm ?? null}
      pesoKg={p?.peso_kg ?? null}
      bodyPhotoUrl={bodyPhotoSignedUrl}
      bodyPhotoPath={p?.body_photo_url ?? null}
    />
  );
}
