"use client";

/**
 * LOOKSI-030: Error boundary global — captura errores en el root layout.
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
        <title>Error · LookSi</title>
        <style>{`
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            min-height: 100dvh;
            background: #f7f5ef;
            color: #1a1a1a;
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
            color: #8a877f;
            margin-bottom: 32px;
          }
          h1 {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 12px;
          }
          p {
            font-size: 14px;
            color: #4a4a48;
            line-height: 1.5;
            margin-bottom: 32px;
          }
          .digest {
            font-family: ui-monospace, monospace;
            font-size: 11px;
            color: #8a877f;
            background: #e5e0d2;
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
            background: #1a1a1a;
            color: #f7f5ef;
            border: none;
            border-radius: 9999px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
          }
          button:hover { background: #2a2a28; }
        `}</style>
      </head>
      <body>
        <div className="card">
          <p className="wordmark">LookSi</p>
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
