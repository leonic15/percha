import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Prenda } from "@/lib/database.types";

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

  return NextResponse.json({ ok: true });
}
