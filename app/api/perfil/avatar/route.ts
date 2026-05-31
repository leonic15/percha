import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/utils/logger";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/perfil/avatar
 *
 * Recibe una imagen via FormData (`file`), la sube a Supabase Storage
 * (bucket "avatars", path "{user_id}/avatar.{ext}", público) y actualiza
 * `profiles.avatar_url` con la URL pública resultante.
 *
 * Validaciones:
 *   - Autenticación requerida
 *   - Tipo: image/jpeg | image/png | image/webp
 *   - Tamaño: ≤ 5 MB (5_242_880 bytes)
 *
 * La compresión se realiza en el cliente antes de enviar (browser-image-compression).
 *
 * LOOKSI-005 (LSI-15) — EP-01 Autenticación y gestión de cuenta
 */

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES  = ["image/jpeg", "image/png", "image/webp"] as const;
type AllowedType = (typeof ALLOWED_TYPES)[number];

function isAllowedType(t: string): t is AllowedType {
  return (ALLOWED_TYPES as readonly string[]).includes(t);
}

function extFor(type: AllowedType): string {
  if (type === "image/png")  return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_session" }, { status: 401 });

  // ── Leer FormData ─────────────────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 });
  }

  // ── Validar tipo ──────────────────────────────────────────────────────────
  if (!isAllowedType(file.type)) {
    return NextResponse.json(
      { error: "invalid_type", message: "Formatos aceptados: JPG, PNG, WebP" },
      { status: 422 }
    );
  }

  // ── Validar tamaño ────────────────────────────────────────────────────────
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: "file_too_large", message: "El archivo supera el tamaño máximo de 5 MB" },
      { status: 422 }
    );
  }

  // ── Subir a Storage ───────────────────────────────────────────────────────
  const ext   = extFor(file.type);
  const path  = `${user.id}/avatar.${ext}`;
  const bytes = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, bytes, {
      contentType: file.type,
      upsert:      true, // sobrescribir si ya existe
    });

  if (uploadError) {
    logger.error("[perfil/avatar] Upload error", { endpoint: "perfil/avatar" }, uploadError instanceof Error ? uploadError : undefined);
    return NextResponse.json({ error: "upload_error" }, { status: 500 });
  }

  // ── Obtener URL pública ───────────────────────────────────────────────────
  const { data: { publicUrl } } = supabase.storage
    .from("avatars")
    .getPublicUrl(path);

  // Añadir cache-buster para que el browser no sirva la imagen anterior
  const avatarUrl = `${publicUrl}?t=${Date.now()}`;

  // ── Actualizar profiles ───────────────────────────────────────────────────
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (updateError) {
    logger.error("[perfil/avatar] DB update error", { endpoint: "perfil/avatar" }, updateError instanceof Error ? updateError : undefined);
    // La imagen se subió pero no se actualizó el perfil — devolver igual la URL
    return NextResponse.json({ avatarUrl, warning: "db_update_failed" });
  }

  return NextResponse.json({ avatarUrl });
}
