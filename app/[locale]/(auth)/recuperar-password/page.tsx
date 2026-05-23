"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button, Input } from "@/components/ui";
import { cn } from "@/lib/cn";

/**
 * LOOKSI-004: Recuperación de contraseña
 * Estado 1: Formulario de email → POST /api/auth/reset-password
 * Estado 2: Email enviado (mismo mensaje independiente de si el email existe — seguridad)
 */
export default function RecuperarPasswordPage() {
  const t = useTranslations("auth");

  const [email, setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        // Aún así mostrar el mensaje genérico (no revelar si el email existe)
      }

      setSent(true);
    } catch {
      setError("Ocurrió un error de red. Por favor intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Marca */}
      <div className="text-center">
        <p className="text-2xl font-display font-semibold tracking-tight text-ink">LookSi</p>
        <h1 className="mt-1 text-base text-ink/70">Recuperar contraseña</h1>
      </div>

      {sent ? (
        /* Estado 2: confirmación genérica */
        <div className="space-y-6">
          <div className="rounded-md bg-sage-50 border border-sage-200 p-4">
            <p className="text-sm text-sage-800 leading-relaxed">{t("resetEmailSent")}</p>
          </div>
          <p className="text-center text-sm text-ink/60">
            <Link href="/login" className="text-accent hover:underline">
              {t("backToLogin")}
            </Link>
          </p>
        </div>
      ) : (
        /* Estado 1: formulario */
        <div className="space-y-6">
          <p className="text-sm text-ink/60 text-center leading-relaxed">
            Ingresá tu email y te enviaremos un link para restablecer tu contraseña.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Input
              type="email"
              label={t("email")}
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
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
              {t("sendResetLink")}
            </Button>
          </form>

          <p className="text-center text-sm text-ink/60">
            <Link href="/login" className="text-accent hover:underline">
              {t("backToLogin")}
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
