import { readFile } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";

// Sirve imágenes estáticas de /public/images/ a través de la API layer.
// Esto bypasea el servidor estático de Turbopack, que bloquea subrecursos
// desde IPs de LAN en dev aunque la página sí cargue correctamente.
// Solo expone archivos explícitamente listados (no traversal de directorios).

const ALLOWED: Record<string, string> = {
  "jean-azul.png":       "image/png",
  "camisa-caramel.png":  "image/png",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const mime = ALLOWED[slug];

  if (!mime) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const filepath = join(process.cwd(), "public", "images", slug);
    const buf = await readFile(filepath);
    return new NextResponse(buf, {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
