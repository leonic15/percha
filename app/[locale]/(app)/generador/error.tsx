"use client";

/**
 * PERCHA-030: Error boundary — sección Generador de looks.
 *
 * Captura errores en la config del generador (/generador) y el resultado
 * (/generador/resultado), incluyendo errores de la API de Gemini y timeouts.
 * El usuario puede reintentar sin perder la app completa.
 */

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { ErrorScreen } from "@/components/ui/ErrorScreen";

export default function GeneratorError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: { boundary: "generator" },
      extra: { digest: error.digest },
    });
  }, [error]);

  return (
    <ErrorScreen
      title="Error al generar el look"
      description="El generador encontró un problema. Podés reintentar o armar el look manualmente desde el guardarropas."
      digest={error.digest}
      onRetry={unstable_retry}
      showHome={true}
    />
  );
}
