import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/garments/[id]/image
 *
 * Proxy autenticado que sirve la imagen de una prenda con una URL estable.
 * Al ser una URL fija (no signed URL con token efímero), el browser HTTP cache
 * y el service worker (Workbox StaleWhileRevalidate) pueden guardarla en el
 * dispositivo — primera carga desde Supabase, visitas siguientes desde el cache.
 *
 * Cache-Control: private (no CDN) · max-age=86400 (24h HTTP cache) ·
 *                stale-while-revalidate=604800 (7d SW cache)
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 401 });

  const { id } = await params;

  // Verifica propiedad y obtiene el path de la imagen
  const { data: garment } = await supabase
    .from("prendas")
    .select("imagen_url")
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();

  if (!garment?.imagen_url) return new NextResponse(null, { status: 404 });

  // Signed URL interno de corta duración (solo para este fetch)
  const { data: signed } = await supabase.storage
    .from("prendas")
    .createSignedUrl(garment.imagen_url, 60);

  if (!signed?.signedUrl) return new NextResponse(null, { status: 502 });

  // Fetch y proxy del cuerpo — streaming sin buffering completo en memoria
  const upstream = await fetch(signed.signedUrl);
  if (!upstream.ok) return new NextResponse(null, { status: 502 });

  const contentType = upstream.headers.get("content-type") ?? "image/jpeg";

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=2592000, stale-while-revalidate=2592000",
    },
  });
}
