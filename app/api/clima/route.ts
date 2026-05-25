import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/clima?lat=-34.6&lon=-58.4
 *
 * Proxy servidor → Open-Meteo (sin API key, gratuito).
 * El browser llama este endpoint (misma origin) para evitar
 * que la URL de Open-Meteo quede expuesta en el cliente y para
 * mantener el cache server-side (revalidate 1800s = 30 min).
 *
 * Retorna:
 *   { temperatura, temperatura_max, temperatura_min, condicion, weathercode }
 */

// WMO Weather Interpretation Codes → texto en español
const WMO: Record<number, string> = {
  0: "Soleado",
  1: "Mayormente soleado",
  2: "Parcialmente nublado",
  3: "Nublado",
  45: "Neblina",
  48: "Neblina con escarcha",
  51: "Llovizna leve",
  53: "Llovizna moderada",
  55: "Llovizna intensa",
  61: "Lluvia leve",
  63: "Lluvia moderada",
  65: "Lluvia intensa",
  71: "Nieve leve",
  73: "Nevada moderada",
  75: "Nevada intensa",
  80: "Lluvias intermitentes",
  81: "Lluvias intermitentes moderadas",
  82: "Lluvias intermitentes intensas",
  95: "Tormenta",
  96: "Tormenta con granizo",
  99: "Tormenta fuerte",
};

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_session" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const lat = parseFloat(searchParams.get("lat") ?? "NaN");
  const lon = parseFloat(searchParams.get("lon") ?? "NaN");

  if (isNaN(lat) || isNaN(lon)) {
    return NextResponse.json({ error: "invalid_coords" }, { status: 400 });
  }

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lon}` +
      `&current_weather=true` +
      `&daily=temperature_2m_max,temperature_2m_min` +
      `&timezone=auto&forecast_days=1`;

    const res = await fetch(url, {
      next: { revalidate: 1800 }, // cache 30 min (Next.js fetch cache)
    });

    if (!res.ok) {
      console.error("[clima] Open-Meteo error:", res.status);
      return NextResponse.json({ error: "weather_api_error" }, { status: 502 });
    }

    const data = await res.json();
    const cw = data.current_weather as {
      temperature: number;
      weathercode: number;
    };

    const temperatura     = Math.round(cw.temperature);
    const temperatura_max = Math.round(data.daily?.temperature_2m_max?.[0] ?? cw.temperature + 3);
    const temperatura_min = Math.round(data.daily?.temperature_2m_min?.[0] ?? cw.temperature - 4);
    const condicion       = WMO[cw.weathercode] ?? "Variable";

    return NextResponse.json({
      temperatura,
      temperatura_max,
      temperatura_min,
      condicion,
      weathercode: cw.weathercode,
    });
  } catch (err) {
    console.error("[clima] Error:", err);
    return NextResponse.json({ error: "weather_error" }, { status: 502 });
  }
}
