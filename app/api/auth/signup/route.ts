import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// LOOKSI-001: Registro con email y contraseña
export async function POST(request: Request) {
  try {
    const { email, password, nombre } = await request.json();

    // Validación server-side
    if (!email || !password) {
      return NextResponse.json({ error: "email_password_required" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "password_too_short" }, { status: 400 });
    }

    const supabase = await createClient();

    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        // full_name en metadata para que el trigger handle_new_user lo use al crear el perfil
        data: nombre ? { full_name: (nombre as string).trim() } : undefined,
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(request.url).origin : ""}/auth/callback`,
      },
    });

    if (error) {
      // Supabase devuelve "User already registered" para emails duplicados
      if (error.message.toLowerCase().includes("already registered") ||
          error.message.toLowerCase().includes("already in use")) {
        return NextResponse.json({ error: "email_in_use" }, { status: 409 });
      }
      return NextResponse.json({ error: "signup_failed" }, { status: 400 });
    }

    // Si identities está vacío, el email ya existe (Supabase no revela esto directamente por seguridad,
    // pero cuando emailConfirmation está activo, signUp devuelve data.user sin error aunque exista)
    if (data.user && data.user.identities?.length === 0) {
      return NextResponse.json({ error: "email_in_use" }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      email: data.user?.email,
      needsVerification: !data.session, // true cuando confirmación de email está activa
    });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
