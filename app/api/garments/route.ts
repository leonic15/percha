import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Prenda } from "@/lib/database.types";

/**
 * LOOKSI-008 / LOOKSI-009: API Routes de prendas.
 *
 * GET  /api/garments — Listado paginado con filtros (usado para infinite scroll)
 * POST /api/garments — Crear prenda (sube imagen a Storage, luego guarda en DB)
 */

// ── GET — Listado paginado con filtros ───────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_session" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const q        = searchParams.get("q")        ?? "";
  const catSlug  = searchParams.get("category") ?? "";
  const season   = searchParams.get("season")   ?? "";
  const occasion = searchParams.get("occasion") ?? "";
  const favs     = searchParams.get("favorites") === "1";
  const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));

  // Resolver slug → id si se pasa filtro de categoría
  let categoryId: number | null = null;
  if (catSlug) {
    const { data: cat } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", catSlug)
      .single();
    categoryId = (cat as { id: number } | null)?.id ?? null;
  }

  let query = supabase
    .from("prendas")
    .select("*", { count: "exact" })
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (q)          query = query.or(`nombre.ilike.%${q}%,color_principal.ilike.%${q}%,notas.ilike.%${q}%`);
  if (categoryId) query = query.eq("category_id", categoryId);
  if (season)     query = query.contains("estaciones", [season]);
  if (occasion)   query = query.contains("ocasiones", [occasion]);
  if (favs)       query = query.eq("is_favorite", true);

  const { data: garmentsData, count, error } = await query;
  if (error) return NextResponse.json({ error: "db_error" }, { status: 500 });

  const garments = (garmentsData ?? []) as Prenda[];

  // Signed URLs en batch
  const paths = garments
    .map((g) => g.imagen_url)
    .filter((url): url is string => Boolean(url));

  const signedUrlMap: Record<string, string> = {};
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage
      .from("prendas")
      .createSignedUrls(paths, 3600);
    if (signed) {
      for (const s of signed) {
        if (s.path && s.signedUrl) signedUrlMap[s.path] = s.signedUrl;
      }
    }
  }

  const garmentsWithUrls = garments.map((g) => ({
    ...g,
    signedUrl: g.imagen_url ? (signedUrlMap[g.imagen_url] ?? null) : null,
  }));

  return NextResponse.json({
    garments: garmentsWithUrls,
    total: count ?? 0,
    page,
    hasMore: page * limit < (count ?? 0),
  });
}

// ── POST — Crear prenda ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_session" }, { status: 401 });

  // Recibir FormData (incluye el archivo de imagen)
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const nombre         = (formData.get("nombre") as string | null)?.trim() ?? "";
  const category_id    = formData.get("category_id") ? Number(formData.get("category_id")) : null;
  const subcategory_id = formData.get("subcategory_id") ? Number(formData.get("subcategory_id")) : null;
  const color_principal = (formData.get("color_principal") as string | null)?.trim() || null;
  const estadoRaw      = (formData.get("estado") as string | null) || null;
  const estado         = (estadoRaw as "nueva" | "buena" | "desgastada" | null);
  const notas          = (formData.get("notas") as string | null)?.trim() || null;
  const imagen         = formData.get("imagen") as File | null;

  // Arrays serialized as JSON strings
  const estaciones: string[] = parseJsonArray(formData.get("estaciones") as string | null);
  const estilos:    string[] = parseJsonArray(formData.get("estilos")    as string | null);
  const ocasiones:  string[] = parseJsonArray(formData.get("ocasiones")  as string | null);

  // Validaciones
  if (!nombre)     return NextResponse.json({ error: "nombre_requerido" }, { status: 400 });
  if (!category_id) return NextResponse.json({ error: "categoria_requerida" }, { status: 400 });
  if (!imagen || imagen.size === 0) return NextResponse.json({ error: "imagen_requerida" }, { status: 400 });

  const allowed = ["image/jpeg", "image/png", "image/webp", "image/avif"];
  if (!allowed.includes(imagen.type)) {
    return NextResponse.json({ error: "tipo_imagen_invalido" }, { status: 400 });
  }

  // 1. Insertar prenda en DB (sin imagen_url todavía)
  const { data: prendaData, error: insertError } = await supabase
    .from("prendas")
    .insert({
      user_id: user.id,
      nombre,
      category_id,
      subcategory_id: subcategory_id ?? undefined,
      color_principal,
      estaciones,
      estilos,
      ocasiones,
      estado,
      notas,
    })
    .select("*")
    .single();

  if (insertError || !prendaData) {
    return NextResponse.json({ error: "db_insert_error" }, { status: 500 });
  }

  const prenda = prendaData as Prenda;

  // 2. Subir imagen a Storage: prendas/{user_id}/{prenda_id}.{ext}
  const ext  = imagen.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${user.id}/${prenda.id}.${ext}`;
  const bytes = await imagen.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from("prendas")
    .upload(path, bytes, {
      contentType: imagen.type,
      upsert: false,
    });

  if (uploadError) {
    // La prenda quedó sin imagen — devolver prenda parcial con el error para reintentar
    return NextResponse.json(
      { error: "upload_error", garment: prenda },
      { status: 500 }
    );
  }

  // 3. Actualizar prenda con la ruta de imagen
  const { data: updatedData, error: updateError } = await supabase
    .from("prendas")
    .update({ imagen_url: path })
    .eq("id", prenda.id)
    .select("*")
    .single();

  if (updateError) {
    console.error("[garments/POST] Error updating imagen_url:", updateError.message);
    return NextResponse.json({ garment: prenda }, { status: 201 });
  }

  return NextResponse.json({ garment: updatedData as Prenda }, { status: 201 });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseJsonArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}
