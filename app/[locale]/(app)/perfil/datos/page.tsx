import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DatosPersonalesClient } from "@/components/features/settings/DatosPersonalesClient";

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

  // Generar signed URL (1h) para mostrar la foto en el cliente sin exponerla públicamente
  let bodyPhotoSignedUrl: string | null = null;
  if (p?.body_photo_url) {
    const { data: signed } = await supabase.storage
      .from("body-photos")
      .createSignedUrl(p.body_photo_url, 3600);
    bodyPhotoSignedUrl = signed?.signedUrl ?? null;
  }

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
