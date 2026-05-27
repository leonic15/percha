/**
 * Endpoint de diagnóstico TEMPORAL — eliminar antes de producción.
 * Acceder desde el iPhone: http://192.168.1.111:3000/api/auth/debug
 * Muestra exactamente qué redirect_to se generaría para Google OAuth.
 */
export async function GET(request: Request) {
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL;
  const host    = request.headers.get("host");
  const reqUrl  = request.url;
  const nodeEnv = process.env.NODE_ENV;

  const origin = appUrl?.replace(/\/$/, "")
    ?? (() => {
         const h = host ?? new URL(reqUrl).host;
         const p = nodeEnv === "production" ? "https" : "http";
         return `${p}://${h}`;
       })();

  return Response.json({
    "NEXT_PUBLIC_APP_URL": appUrl ?? "(no definida)",
    "request.url":         reqUrl,
    "Host header":         host,
    "origin calculado":    origin,
    "redirectTo que se envía a Supabase": `${origin}/auth/callback`,
    "NODE_ENV":            nodeEnv,
  });
}
