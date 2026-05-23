"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface GoogleSignInButtonProps {
  label?: string;
}

/**
 * LOOKSI-003: Botón de autenticación con Google.
 * Inicia el flujo PKCE de OAuth — debe ser Client Component porque
 * supabase.auth.signInWithOAuth() requiere el browser para la redirección.
 */
export function GoogleSignInButton({ label = "Continuar con Google" }: GoogleSignInButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleGoogleSignIn() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: "email profile",
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });
    // No resetear loading: la página se redirige a Google
  }

  return (
    <button
      type="button"
      onClick={handleGoogleSignIn}
      disabled={loading}
      className="
        w-full flex items-center justify-center gap-3
        border border-stone-300 rounded-full
        px-4 py-2.5 text-sm font-medium text-ink
        bg-bg hover:bg-stone-50 active:bg-stone-100
        transition-colors duration-150
        disabled:opacity-60 disabled:cursor-not-allowed
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
      "
    >
      {loading ? (
        <span className="w-5 h-5 border-2 border-stone-300 border-t-ink rounded-full animate-spin" />
      ) : (
        <GoogleIcon />
      )}
      <span>{label}</span>
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/>
      <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"/>
    </svg>
  );
}
