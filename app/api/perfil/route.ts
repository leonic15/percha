import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { ProfileUpdate } from "@/lib/database.types";

/**
 * GET /api/perfil
 *
 * Devuelve el perfil completo del usuario autenticado más stats:
 *   - full_name, avatar_url
 *   - idioma, tema, clima_habilitado
 *   - estilos_favoritos, ocasiones_frecuentes
 *   - prendasCount, looksCount
 *
 * PATCH /api/perfil
 *
 * Actualiza campos permitidos del perfil.
 * Body JSON: { full_name?, idioma?, tema?, clima_habilitado?,
 *              estilos_favoritos?, ocasiones_frecuentes? }
 *
 * Implementa LOOKSI-024 (LSI-35) y LOOKSI-025 (LSI-36).
 */

export interface ProfileData {
  full_name: string | null;
  avatar_url: string | null;
  idioma: string;
  tema: string;
  clima_habilitado: boolean;
  estilos_favoritos: string[];
  ocasiones_frecuentes: string[];
  prendasCount: number;
  looksCount: number;
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_session" }, { status: 401 });

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

  if (profileRes.error || !profileRes.data) {
    console.error("[perfil] GET error:", profileRes.error);
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const p = profileRes.data;
  const result: ProfileData = {
    full_name:            p.full_name ?? null,
    avatar_url:           p.avatar_url ?? null,
    idioma:               p.idioma ?? "es",
    tema:                 p.tema ?? "sistema",
    clima_habilitado:     p.clima_habilitado ?? true,
    estilos_favoritos:    p.estilos_favoritos ?? [],
    ocasiones_frecuentes: p.ocasiones_frecuentes ?? [],
    prendasCount:         prendasRes.count ?? 0,
    looksCount:           looksRes.count ?? 0,
  };

  return NextResponse.json(result);
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

const ALLOWED = [
  "full_name",
  "idioma",
  "tema",
  "clima_habilitado",
  "estilos_favoritos",
  "ocasiones_frecuentes",
  "ciudad_nombre",
  "ciudad_latitud",
  "ciudad_longitud",
  "ciudad_pais",
] as const;

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_session" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const update: ProfileUpdate = {};
  if ("full_name"            in body) update.full_name            = body.full_name            as ProfileUpdate["full_name"];
  if ("idioma"               in body) update.idioma               = body.idioma               as string;
  if ("tema"                 in body) update.tema                 = body.tema                 as string;
  if ("clima_habilitado"     in body) update.clima_habilitado     = body.clima_habilitado     as boolean;
  if ("estilos_favoritos"    in body) update.estilos_favoritos    = body.estilos_favoritos    as string[];
  if ("ocasiones_frecuentes" in body) update.ocasiones_frecuentes = body.ocasiones_frecuentes as string[];
  // Campos de ciudad (LOOKSI-023)
  if ("ciudad_nombre"        in body) update.ciudad_nombre        = body.ciudad_nombre        as string | null;
  if ("ciudad_latitud"       in body) update.ciudad_latitud       = body.ciudad_latitud       as number | null;
  if ("ciudad_longitud"      in body) update.ciudad_longitud      = body.ciudad_longitud      as number | null;
  if ("ciudad_pais"          in body) update.ciudad_pais          = body.ciudad_pais          as string | null;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "no_fields" }, { status: 400 });
  }
  update.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", user.id);

  if (error) {
    console.error("[perfil] PATCH error:", error);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// ── DELETE ────────────────────────────────────────────────────────────────────
// LOOKSI-007 (LSI-17) — Eliminación de cuenta y datos
//
// Orden de eliminación para respetar FK constraints y no perder referencias:
//   1. Storage: archivos en bucket `prendas` (imagen_url de cada prenda del usuario)
//   2. Storage: archivos en bucket `avatars` (avatar del usuario)
//   3. Auth:    deleteUser → Supabase lo cascadea a auth.users y, por FK CASCADE,
//               a profiles → prendas/looks (si la DB tiene CASCADE configurado).
//              En caso de que no haya CASCADE, los registros quedan huérfanos pero
//              son inaccesibles y se pueden limpiar vía RLS.
//
// La autenticación del request se verifica con el cliente SSR (cookie session).
// Toda la lógica de Storage y Admin usa el service role key (server-side).

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_session" }, { status: 401 });

  const supabaseUrl    = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[perfil] DELETE: missing env vars");
    return NextResponse.json({ error: "config_error" }, { status: 500 });
  }

  // Cliente admin (service role) — bypasa RLS para poder eliminar todo
  const admin = createAdminClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── 1. Eliminar archivos de Storage: bucket `prendas` ─────────────────────
  try {
    // Obtener todas las imagen_url no nulas del usuario
    const { data: prendas } = await admin
      .from("prendas")
      .select("imagen_url")
      .eq("user_id", user.id)
      .not("imagen_url", "is", null);

    const paths = (prendas ?? [])
      .map((p: { imagen_url: string | null }) => p.imagen_url)
      .filter((url): url is string => typeof url === "string" && url.length > 0);

    if (paths.length > 0) {
      const { error: storageErr } = await admin.storage
        .from("prendas")
        .remove(paths);
      if (storageErr) {
        console.warn("[perfil] DELETE: prendas storage partial error:", storageErr.message);
        // Continuar de todas formas — no bloquear la eliminación de cuenta
      }
    }
  } catch (err) {
    console.warn("[perfil] DELETE: prendas storage error:", err);
  }

  // ── 2. Eliminar archivos de Storage: bucket `avatars` ────────────────────
  try {
    // Listar todos los archivos bajo {user_id}/ (avatar puede ser .jpg/.png/.webp)
    const { data: avatarFiles } = await admin.storage
      .from("avatars")
      .list(user.id);

    if (avatarFiles && avatarFiles.length > 0) {
      const avatarPaths = avatarFiles.map((f: { name: string }) => `${user.id}/${f.name}`);
      const { error: avatarErr } = await admin.storage
        .from("avatars")
        .remove(avatarPaths);
      if (avatarErr) {
        console.warn("[perfil] DELETE: avatars storage error:", avatarErr.message);
      }
    }
  } catch (err) {
    console.warn("[perfil] DELETE: avatars storage error:", err);
  }

  // ── 3. Eliminar usuario de Supabase Auth ──────────────────────────────────
  // Esto cascadea la eliminación de auth.users, profiles (FK) y cualquier
  // tabla con ON DELETE CASCADE sobre user_id/profile_id.
  const { error: deleteErr } = await admin.auth.admin.deleteUser(user.id);
  if (deleteErr) {
    console.error("[perfil] DELETE: auth.admin.deleteUser error:", deleteErr.message);
    return NextResponse.json({ error: "delete_error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
