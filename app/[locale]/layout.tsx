import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/lib/i18n/routing";
import { ToastProvider } from "@/components/ui";
import { PosthogProvider } from "@/components/providers/PosthogProvider";
import { createClient } from "@/lib/supabase/server";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // getMessages() delega al i18n/request.ts — fuente única de mensajes
  const messages = await getMessages();

  // Obtener userId para identificación anónima en PostHog.
  // Se usa getUser() (no solo getSession()) para validar el JWT contra Supabase.
  // En páginas públicas y auth, user será null → PostHog trackea como anónimo.
  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    // En caso de error de red/config, continuar sin identificación
  }

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <PosthogProvider userId={userId}>
        <ToastProvider>{children}</ToastProvider>
      </PosthogProvider>
    </NextIntlClientProvider>
  );
}
