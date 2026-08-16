import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PROXYABLE_BUCKETS, type ProxyableBucket } from "@/lib/storage/urls";

export const dynamic = "force-dynamic";

/**
 * GET /api/storage/[bucket]/[...path]
 *
 * Proxy autenticado con URL estable para los buckets que no son `prendas`
 * (esas tienen su propia ruta, `/api/garments/[id]/image`). Reemplaza a las
 * signed URLs con TTL de 1h, que expiraban con la app abierta y no se podían
 * cachear. Ver `lib/storage/urls.ts`.
 *
 * Control de acceso: todos estos buckets guardan bajo `{user_id}/…`, así que
 * alcanza con exigir que el path pedido empiece con el id del usuario logueado.
 * El token firmado se genera acá, dura 60s y no sale del server.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ bucket: string; path: string[] }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 401 });

  const { bucket, path } = await params;

  if (!(PROXYABLE_BUCKETS as readonly string[]).includes(bucket)) {
    return new NextResponse(null, { status: 404 });
  }

  // Next ya decodifica los segmentos; `..` se rechaza explícitamente para que
  // no se pueda salir del prefijo del usuario con un path como `{id}/../otro`.
  if (path.length === 0 || path.some((seg) => !seg || seg === "..")) {
    return new NextResponse(null, { status: 400 });
  }

  // El primer segmento es siempre el owner del archivo.
  if (path[0] !== user.id) return new NextResponse(null, { status: 404 });

  const objectPath = path.join("/");

  const { data: signed } = await supabase.storage
    .from(bucket as ProxyableBucket)
    .createSignedUrl(objectPath, 60);

  if (!signed?.signedUrl) return new NextResponse(null, { status: 404 });

  const upstream = await fetch(signed.signedUrl);
  if (!upstream.ok) return new NextResponse(null, { status: 502 });

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
      // private: nunca en un CDN compartido — son fotos de un usuario concreto.
      "Cache-Control": "private, max-age=2592000, stale-while-revalidate=2592000",
    },
  });
}
