import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// PERCHA-004: Actualizar contraseña (desde página /auth/reset-password)
// Requiere sesión activa (establecida por el callback al intercambiar el code)
export async function POST(request: Request) {
  try {
    const { password } = await request.json();

    if (!password || password.length < 8) {
      return NextResponse.json({ error: "password_too_short" }, { status: 400 });
    }

    const supabase = await createClient();

    // Verificar que hay sesión activa (establecida en /auth/callback)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "no_session" }, { status: 401 });
    }

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      if (error.message.toLowerCase().includes("same password")) {
        return NextResponse.json({ error: "same_password" }, { status: 400 });
      }
      return NextResponse.json({ error: "update_failed" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
