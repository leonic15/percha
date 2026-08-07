import { NextResponse } from "next/server";
import { logger } from "@/lib/utils/logger";
import { createClient } from "@/lib/supabase/server";

// PERCHA-004: Enviar email de recuperación de contraseña
export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "email_required" }, { status: 400 });
    }

    const supabase = await createClient();
    const origin = new URL(request.url).origin;

    // Redirige al callback que intercambia el code y luego va a /auth/reset-password
    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      {
        redirectTo: `${origin}/auth/callback?next=/auth/reset-password`,
      }
    );

    // Respuesta siempre exitosa — no revelar si el email existe (seguridad)
    if (error && process.env.NODE_ENV === "development") {
      logger.error("[reset-password] Error", { endpoint: "auth/reset-password" }, error instanceof Error ? error : undefined);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
