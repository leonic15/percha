/**
 * lib/storage/urls.ts — URLs estables para imágenes de Storage.
 *
 * Supabase Storage es privado, así que las imágenes no se pueden linkear
 * directo. La opción obvia son las signed URLs, pero traen un token con TTL:
 * con 3600s, si el usuario deja la app abierta más de una hora las fotos
 * empiezan a dar 400 y desaparecen. Además el token cambia en cada render, así
 * que ni el HTTP cache ni el service worker pueden reusar nada.
 *
 * En vez de eso, todas las imágenes se sirven por rutas proxy autenticadas con
 * URL estable. El proxy firma internamente por 60s (lo justo para su propio
 * fetch) y el token nunca llega al browser. Como la URL no cambia, el SW la
 * cachea (ver `runtimeCaching` en `next.config.ts`).
 *
 * Las signed URLs siguen siendo correctas para consumo server-side inmediato
 * (por ejemplo pasarle una imagen a la IA): ahí la URL se usa y se descarta en
 * el mismo request, y nunca toca el browser.
 */

/**
 * Buckets privados que el proxy genérico puede servir. `prendas` no está acá
 * porque tiene su propia ruta, y `avatars` tampoco porque es un bucket público
 * (se sirve con `getPublicUrl`, sin token que pueda expirar).
 */
export const PROXYABLE_BUCKETS = [
  "body-photos",
  "look-images",
] as const;

export type ProxyableBucket = (typeof PROXYABLE_BUCKETS)[number];

/**
 * Imagen de una prenda. Usa la ruta dedicada `/api/garments/[id]/image`, que
 * valida propiedad contra la fila de `prendas`. Todas las pantallas comparten
 * esta misma URL, así que comparten también la entrada del cache del SW que ya
 * calentó el guardarropas.
 *
 * @param imagenUrl El path en Storage. Solo se usa para distinguir prendas sin
 *                  foto — el path real lo resuelve el server.
 */
export function garmentImageUrl(
  id: string,
  imagenUrl: string | null | undefined,
): string | null {
  return imagenUrl ? `/api/garments/${id}/image` : null;
}

/**
 * Imagen de cualquier otro bucket, vía `/api/storage/[bucket]/[...path]`.
 * El path se pasa tal cual (segmento por segmento, escapado); el server valida
 * que pertenezca al usuario logueado.
 */
export function storageImageUrl(
  bucket: ProxyableBucket,
  path: string | null | undefined,
): string | null {
  if (!path) return null;
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `/api/storage/${bucket}/${encoded}`;
}
