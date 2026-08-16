"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shirt, Sparkles, Layers, Luggage, User, Plus, Settings } from "lucide-react";
import { cn } from "@/lib/cn";
import { getInitials } from "@/lib/utils/initials";
import { useCurrentUser } from "@/components/providers/CurrentUserProvider";

/* ─────────────────────────────────────────────────────────────────────────
   Sidebar — fija en desktop (md+).

   Layout: 240px ancho, full height. Logo arriba, nav en el medio,
   perfil + ajustes abajo. Variantes:
   • collapsed (lg <): solo iconos (64px). [opcional, no implementado por
     simplicidad — usar tw breakpoint lg: para volver al ancho completo]
   ───────────────────────────────────────────────────────────────────────── */

const NAV_ITEMS = [
  { href: "/guardarropas", label: "Guardarropas", icon: Shirt },
  { href: "/generador",    label: "Generador",    icon: Sparkles },
  { href: "/looks",        label: "Looks",        icon: Layers },
  { href: "/viajes",       label: "Viajes",       icon: Luggage },
  { href: "/perfil",       label: "Perfil",       icon: User },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const user = useCurrentUser();

  // Nombre a mostrar: nombre del perfil → parte local del email → genérico
  const displayName =
    user?.fullName?.trim() || user?.email?.split("@")[0] || "Mi cuenta";

  return (
    <aside
      aria-label="Navegación principal"
      className={cn(
        "hidden md:flex sticky top-0 h-screen w-60 shrink-0 overflow-y-auto",
        "flex-col bg-bg border-r border-line-2",
        "px-6 py-8",
      )}
    >
      {/* wordmark */}
      <Link
        href="/"
        className="font-display font-bold text-2xl uppercase tracking-[0.08em] text-ink mb-12"
      >
        Percha<span className="text-accent">.</span>
      </Link>

      {/* primary CTA */}
      <Link
        href="/guardarropas/nueva"
        className={cn(
          "mb-8 inline-flex w-full items-center justify-center gap-2",
          "rounded-button font-sans font-medium uppercase tracking-wide text-sm h-11 px-5",
          "bg-accent text-accent-ink hover:bg-sage-800 dark:hover:bg-sage-300",
          "transition-[transform,background-color,opacity] duration-150 ease-out-soft",
          "active:scale-[0.985]",
        )}
      >
        <Plus className="size-4" aria-hidden />
        Agregar prenda
      </Link>

      {/* nav */}
      <ul className="space-y-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname?.startsWith(href) ?? false;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors",
                  active
                    ? "bg-surface text-ink font-medium"
                    : "text-ink-2 hover:bg-surface hover:text-ink",
                )}
              >
                <Icon className="size-4.5" strokeWidth={active ? 1.8 : 1.4} aria-hidden />
                <span>{label}</span>
                {active && <span className="ml-auto size-1.5 rounded-full bg-accent" />}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* spacer */}
      <div className="flex-1" />

      {/* footer / settings */}
      <Link
        href="/perfil"
        className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-ink-2 hover:bg-surface hover:text-ink"
      >
        <Settings className="size-4.5" strokeWidth={1.4} aria-hidden />
        <span>Configuración</span>
      </Link>

      {user && (
        <div className="mt-3 pt-3 border-t border-line-2">
          <Link
            href="/perfil"
            className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-surface"
          >
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatarUrl}
                alt=""
                className="size-9 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="size-9 shrink-0 rounded-full bg-accent text-accent-ink grid place-items-center font-display font-semibold text-sm">
                {getInitials(user.fullName, user.email)}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-sm font-medium text-ink truncate">{displayName}</div>
              <div className="text-xs text-ink-3 truncate">{user.email}</div>
            </div>
          </Link>
        </div>
      )}
    </aside>
  );
}
