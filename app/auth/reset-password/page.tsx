"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Input } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";

/**
 * LOOKSI-004: Página de nueva contraseña (fuera de [locale]).
 * useSearchParams requiere Suspense boundary en Next.js App Router.
 */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <ResetPasswordContent />
    </Suspense>
  );
}

function LoadingSpinner() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-bg">
      <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const linkError = searchParams.get("error");

  const [password, setPassword]     = useState("");
  const [confirm, setConfirm]       = useState("");
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(
    linkError === "link_expired" ? "El link expiró o ya fue utilizado." : null
  );
  const [success, setSuccess]       = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  // Verificar que el callback estableció sesión
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setHasSession(!!data.user);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/update-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();

      if (!res.ok) {
        const msgs: Record<string, string> = {
          password_too_short: "La contraseña debe tener al menos 8 caracteres.",
          same_password:      "La nueva contraseña debe ser diferente a la anterior.",
          no_session:         "Tu sesión expiró. Solicitá un nuevo link.",
        };
        setError(msgs[data.error] ?? "Ocurrió un error. Por favor intentá de nuevo.");
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push("/guardarropas"), 2000);
    } finally {
      setLoading(false);
    }
  }

  // Estado: link expirado o sin sesión
  if (linkError === "link_expired" || hasSession === false) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-bg px-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center mx-auto">
            <span className="text-danger text-xl font-semibold">!</span>
          </div>
          <div>
            <h1 className="text-xl font-display font-semibold text-ink">Link expirado</h1>
            <p className="mt-2 text-sm text-ink/60">
              El link expiró o ya fue utilizado. Solicitá uno nuevo desde la pantalla de recuperación.
            </p>
          </div>
          <Button variant="primary" onClick={() => router.push("/recuperar-password")}>
            Solicitar nuevo link
          </Button>
        </div>
      </div>
    );
  }

  // Cargando verificación de sesión
  if (hasSession === null) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Marca */}
        <div className="text-center">
          <p className="text-2xl font-display font-semibold tracking-tight text-ink">LookSi</p>
          <h1 className="mt-1 text-lg font-medium text-ink">Nueva contraseña</h1>
        </div>

        {success ? (
          <div className="rounded-md bg-sage-50 border border-sage-200 p-4 text-center text-sm text-sage-800">
            ¡Contraseña actualizada! Redirigiendo...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <Input
              type="password"
              label="Nueva contraseña"
              placeholder="Mínimo 8 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
            <Input
              type="password"
              label="Confirmar contraseña"
              placeholder="Repetí la contraseña"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
            />

            {error && (
              <p className={cn("text-sm text-danger")}>{error}</p>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              disabled={loading}
              className="w-full"
            >
              Actualizar contraseña
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
