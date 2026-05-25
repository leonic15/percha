"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui";

/**
 * LOOKSI-004: Recuperación de contraseña — Handoff 04
 * Estado 1: Formulario de email
 * Estado 2: Email enviado → subtítulo + nota dashed (siempre el mismo
 *           mensaje independientemente de si el email existe — seguridad)
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

/* ── Page ────────────────────────────────────────────────────────────── */
export default function RecuperarPasswordPage() {
  const [email, setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      // Siempre mostrar el estado "enviado" (no revelar si el email existe)
      setSent(true);
    } catch {
      setError("Ocurrió un error de red. Por favor intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      paddingTop: 70,
      paddingBottom: 30,
      paddingLeft: 24,
      paddingRight: 24,
    }}>

      {/* ── Barra superior: solo botón atrás ── */}
      <div style={{ marginBottom: 48 }}>
        <Link href="/login" style={{ color: "var(--color-ink-2)", display: "inline-flex" }}>
          <BackIcon />
        </Link>
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
        Recuperar<br />acceso.
      </h1>

      {sent ? (
        /* ── Estado 2: email enviado ─────────────────────────────── */
        <>
          <p style={{
            fontSize: 13,
            lineHeight: 1.5,
            color: "var(--color-ink-2)",
            marginBottom: 28,
          }}>
            Te enviamos un link al email para crear una nueva contraseña.
          </p>

          {/* Nota dashed — fiel al prototipo ScreenForgot */}
          <div style={{
            padding: 14,
            border: "1px dashed var(--color-line)",
            borderRadius: 4,
            fontSize: 12,
            color: "var(--color-ink-2)",
            lineHeight: 1.5,
            marginBottom: 28,
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
              NOTA
            </div>
            Revisá la carpeta de spam si no llega en 2 minutos.
          </div>

          <div style={{
            marginTop: "auto",
            textAlign: "center",
            fontSize: 12,
            color: "var(--color-ink-2)",
          }}>
            <Link
              href="/login"
              style={{
                color: "var(--color-ink)",
                fontWeight: 500,
                textDecoration: "underline",
                textUnderlineOffset: 3,
              }}
            >
              Volver al inicio de sesión
            </Link>
          </div>
        </>
      ) : (
        /* ── Estado 1: formulario ─────────────────────────────────── */
        <>
          <p style={{
            fontSize: 13,
            lineHeight: 1.5,
            color: "var(--color-ink-2)",
            marginBottom: 36,
          }}>
            Ingresá tu email y te enviamos un link para crear una nueva contraseña.
          </p>

          <form onSubmit={handleSubmit} noValidate>
            <div style={{ marginBottom: 28 }}>
              <Input
                type="email"
                label="Email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
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

            {/* CTA principal */}
            <button
              type="submit"
              disabled={loading || !email}
              style={{
                width: "100%",
                height: 54,
                borderRadius: 9999,
                background: (loading || !email) ? "var(--color-ink-2)" : "var(--color-ink)",
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
                cursor: (loading || !email) ? "not-allowed" : "pointer",
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
              Enviar link
            </button>
          </form>
        </>
      )}
    </div>
  );
}
