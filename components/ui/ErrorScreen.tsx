"use client";

/**
 * PERCHA-030: Pantalla de error genérica reutilizable en error boundaries.
 *
 * Se usa en app/global-error.tsx y en los error.tsx seccionales.
 * Muestra un mensaje amigable con opción de reintentar y, opcionalmente,
 * un botón para volver al inicio.
 */

import Link from "next/link";

interface ErrorScreenProps {
  title?: string;
  description?: string;
  digest?: string;
  onRetry?: () => void;
  showHome?: boolean;
}

export function ErrorScreen({
  title = "Algo salió mal",
  description = "Ocurrió un error inesperado. Ya lo registramos automáticamente.",
  digest,
  onRetry,
  showHome = true,
}: ErrorScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60dvh] px-6 py-12 text-center">
      {/* Ícono decorativo */}
      <div
        className="mb-6 text-4xl"
        role="img"
        aria-label="Error"
        style={{ lineHeight: 1 }}
      >
        ⚠️
      </div>

      <h2
        className="font-display font-bold mb-3"
        style={{ fontSize: "22px" }}
      >
        {title}
      </h2>

      <p className="text-base text-ink-2 mb-2 max-w-xs" style={{ maxWidth: 320 }}>
        {description}
      </p>

      {/* Error digest para soporte técnico */}
      {digest && (
        <p
          className="text-sm text-ink-3 mb-6"
          style={{ fontFamily: "ui-monospace, monospace", fontSize: "11px" }}
        >
          #{digest}
        </p>
      )}

      <div className="flex flex-col gap-3 w-full" style={{ maxWidth: 240, marginTop: digest ? 0 : 24 }}>
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center justify-center rounded-button font-medium text-base"
            style={{
              height: 48,
              background: "#1a1a1a",
              color: "#f7f5ef",
              border: "none",
              cursor: "pointer",
            }}
          >
            Reintentar
          </button>
        )}

        {showHome && (
          <Link
            href="/guardarropas"
            className="flex items-center justify-center rounded-button font-medium text-base"
            style={{
              height: 48,
              background: "transparent",
              color: "#1a1a1a",
              border: "1px solid rgba(26,26,26,0.15)",
            }}
          >
            Ir al guardarropas
          </Link>
        )}
      </div>
    </div>
  );
}
