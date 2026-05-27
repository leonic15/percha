"use client";

/**
 * LOOKSI-030: Error boundary — sección Guardarropas.
 *
 * Captura errores en el listado de prendas, detalle, nueva prenda
 * (incluyendo el flujo de análisis IA en /guardarropas/nueva/*).
 * El usuario ve un mensaje amigable sin que toda la app se rompa.
 */

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { ErrorScreen } from "@/components/ui/ErrorScreen";

export default function WardrobeError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: { boundary: "wardrobe" },
      extra: { digest: error.digest },
    });
  }, [error]);

  return (
    <ErrorScreen
      title="Error en el guardarropas"
      description="No pudimos cargar esta sección. Podés reintentar o volver al inicio."
      digest={error.digest}
      onRetry={unstable_retry}
      showHome={true}
    />
  );
}
