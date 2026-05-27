"use client";

/**
 * LOOKSI-030: Error boundary de nivel locale.
 *
 * Captura errores de cualquier ruta bajo /[locale]/ que no tenga
 * su propio error.tsx. Incluye las rutas de autenticación y el layout
 * de la app si ocurre un error en Server Components del layout de locale.
 */

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { ErrorScreen } from "@/components/ui/ErrorScreen";

export default function LocaleError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: { boundary: "locale" },
      extra: { digest: error.digest },
    });
  }, [error]);

  return (
    <ErrorScreen
      digest={error.digest}
      onRetry={unstable_retry}
      showHome={true}
    />
  );
}
