"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button, Input } from "@/components/ui";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { cn } from "@/lib/cn";

/**
 * LOOKSI-001: Registro con email y contraseña
 * AC1: Registro exitoso → pantalla de verificación de email
 * AC2: Email en uso → error inline
 * AC3: Contraseña débil → error inline client-side
 * AC4: Contraseñas no coinciden → error inline client-side
 */
export default function RegistroPage() {
  const t = useTranslations("auth");

  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [confirm, setConfirm]       = useState("");
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);

  // Validaciones client-side antes de enviar al servidor
  function validate(): string | null {
    if (password.length < 8) return t("passwordMinLength");
    if (password !== confirm)  return t("passwordMismatch");
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.error === "email_in_use") {
          setError(t("emailAlreadyInUse"));
        } else if (data.error === "password_too_short") {
          setError(t("passwordMinLength"));
        } else {
          setError(t("oauthError")); // error genérico
        }
        return;
      }

      // AC1: mostrar pantalla de verificación (no redirigir al dashboard)
      setRegistered(true);
    } finally {
      setLoading(false);
    }
  }

  // Pantalla post-registro: verificar email
  if (registered) {
    return (
      <div className="space-y-6 text-center">
        <div className="w-14 h-14 rounded-full bg-sage-100 flex items-center justify-center mx-auto">
          <svg className="w-7 h-7 text-sage-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-display font-semibold text-ink">{t("verifyEmailTitle")}</h2>
          <p className="mt-2 text-sm text-ink/60 leading-relaxed">
            {t("verifyEmailMessage", { email })}
          </p>
        </div>
        <Link href="/login" className="text-sm text-accent hover:underline">
          {t("backToLogin")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Marca */}
      <div className="text-center">
        <p className="text-2xl font-display font-semibold tracking-tight text-ink">LookSi</p>
        <h1 className="mt-1 text-base text-ink/70">{t("register")}</h1>
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
        <Input
          type="password"
          label={t("password")}
          placeholder="Mínimo 8 caracteres"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
        <Input
          type="password"
          label={t("confirmPassword")}
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
          {t("register")}
        </Button>
      </form>

      {/* Divider */}
      <div className="relative flex items-center gap-3">
        <div className="flex-1 border-t border-stone-200" />
        <span className="text-xs text-ink/40">{t("orContinueWith")}</span>
        <div className="flex-1 border-t border-stone-200" />
      </div>

      {/* Google */}
      <GoogleSignInButton label={t("continueWithGoogle")} />

      {/* Link a login */}
      <p className="text-center text-sm text-ink/60">
        {t("alreadyHaveAccount")}{" "}
        <Link href="/login" className="text-accent hover:underline font-medium">
          {t("login")}
        </Link>
      </p>
    </div>
  );
}
