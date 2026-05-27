"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

/**
 * LOOKSI-004: Nueva contraseña (fuera de [locale] — recibe el token de Supabase).
 * useSearchParams requiere Suspense boundary en Next.js App Router.
 */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <ResetPasswordContent />
    </Suspense>
  );
}

/* ── Spinner ─────────────────────────────────────────────────────────── */
function LoadingSpinner() {
  return (
    <div style={{
      minHeight: "100dvh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--color-bg)",
    }}>
      <div style={{
        width: 24, height: 24, borderRadius: 999,
        border: "2px solid rgba(26,26,26,0.15)",
        borderTopColor: "#1a1a1a",
        animation: "spin 0.8s linear infinite",
      }} />
    </div>
  );
}

/* ── EyeIcon ─────────────────────────────────────────────────────────── */
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

/* ── Estilos globales compartidos (spinner) ─────────────────────────── */
const RESET_CSS = `@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`;

/* ── Contenido principal ─────────────────────────────────────────────── */
function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const linkError = searchParams.get("error");

  const [password, setPassword]           = useState("");
  const [confirm, setConfirm]             = useState("");
  const [showPassword, setShowPassword]   = useState(false);
  const [showConfirm, setShowConfirm]     = useState(false);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState<string | null>(
    linkError === "link_expired" ? "El link expiró o ya fue utilizado." : null,
  );
  const [success, setSuccess]             = useState(false);
  const [hasSession, setHasSession]       = useState<boolean | null>(null);

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

  /* ── Link expirado o sin sesión ──────────────────────────────────── */
  if (linkError === "link_expired" || hasSession === false) {
    return (
      <div style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        paddingTop: 70,
        paddingBottom: 30,
        paddingLeft: 24,
        paddingRight: 24,
        background: "var(--color-bg)",
      }}>
        <style>{RESET_CSS}</style>

        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 24,
          textAlign: "center",
        }}>
          {/* Ícono de alerta */}
          <div style={{
            width: 48, height: 48, borderRadius: 999,
            background: "rgba(184,92,58,0.1)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto",
          }}>
            <span style={{ color: "var(--color-danger)", fontSize: 22, fontWeight: 600 }}>!</span>
          </div>

          <div>
            <h1 style={{
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              fontSize: 28,
              textTransform: "uppercase",
              color: "var(--color-ink)",
              marginBottom: 8,
            }}>
              Link expirado
            </h1>
            <p style={{ fontSize: 13, color: "var(--color-ink-2)", lineHeight: 1.5 }}>
              El link expiró o ya fue utilizado.<br />Solicitá uno nuevo.
            </p>
          </div>

          <button
            onClick={() => router.push("/recuperar-password")}
            style={{
              width: "100%",
              height: 54,
              borderRadius: 9999,
              background: "var(--color-ink)",
              color: "var(--color-bg)",
              border: "none",
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              cursor: "pointer",
            }}
          >
            Solicitar nuevo link
          </button>
        </div>
      </div>
    );
  }

  /* ── Cargando verificación de sesión ─────────────────────────────── */
  if (hasSession === null) return <LoadingSpinner />;

  /* ── Formulario nueva contraseña ─────────────────────────────────── */
  return (
    <div style={{
      minHeight: "100dvh",
      display: "flex",
      flexDirection: "column",
      paddingTop: 70,
      paddingBottom: 30,
      paddingLeft: 24,
      paddingRight: 24,
      background: "var(--color-bg)",
    }}>
      <style>{RESET_CSS}</style>

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
        Nueva<br />contraseña.
      </h1>
      <p style={{
        fontSize: 13,
        lineHeight: 1.5,
        color: "var(--color-ink-2)",
        marginBottom: 36,
      }}>
        Elegí una contraseña segura de al menos 8 caracteres.
      </p>

      {success ? (
        /* ── Éxito ── */
        <div style={{
          padding: 14,
          border: "1px dashed var(--color-line)",
          borderRadius: 4,
          fontSize: 12,
          color: "var(--color-ink-2)",
          lineHeight: 1.5,
        }}>
          <div style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: 9,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--color-ink-3)",
            marginBottom: 6,
          }}>
            LISTO
          </div>
          ¡Contraseña actualizada! Redirigiendo a tu guardarropa…
        </div>
      ) : (
        /* ── Formulario ── */
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: "flex", flexDirection: "column", gap: 24, marginBottom: 28 }}>
            <Input
              type={showPassword ? "text" : "password"}
              label="Nueva contraseña"
              placeholder="Mínimo 8 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
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
            <Input
              type={showConfirm ? "text" : "password"}
              label="Repetir contraseña"
              placeholder="Repetí la contraseña"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
              suffix={
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? "Ocultar contraseña" : "Ver contraseña"}
                  style={{ color: "var(--color-ink-3)", display: "flex", padding: 0, background: "none", border: "none", cursor: "pointer" }}
                >
                  <EyeIcon off={showConfirm} />
                </button>
              }
            />
          </div>

          {error && (
            <div style={{
              fontSize: 13,
              color: "var(--color-danger)",
              marginBottom: 16,
            }}>
              {error}
            </div>
          )}

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
              transition: "background-color 150ms ease",
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
            Actualizar contraseña
          </button>
        </form>
      )}

      {/* ── Footer ── */}
      {!success && (
        <div style={{
          marginTop: "auto",
          textAlign: "center",
          fontSize: 12,
          color: "var(--color-ink-2)",
          paddingTop: 24,
        }}>
          <Link
            href="/recuperar-password"
            style={{
              color: "var(--color-ink)",
              fontWeight: 500,
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            Solicitar un nuevo link
          </Link>
        </div>
      )}
    </div>
  );
}
