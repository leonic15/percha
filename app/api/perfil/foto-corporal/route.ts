import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "body-photos";
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * POST /api/perfil/foto-corporal
 *
 * Recibe FormData con campo "file" (imagen ya comprimida en cliente).
 * Sube a Storage bucket `body-photos` en path `{user_id}/body.{ext}`.
 * Actualiza `profiles.body_photo_url` con el path.
 * Devuelve: { ok: true, path: string }
 *
 * DELETE /api/perfil/foto-corporal
 *
 * Elimina el archivo del bucket y pone body_photo_url = null en el perfil.
 *
 * LOOKSI-034
 */

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_session" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "invalid_type", message: "Solo se aceptan imágenes JPG, PNG o WebP." },
      { status: 422 },
    );
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: "too_large", message: "La imagen no puede superar 10 MB." },
      { status: 422 },
    );
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const storagePath = `${user.id}/body.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    console.error("[foto-corporal] upload error:", uploadError.message);
    return NextResponse.json({ error: "upload_failed" }, { status: 500 });
  }

  const { error: dbError } = await supabase
    .from("profiles")
    .update({ body_photo_url: storagePath, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (dbError) {
    console.error("[foto-corporal] db update error:", dbError.message);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, path: storagePath });
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_session" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("body_photo_url")
    .eq("id", user.id)
    .single();

  if (profile?.body_photo_url) {
    const { error: removeError } = await supabase.storage
      .from(BUCKET)
      .remove([profile.body_photo_url]);
    if (removeError) {
      console.warn("[foto-corporal] storage remove error:", removeError.message);
    }
  }

  const { error: dbError } = await supabase
    .from("profiles")
    .update({ body_photo_url: null, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (dbError) {
    console.error("[foto-corporal] db null error:", dbError.message);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
