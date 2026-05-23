"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button, Input } from "@/components/ui";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { cn } from "@/lib/cn";

/**
 * LOOKSI-001 (AC5: email no verificado)
 * LOOKSI-002: Login con email y contraseña + redirección post-login
 * LOOKSI-003: Botón de Google OAuth
 */
export default function LoginPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();

  const redirectTo = searchParams.get("redirectTo") ?? "/guardarropas";
  const oauthError = searchParams.get("error") === "oauth_error";

  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(
    oauthError ? t("oauthError") : null
  );
  const [showResend, setShowResend]     = useState(false);
  const [resendSent, setResendSent]     = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setShowResend(false);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.error === "email_not_verified") {
          setError(t("emailNotVerified"));
          setShowResend(true);
        } else {
          setError(t("invalidCredentials"));
        }
        return;
      }

      // AC5 LOOKSI-002: redirigir a la ruta original o al dashboard
      router.push(redirectTo);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleResendVerification() {
    if (!email) return;
    setResendSent(false);
    // Usamos signup con el mismo email — Supabase reenvía el email si no está verificado
    await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "placeholder_resend" }),
    });
    setResendSent(true);
  }

  return (
    <div className="space-y-8">
      {/* Marca */}
      <div className="text-center">
        <p className="text-2xl font-display font-semibold tracking-tight text-ink">LookSi</p>
        <h1 className="mt-1 text-base text-ink/70">{t("login")}</h1>
      </div>

      {/* Formulario */}
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
        <div className="space-y-1">
          <Input
            type="password"
            label={t("password")}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          <div className="text-right">
            <Link
              href="/recuperar-password"
              className="text-xs text-ink/50 hover:text-accent transition-colors"
            >
              {t("forgotPassword")}
            </Link>
          </div>
        </div>

        {error && (
          <div className="text-sm text-danger">{error}</div>
        )}

        {showResend && (
          <button
            type="button"
            onClick={handleResendVerification}
            className="text-xs text-accent hover:underline"
          >
            {resendSent ? "Email enviado ✓" : t("resendVerification")}
          </button>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={loading}
          disabled={loading}
          className="w-full"
        >
          {t("login")}
        </Button>
      </form>

      {/* Divider */}
      <div className={cn("relative flex items-center gap-3")}>
        <div className="flex-1 border-t border-stone-200" />
        <span className="text-xs text-ink/40">{t("orContinueWith")}</span>
        <div className="flex-1 border-t border-stone-200" />
      </div>

      {/* Google */}
      <GoogleSignInButton label={t("continueWithGoogle")} />

      {/* Link a registro */}
      <p className="text-center text-sm text-ink/60">
        {t("noAccount")}{" "}
        <Link href="/registro" className="text-accent hover:underline font-medium">
          {t("register")}
        </Link>
      </p>
    </div>
  );
}
