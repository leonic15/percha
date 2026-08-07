"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button, Input } from "@/components/ui";

/**
 * PERCHA-001: Registro con email y contraseña — rediseño Handoff 03
 *
 * Layout mobile (390):
 *   pt-70px / px-24px / pb-30px — flex-col full-height
 *   Top bar: back  ·  "PASO 1 / 1" eyebrow  ·  spacer
 *   H1 42px "Empecemos." + sub 13px
 *   Form gap-24px: Nombre, Email, Contraseña (hint + toggle eyeOff)
 *   CTA primary lg full + legal 11px
 *   Footer mt-auto "¿Ya tenés cuenta? Iniciar sesión"
 *
 * Desktop (md+): card max-w-sm centrada (manejado por AuthLayout).
 *
 * Estados:
 *   - Vacío / writing: default
 *   - Carga: CTA disabled + "Creando cuenta…"
 *   - Error field: inline bajo el input correspondiente
 *   - Error email duplicado: inline en campo email + foco automático
 *   - Post-registro: verificación de email (si needsVerification) o redirect /guardarropas
 */

// ── Íconos inline (no depende de ningún bundle de íconos) ────────────────────

function BackIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
      <line x1={1} y1={1} x2={23} y2={23} />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx={12} cy={12} r={3} />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width={52} height={52} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

// ── Tipos ────────────────────────────────────────────────────────────────────

type FieldError = {
  field?: "nombre" | "email" | "password";
  message: string;
};

// ── Componente ───────────────────────────────────────────────────────────────

export default function RegistroPage() {
  const t = useTranslations("auth");
  const router = useRouter();

  const [nombre, setNombre]           = useState("");
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [fieldError, setFieldError]   = useState<FieldError | null>(null);
  const [registered, setRegistered]   = useState(false);

  const emailRef = useRef<HTMLInputElement>(null);

  // ── Validaciones client-side ─────────────────────────────────────────────

  function validate(): FieldError | null {
    if (!nombre.trim())    return { field: "nombre",   message: t("nombreRequired") };
    if (!email.trim())     return { field: "email",    message: t("emailRequired") };
    if (password.length < 8) return { field: "password", message: t("passwordMinLength") };
    return null;
  }

  // ── Submit ───────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldError(null);

    const err = validate();
    if (err) { setFieldError(err); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password, nombre: nombre.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.error === "email_in_use") {
          setFieldError({ field: "email", message: t("emailAlreadyInUse") });
          // Foco automático en el campo email (AC: email duplicado → toast + foco)
          setTimeout(() => emailRef.current?.focus(), 50);
        } else if (data.error === "password_too_short") {
          setFieldError({ field: "password", message: t("passwordMinLength") });
        } else {
          setFieldError({ message: t("oauthError") });
        }
        return;
      }

      if (data.needsVerification) {
        // Confirmar email activo → mostrar pantalla de verificación
        setRegistered(true);
      } else {
        // Desarrollo sin confirmación → ir directo al guardarropas
        router.push("/guardarropas");
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Pantalla post-registro: verificar email ───────────────────────────────

  if (registered) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center gap-6">
        {/* Ícono sobre fondo accent-tint */}
        <div
          className="flex items-center justify-center rounded-full"
          style={{ width: 72, height: 72, background: "var(--color-accent-tint)" }}
        >
          <span style={{ color: "var(--color-accent)" }}>
            <MailIcon />
          </span>
        </div>

        <div>
          <h2
            className="font-display uppercase font-semibold tracking-tight"
            style={{ fontSize: 28, lineHeight: 1, letterSpacing: "-0.01em", color: "var(--color-ink)" }}
          >
            {t("verifyEmailTitle")}
          </h2>
          <p className="mt-3 text-ink-2 leading-relaxed" style={{ fontSize: 14 }}>
            {t("verifyEmailMessage", { email })}
          </p>
        </div>

        <Link
          href="/login"
          className="text-ink-2 underline underline-offset-[3px] hover:text-ink transition-colors"
          style={{ fontSize: 13 }}
        >
          {t("backToLogin")}
        </Link>
      </div>
    );
  }

  // ── Formulario principal ──────────────────────────────────────────────────

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex-1 flex flex-col px-6 pt-[70px] pb-[30px]"
    >
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between mb-12">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-ink-2 transition-colors hover:text-ink"
          aria-label="Volver"
        >
          <BackIcon />
        </button>

        <span className="eyebrow">{t("registerStep")}</span>

        {/* spacer para equilibrar el back button */}
        <div className="w-[22px]" />
      </div>

      {/* ── Hero ── */}
      <h1
        className="font-display uppercase font-semibold"
        style={{
          fontSize: 42,
          lineHeight: 1,
          letterSpacing: "-0.01em",
          color: "var(--color-ink)",
          marginBottom: 8,
        }}
      >
        {t("registerTitle")}
      </h1>
      <p className="text-ink-2 mb-9" style={{ fontSize: 13, lineHeight: 1.5 }}>
        {t("registerSubtitle")}
      </p>

      {/* ── Campos ── */}
      <div className="flex flex-col gap-6 mb-7">
        <Input
          name="nombre"
          label={t("nombre")}
          placeholder={t("nombrePlaceholder")}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          autoComplete="name"
          autoFocus
          error={fieldError?.field === "nombre" ? fieldError.message : undefined}
        />

        <Input
          ref={emailRef}
          name="email"
          type="email"
          label={t("email")}
          placeholder="sofia@gmail.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          error={fieldError?.field === "email" ? fieldError.message : undefined}
        />

        <Input
          name="password"
          type={showPassword ? "text" : "password"}
          label={t("password")}
          placeholder="Mínimo 8 caracteres"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          hint={t("passwordHint")}
          error={fieldError?.field === "password" ? fieldError.message : undefined}
          suffix={
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="text-ink-3 transition-colors hover:text-ink-2"
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPassword ? <EyeIcon /> : <EyeOffIcon />}
            </button>
          }
        />
      </div>

      {/* Error genérico (sin campo) */}
      {fieldError && !fieldError.field && (
        <p className="text-danger mb-4" style={{ fontSize: 13 }}>{fieldError.message}</p>
      )}

      {/* ── CTA ── */}
      <Button
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        loading={loading}
        disabled={loading}
      >
        {loading ? t("creatingAccount") : t("register")}
      </Button>

      {/* ── Legal ── */}
      <p
        className="mt-5 text-center text-ink-3 leading-relaxed"
        style={{ fontSize: 11 }}
      >
        Al crear tu cuenta aceptás los términos
        <br />y la política de privacidad de Percha.
      </p>

      {/* ── Footer ── */}
      <p className="mt-auto text-center text-ink-2" style={{ fontSize: 12 }}>
        ¿Ya tenés cuenta?{" "}
        <Link
          href="/login"
          className="text-ink font-medium underline underline-offset-[3px] hover:text-ink-2 transition-colors"
        >
          {t("login")}
        </Link>
      </p>
    </form>
  );
}
