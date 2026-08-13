"use client";

/**
 * PERCHA-030: Error boundary global — captura errores en el root layout.
 *
 * Se activa cuando el root layout (app/layout.tsx) o cualquier componente
 * sin error boundary propio lanza un error. Debe incluir sus propias
 * etiquetas <html> y <body> porque reemplaza el layout completo.
 *
 * Docs: node_modules/next/dist/docs/01-app/01-getting-started/10-error-handling.md
 */

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // Reportar a Sentry con contexto adicional
    Sentry.captureException(error, {
      tags: { boundary: "global" },
      extra: { digest: error.digest },
    });
  }, [error]);

  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Error · Percha</title>
        <style>{`
          /* Este boundary reemplaza el <html> raíz, así que no recibe el
             bootstrap de tema ni globals.css: define sus propios tokens y
             sigue a prefers-color-scheme (PERCHA-025). */
          :root {
            color-scheme: light dark;
            --bg: #f7f5ef; --ink: #1a1a1a; --ink-2: #4a4a48; --ink-3: #66635b;
            --surface-2: #e5e0d2; --btn-hover: #4a4a48;
          }
          @media (prefers-color-scheme: dark) {
            :root {
              --bg: #0d0c0a; --ink: #f1ede5; --ink-2: #b8b3a8; --ink-3: #98948a;
              --surface-2: #2e2b25; --btn-hover: #b8b3a8;
            }
          }
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            min-height: 100dvh;
            background: var(--bg);
            color: var(--ink);
            font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
          }
          .card {
            max-width: 360px;
            width: 100%;
            text-align: center;
          }
          .wordmark {
            font-size: 11px;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            color: var(--ink-3);
            margin-bottom: 32px;
          }
          h1 {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 12px;
          }
          p {
            font-size: 14px;
            color: var(--ink-2);
            line-height: 1.5;
            margin-bottom: 32px;
          }
          .digest {
            font-family: ui-monospace, monospace;
            font-size: 11px;
            color: var(--ink-3);
            background: var(--surface-2);
            border-radius: 6px;
            padding: 4px 8px;
            margin-top: -20px;
            margin-bottom: 32px;
            display: inline-block;
          }
          button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            height: 48px;
            padding: 0 28px;
            background: var(--ink);
            color: var(--bg);
            border: none;
            border-radius: 9999px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
          }
          button:hover { background: var(--btn-hover); }
        `}</style>
      </head>
      <body>
        <div className="card">
          <p className="wordmark">Percha</p>
          <h1>Algo salió mal</h1>
          <p>
            Ocurrió un error inesperado. Ya lo registramos automáticamente.
            Podés intentar recargar la página.
          </p>
          {error.digest && (
            <p className="digest">#{error.digest}</p>
          )}
          <button onClick={() => unstable_retry()}>
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
