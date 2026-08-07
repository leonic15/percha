import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// PERCHA-002: Login con email y contraseña
export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "invalid_credentials" }, { status: 400 });
    }

    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      // Email no verificado — Supabase devuelve "Email not confirmed"
      if (error.message.toLowerCase().includes("email not confirmed")) {
        return NextResponse.json({ error: "email_not_verified" }, { status: 403 });
      }
      // Credenciales incorrectas — respuesta genérica (no revelar cuál falló)
      return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
    }

    if (!data.session) {
      return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
    }

    // Las cookies de sesión se setean automáticamente via createClient() con @supabase/ssr
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
