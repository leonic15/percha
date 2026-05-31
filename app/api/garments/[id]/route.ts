import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Prenda, PrendaUpdate } from "@/lib/database.types";
import { captureServerEvent } from "@/lib/posthog/server";
import { GARMENT_IMAGE_MAX_BYTES, detectImageMimeType } from "@/lib/upload/validation";
import { logger } from "@/lib/utils/logger";

type RouteContext = { params: Promise<{ id: string }> };

// ── GET — Detalle de una prenda ──────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: RouteContext,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_session" }, { status: 401 });

  const { id } = await params;

  // Prenda + categoría en un solo query
  const { data: row, error } = await supabase
    .from("prendas")
    .select("*, category:categories(nombre, slug)")
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();

  if (error || !row) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const prenda = row as Prenda & {
    category: { nombre: string; slug: string } | null;
  };

  // Signed URL para la imagen
  let signedUrl: string | null = null;
  if (prenda.imagen_url) {
    const { data: signed } = await supabase.storage
      .from("prendas")
      .createSignedUrl(prenda.imagen_url, 3600);
    signedUrl = signed?.signedUrl ?? null;
  }

  return NextResponse.json({ garment: { ...prenda, signedUrl } });
}

// ── DELETE — Soft-delete de una prenda ───────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: RouteContext,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_session" }, { status: 401 });

  const { id } = await params;

  // Verificar propiedad antes de borrar
  const { data: prendaData, error: fetchError } = await supabase
    .from("prendas")
    .select("id, user_id")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (fetchError || !prendaData) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const prenda = prendaData as { id: string; user_id: string };
  if (prenda.user_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { error: deleteError } = await supabase
    .from("prendas")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (deleteError) {
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  // ── PostHog: prenda eliminada ─────────────────────────────────────────────
  await captureServerEvent(user.id, "prenda_eliminada");

  return NextResponse.json({ ok: true });
}

// ── PATCH — Editar prenda (LOOKSI-011 · LSI-21) ──────────────────────────────
//
// Acepta FormData con:
//   nombre, category_slug, color_principal, estaciones, estilos, ocasiones, notas (opcionales)
//   imagen (File, opcional) → sube nueva imagen a Storage y elimina la anterior
//
// Solo actualiza los campos que se envíen.

export async function PATCH(
  req: NextRequest,
  { params }: RouteContext,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_session" }, { status: 401 });

  const { id } = await params;

  // ── Verificar propiedad ─────────────────────────────────────────────────────
  const { data: existing, error: fetchErr } = await supabase
    .from("prendas")
    .select("id, user_id, imagen_url")
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const row = existing as { id: string; user_id: string; imagen_url: string | null };

  // ── Parsear FormData ────────────────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const update: PrendaUpdate = {};

  const nombre = (formData.get("nombre") as string | null)?.trim();
  if (nombre !== null && nombre !== undefined) {
    if (!nombre) return NextResponse.json({ error: "nombre_requerido" }, { status: 400 });
    update.nombre = nombre;
  }

  const colorPrincipal = (formData.get("color_principal") as string | null)?.trim();
  if (colorPrincipal !== null && colorPrincipal !== undefined) {
    update.color_principal = colorPrincipal || null;
  }

  const notasRaw = (formData.get("notas") as string | null)?.trim();
  if (notasRaw !== null && notasRaw !== undefined) {
    update.notas = notasRaw || null;
  }

  const estacionesRaw = formData.get("estaciones") as string | null;
  if (estacionesRaw !== null) {
    try { update.estaciones = JSON.parse(estacionesRaw); } catch {}
  }

  const ocasionesRaw = formData.get("ocasiones") as string | null;
  if (ocasionesRaw !== null) {
    try { update.ocasiones = JSON.parse(ocasionesRaw); } catch {}
  }

  const estilosRaw = formData.get("estilos") as string | null;
  if (estilosRaw !== null) {
    try { update.estilos = JSON.parse(estilosRaw); } catch {}
  }

  // ── Resolver category_slug → category_id ───────────────────────────────────
  const categorySlug = (formData.get("category_slug") as string | null)?.trim();
  if (categorySlug) {
    const { data: catRow } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", categorySlug)
      .single();
    const catId = (catRow as { id: number } | null)?.id ?? null;
    if (catId) update.category_id = catId;
  }

  // ── Reemplazar imagen (opcional) ────────────────────────────────────────────
  const imagen = formData.get("imagen") as File | null;
  if (imagen && imagen.size > 0) {
    if (imagen.size > GARMENT_IMAGE_MAX_BYTES) {
      return NextResponse.json(
        { error: "imagen_demasiado_grande", message: "La imagen no puede superar 5 MB." },
        { status: 422 },
      );
    }

    // H-17: detectar tipo real por magic bytes
    const normalizedType = await detectImageMimeType(imagen);
    if (!normalizedType) {
      return NextResponse.json({ error: "tipo_imagen_invalido" }, { status: 400 });
    }

    const ext = normalizedType === "image/png" ? "png"
      : normalizedType === "image/webp" ? "webp" : "jpg";
    const newPath = `${user.id}/${id}.${ext}`;

    const bytes = await imagen.arrayBuffer();
    const { error: uploadErr } = await supabase.storage
      .from("prendas")
      .upload(newPath, bytes, {
        contentType: normalizedType,
        upsert:      true,   // sobreescribe si ya existe el mismo path
      });

    if (uploadErr) {
      logger.error("[garments/PATCH] upload error", { endpoint: "garments/PATCH" }, uploadErr instanceof Error ? uploadErr : undefined);
      return NextResponse.json({ error: "upload_error" }, { status: 502 });
    }

    // Si cambia el path (distinta extensión), eliminar la imagen anterior
    if (row.imagen_url && row.imagen_url !== newPath) {
      await supabase.storage.from("prendas").remove([row.imagen_url]);
    }

    update.imagen_url = newPath;
  }

  // ── Nada que actualizar ─────────────────────────────────────────────────────
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: true, changed: false });
  }

  const { error: updateErr } = await supabase
    .from("prendas")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id);

  if (updateErr) {
    logger.error("[garments/PATCH] db error", { endpoint: "garments/PATCH" }, updateErr instanceof Error ? updateErr : undefined);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  // ── PostHog: prenda editada ───────────────────────────────────────────────
  await captureServerEvent(user.id, "prenda_editada", {
    campos_editados: Object.keys(update),
    con_nueva_imagen: !!update.imagen_url,
  });

  return NextResponse.json({ ok: true, changed: true });
}
