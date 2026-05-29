import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { Prenda } from "@/lib/database.types";
import { captureServerEvent } from "@/lib/posthog/server";

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

  return NextResponse.json(
    { garments, total: count ?? 0, page, hasMore: page * limit < (count ?? 0) },
    { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=120" } }
  );
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

  const ia_analizada  = formData.get("ia_analizada") === "true";
  const ia_descripcion = (formData.get("ia_descripcion") as string | null)?.trim() || null;

  // Resolver category_id: acepta tanto category_id numérico como category_slug string
  let category_id: number | null = formData.get("category_id")
    ? Number(formData.get("category_id"))
    : null;

  const category_slug = (formData.get("category_slug") as string | null)?.trim() || null;
  if (!category_id && category_slug) {
    // 1. Lookup normal con el cliente de usuario (respeta RLS de lectura pública)
    const { data: catRow } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", category_slug)
      .single();
    category_id = (catRow as { id: number } | null)?.id ?? null;

    // 2. Si no encontró nada, la tabla categories está vacía (seed no ejecutado).
    //    Usamos el service role (bypasa RLS) para hacer el seed idempotente de las 8 categorías
    //    y luego releer el ID real — solo ocurre una vez por proyecto.
    if (!category_id) {
      const svc = createServiceClient();
      const { error: upsertErr } = await svc.from("categories").upsert([
        { slug: "tops",                    nombre: "Tops"                    },
        { slug: "pantalones-y-shorts",     nombre: "Pantalones y Shorts"     },
        { slug: "vestidos-y-faldas",       nombre: "Vestidos y Faldas"       },
        { slug: "calzado",                 nombre: "Calzado"                 },
        { slug: "abrigos-y-chaquetas",     nombre: "Abrigos y Chaquetas"     },
        { slug: "ropa-interior-y-pijamas", nombre: "Ropa Interior y Pijamas" },
        { slug: "accesorios",              nombre: "Accesorios"              },
        { slug: "otros",                   nombre: "Otros"                   },
      ], { onConflict: "slug" });
      if (upsertErr) console.error("[garments/POST] upsert categories error:", upsertErr.message);

      // Re-leer con service client (tabla ya tiene datos)
      const { data: catRow2, error: catErr2 } = await svc
        .from("categories")
        .select("id")
        .eq("slug", category_slug)
        .single();
      if (catErr2) console.error("[garments/POST] re-read category error:", catErr2.message);
      category_id = (catRow2 as { id: number } | null)?.id ?? null;
      console.log("[garments/POST] after seed — category_id:", category_id, "for slug:", category_slug);
    }
  }

  // Validaciones — el client ya valida nombre y categoría; acá solo bloqueamos sin imagen
  if (!nombre) return NextResponse.json({ error: "nombre_requerido" }, { status: 400 });
  // category_id es nullable en DB — si no se pudo resolver, se guarda null
  if (!imagen || imagen.size === 0) return NextResponse.json({ error: "imagen_requerida" }, { status: 400 });

  // Normalizar tipos no-estándar: vacío/"image/jpg" → "image/jpeg"
  const normalizedType = (!imagen.type || imagen.type === "image/jpg")
    ? "image/jpeg"
    : imagen.type;
  if (!normalizedType.startsWith("image/")) {
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
      ia_analizada,
      ia_descripcion,
    })
    .select("*")
    .single();

  if (insertError || !prendaData) {
    console.error("[garments/POST] db_insert_error:", insertError?.message);
    return NextResponse.json({ error: "db_insert_error" }, { status: 500 });
  }

  const prenda = prendaData as Prenda;

  // 2. Subir imagen a Storage: prendas/{user_id}/{prenda_id}.{ext}
  const ext  = normalizedType === "image/png" ? "png" : "jpg";
  const path = `${user.id}/${prenda.id}.${ext}`;
  const bytes = await imagen.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from("prendas")
    .upload(path, bytes, {
      contentType: normalizedType,
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
    // Prenda guardada sin imagen — igual emitir evento
    await captureServerEvent(user.id, "prenda_agregada", {
      categoria_id: category_id,
      con_ia:       ia_analizada,
      con_imagen:   false,
    });
    return NextResponse.json({ garment: prenda }, { status: 201 });
  }

  // ── PostHog: prenda agregada ───────────────────────────────────────────────
  await captureServerEvent(user.id, "prenda_agregada", {
    categoria_id: category_id,
    con_ia:       ia_analizada,
    con_imagen:   true,
  });

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
