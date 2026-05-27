import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "@/lib/i18n/routing";

/**
 * Configuración server-side de next-intl.
 * Este archivo es requerido por next-intl v4 y es detectado automáticamente.
 * Provee el locale y los mensajes para Server Components (getTranslations, getLocale).
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;

  // Usar el locale del request o caer al default (es)
  const locale = hasLocale(routing.locales, requested)
    ? requested!
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
