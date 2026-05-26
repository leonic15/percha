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
 *   {
 *     temperatura, temperatura_max, temperatura_min,
 *     sensacion_termica, condicion, weathercode,
 *     franjas: { mañana, tarde, noche }
 *   }
 *
 * LOOKSI-022 (LSI-33) — EP-05 Integración de clima
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

/** Promedia los valores de un array de números */
function avg(values: number[]): number {
  if (!values.length) return 0;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

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

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 5_000);

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,apparent_temperature,weather_code` +
      `&daily=temperature_2m_max,temperature_2m_min` +
      `&hourly=temperature_2m,apparent_temperature` +
      `&timezone=auto&forecast_days=1`;

    const res = await fetch(url, {
      signal: controller.signal,
      next: { revalidate: 1800 }, // cache 30 min (Next.js fetch cache)
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.error("[clima] Open-Meteo error:", res.status);
      return NextResponse.json({ error: "weather_api_error" }, { status: 502 });
    }

    const data = await res.json();

    // ── Current weather (new API format: `current`) ──────────────────────────
    const current = data.current as {
      temperature_2m:      number;
      apparent_temperature: number;
      weather_code:        number;
    } | undefined;

    // Fallback: también soportamos `current_weather` (formato legacy)
    const cw = data.current_weather as {
      temperature: number;
      weathercode: number;
    } | undefined;

    const temperatura        = Math.round(current?.temperature_2m ?? cw?.temperature ?? 0);
    const sensacion_termica  = Math.round(current?.apparent_temperature ?? temperatura);
    const weathercode        = current?.weather_code ?? cw?.weathercode ?? 0;
    const temperatura_max    = Math.round(data.daily?.temperature_2m_max?.[0] ?? temperatura + 3);
    const temperatura_min    = Math.round(data.daily?.temperature_2m_min?.[0] ?? temperatura - 4);
    const condicion          = WMO[weathercode] ?? "Variable";

    // ── Franjas horarias (mañana 6-12h, tarde 12-18h, noche 18-24h) ──────────
    const hourlyTemps: number[] = data.hourly?.temperature_2m ?? [];
    // Open-Meteo devuelve 24 valores, uno por hora (índice 0=00h, 6=06h, etc.)
    const mañana  = avg(hourlyTemps.slice(6,  12));
    const tarde   = avg(hourlyTemps.slice(12, 18));
    const noche   = avg(hourlyTemps.slice(18, 24));

    return NextResponse.json({
      temperatura,
      temperatura_max,
      temperatura_min,
      sensacion_termica,
      condicion,
      weathercode,
      franjas: { mañana, tarde, noche },
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      console.warn("[clima] Timeout al consultar Open-Meteo");
      return NextResponse.json({ error: "timeout" }, { status: 504 });
    }
    console.error("[clima] Error:", err);
    return NextResponse.json({ error: "weather_error" }, { status: 502 });
  }
}
