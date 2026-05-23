import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// LOOKSI-002 / LOOKSI-006: Cierre de sesión
// scope: 'local' (solo este dispositivo) | 'global' (todos los dispositivos)
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const scope = body?.scope === "global" ? "global" : "local";

    const supabase = await createClient();
    const { error } = await supabase.auth.signOut({ scope });

    if (error) {
      return NextResponse.json({ error: "logout_failed" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
