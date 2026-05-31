/** Maximum size for garment images (prendas bucket limit). */
export const GARMENT_IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

/** Maximum byte-length of a base64 image string (~6 MB image encodes to ~8 M chars). */
export const BASE64_IMAGE_MAX_CHARS = 8 * 1024 * 1024;

/** Maximum JSON body size for endpoints that receive images as base64. */
export const JSON_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

// ── Magic bytes detection (H-17) ─────────────────────────────────────────────

const JPEG_MAGIC  = [0xFF, 0xD8, 0xFF] as const;
const PNG_MAGIC   = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] as const;
const GIF_MAGIC   = [0x47, 0x49, 0x46, 0x38] as const;

function matchesPrefix(bytes: Uint8Array, prefix: readonly number[]): boolean {
  return prefix.every((b, i) => bytes[i] === b);
}

function isWebP(bytes: Uint8Array): boolean {
  // RIFF????WEBP — first 4 bytes are RIFF, bytes 8-11 are WEBP
  return (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  );
}

/**
 * Detecta el MIME type real de un File leyendo sus magic bytes (12 bytes bastan).
 * Devuelve null si el formato no está en la lista de tipos permitidos.
 */
export async function detectImageMimeType(file: File): Promise<string | null> {
  const slice = file.slice(0, 12);
  const buffer = await slice.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  if (matchesPrefix(bytes, JPEG_MAGIC)) return "image/jpeg";
  if (matchesPrefix(bytes, PNG_MAGIC))  return "image/png";
  if (isWebP(bytes))                    return "image/webp";
  if (matchesPrefix(bytes, GIF_MAGIC))  return "image/gif";

  return null; // no reconocido
}
