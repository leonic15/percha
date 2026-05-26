import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/clima/ciudades?q={query}
 *
 * Busca ciudades usando la API de geocoding de Open-Meteo (gratuita, sin API key).
 * Devuelve hasta 5 resultados con nombre, país, latitud y longitud.
 *
 * La consulta se realiza siempre desde el servidor para no exponer la URL
 * directamente desde el cliente.
 *
 * LOOKSI-023 (LSI-34) — EP-05 Integración de clima
 */

export interface CiudadResult {
  id:       number;
  nombre:   string;
  pais:     string;
  latitud:  number;
  longitud: number;
}

export async function GET(req: NextRequest) {
  // Requiere sesión activa
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_session" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json({ ciudades: [] });
  }

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 5_000);

  try {
    const url =
      `https://geocoding-api.open-meteo.com/v1/search` +
      `?name=${encodeURIComponent(q)}` +
      `&count=5&language=es&format=json`;

    const res = await fetch(url, {
      signal: controller.signal,
      next:   { revalidate: 3600 }, // cache 1h — los nombres de ciudades no cambian
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.error("[clima/ciudades] Geocoding error:", res.status);
      return NextResponse.json({ error: "geocoding_error" }, { status: 502 });
    }

    const data = await res.json();
    const results = (data.results ?? []) as Array<{
      id:        number;
      name:      string;
      country:   string;
      latitude:  number;
      longitude: number;
    }>;

    const ciudades: CiudadResult[] = results.map((r) => ({
      id:       r.id,
      nombre:   r.name,
      pais:     r.country ?? "",
      latitud:  r.latitude,
      longitud: r.longitude,
    }));

    return NextResponse.json({ ciudades });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      console.warn("[clima/ciudades] Timeout");
      return NextResponse.json({ error: "timeout" }, { status: 504 });
    }
    console.error("[clima/ciudades] Error:", err);
    return NextResponse.json({ error: "geocoding_error" }, { status: 502 });
  }
}
