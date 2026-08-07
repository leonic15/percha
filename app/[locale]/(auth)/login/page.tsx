"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

/**
 * PERCHA-001 (AC5: email no verificado)
 * PERCHA-002: Login con email y contraseña + redirección post-login
 * PERCHA-003: Botón de Google OAuth
 *
 * Visual: Handoff 02 / ScreenLogin() — screens-1.jsx
 */

/* ── Iconos inline ──────────────────────────────────────────────────── */
function BackIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none"
      stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="14 18 8 11 14 4" />
    </svg>
  );
}

function EyeIcon({ off = false }: { off?: boolean }) {
  return off ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/* ── Wordmark ────────────────────────────────────────────────────────── */
function Wordmark({ size = 18 }: { size?: number }) {
  return (
    <span style={{
      fontFamily: "var(--font-display)",
      fontWeight: 700,
      fontSize: size,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: "var(--color-ink)",
      display: "inline-flex",
      alignItems: "baseline",
    }}>
      Percha<span style={{ color: "var(--color-accent)", fontWeight: 700 }}>.</span>
    </span>
  );
}

/* ── Page ────────────────────────────────────────────────────────────── */
export default function LoginPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();

  const redirectTo = searchParams.get("redirectTo") ?? "/guardarropas";
  const oauthError = searchParams.get("error") === "oauth_error";

  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(
    oauthError ? t("oauthError") : null,
  );
  const [showResend, setShowResend] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
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

      router.push(redirectTo);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleResendVerification() {
    if (!email) return;
    setResendSent(false);
    await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "placeholder_resend" }),
    });
    setResendSent(true);
  }

  return (
    /* El AuthLayout ya provee min-h-dvh flex flex-col.
       Esta página ocupa flex-1 y declara su propio padding (Handoff 02). */
    <div style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      paddingTop: 70,
      paddingBottom: 30,
      paddingLeft: 24,
      paddingRight: 24,
    }}>

      {/* ── Barra superior: atrás · wordmark · spacer ── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 48,
      }}>
        <Link href="/" style={{ color: "var(--color-ink-2)", display: "flex" }}>
          <BackIcon />
        </Link>
        <Wordmark size={18} />
        {/* spacer para que el wordmark quede centrado */}
        <div style={{ width: 22 }} />
      </div>

      {/* ── Hero ── */}
      <h1 style={{
        fontFamily: "var(--font-display)",
        fontWeight: 600,
        fontSize: 42,
        lineHeight: 1.0,
        textTransform: "uppercase",
        letterSpacing: "-0.01em",
        color: "var(--color-ink)",
        marginBottom: 8,
      }}>
        Bienvenida<br />de vuelta.
      </h1>
      <p style={{
        fontSize: 13,
        lineHeight: 1.5,
        color: "var(--color-ink-2)",
        marginBottom: 36,
      }}>
        Iniciá sesión para acceder a tu guardarropa.
      </p>

      {/* ── Formulario ── */}
      <form onSubmit={handleSubmit} noValidate>
        <div style={{ display: "flex", flexDirection: "column", gap: 24, marginBottom: 28 }}>
          <Input
            type="email"
            label="Email"
            placeholder="tu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <Input
            type={showPassword ? "text" : "password"}
            label="Contraseña"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            suffix={
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                style={{ color: "var(--color-ink-3)", display: "flex", padding: 0, background: "none", border: "none", cursor: "pointer" }}
              >
                <EyeIcon off={showPassword} />
              </button>
            }
          />
        </div>

        {/* Olvidé mi contraseña */}
        <div style={{ textAlign: "right", marginBottom: 24 }}>
          <Link
            href="/recuperar-password"
            style={{
              fontSize: 12,
              color: "var(--color-ink-2)",
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            Olvidé mi contraseña
          </Link>
        </div>

        {/* Error + reenvío */}
        {error && (
          <div style={{ fontSize: 13, color: "var(--color-danger)", marginBottom: 16 }}>
            {error}
          </div>
        )}
        {showResend && (
          <button
            type="button"
            onClick={handleResendVerification}
            style={{
              display: "block",
              marginBottom: 16,
              fontSize: 12,
              color: "var(--color-accent)",
              textDecoration: "underline",
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
            }}
          >
            {resendSent ? "Email enviado ✓" : t("resendVerification")}
          </button>
        )}

        {/* CTA principal */}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            height: 54,
            borderRadius: 9999,
            background: loading ? "var(--color-ink-2)" : "var(--color-ink)",
            color: "var(--color-bg)",
            border: "none",
            fontFamily: "var(--font-sans)",
            fontSize: 13,
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            cursor: loading ? "not-allowed" : "pointer",
            transition: "background-color 150ms ease, transform 150ms ease",
          }}
        >
          {loading ? (
            <span style={{
              width: 18, height: 18, borderRadius: 999,
              border: "2px solid rgba(255,255,255,0.4)",
              borderTopColor: "#fff",
              animation: "spin 0.8s linear infinite",
              display: "inline-block",
            }} />
          ) : null}
          Ingresar
        </button>
      </form>

      {/* ── Divisor ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "24px 0" }}>
        <div style={{ flex: 1, height: 1, background: "var(--color-line)" }} />
        <span style={{
          fontSize: 10,
          color: "var(--color-ink-3)",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}>O</span>
        <div style={{ flex: 1, height: 1, background: "var(--color-line)" }} />
      </div>

      {/* ── Google ── */}
      <GoogleSignInButton label="Continuar con Google" />

      {/* ── Footer: registro ── */}
      <div style={{
        marginTop: "auto",
        textAlign: "center",
        fontSize: 12,
        color: "var(--color-ink-2)",
        paddingTop: 24,
      }}>
        ¿No tenés cuenta?{" "}
        <Link
          href="/registro"
          style={{
            color: "var(--color-ink)",
            fontWeight: 500,
            textDecoration: "underline",
            textUnderlineOffset: 3,
          }}
        >
          Registrate
        </Link>
      </div>
    </div>
  );
}
