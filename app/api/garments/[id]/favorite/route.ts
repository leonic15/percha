import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/garments/[id]/favorite — Toggle favorito de una prenda.
 * Actualización optimista en el cliente; este endpoint persiste el cambio.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_session" }, { status: 401 });

  const { id } = await params;

  // Leer estado actual
  const { data: prendaData, error: fetchError } = await supabase
    .from("prendas")
    .select("id, is_favorite, user_id")
    .eq("id", id)
    .single();

  if (fetchError || !prendaData) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const prenda = prendaData as { id: string; is_favorite: boolean; user_id: string };

  if (prenda.user_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data: updatedData, error: updateError } = await supabase
    .from("prendas")
    .update({ is_favorite: !prenda.is_favorite })
    .eq("id", id)
    .select("id, is_favorite")
    .single();

  if (updateError || !updatedData) {
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  const updated = updatedData as { id: string; is_favorite: boolean };

  return NextResponse.json({ is_favorite: updated.is_favorite });
}
