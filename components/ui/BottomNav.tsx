"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shirt, Sparkles, Layers, User } from "lucide-react";
import { cn } from "@/lib/cn";

/* ─────────────────────────────────────────────────────────────────────────
   BottomNav — fija en mobile, oculta en desktop (md+ usa <Sidebar/>).

   Reglas de design:
   • Altura 60px + 24px safe-area bottom.
   • Touch targets >= 44px (cada item es 60×60).
   • Item activo: ink sólido + barra superior 2px ancho 18px.
   ───────────────────────────────────────────────────────────────────────── */

const NAV_ITEMS = [
  { href: "/guardarropa", label: "Guardarropa", icon: Shirt },
  { href: "/generador",   label: "Generador",   icon: Sparkles },
  { href: "/looks",       label: "Looks",       icon: Layers },
  { href: "/perfil",      label: "Perfil",      icon: User },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegación principal"
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 md:hidden",
        "bg-bg/90 backdrop-blur-md border-t border-line-2",
        "pb-[max(env(safe-area-inset-bottom),16px)]",
      )}
    >
      <ul className="flex justify-around px-2 pt-2.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname?.startsWith(href) ?? false;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex flex-col items-center gap-1 px-3 py-1.5 min-w-[60px]",
                  active ? "text-ink" : "text-ink-3 hover:text-ink-2",
                )}
              >
                {active && (
                  <span className="absolute top-[-10px] h-0.5 w-4.5 bg-ink rounded-full" />
                )}
                <Icon
                  className="size-5"
                  strokeWidth={active ? 1.8 : 1.4}
                  aria-hidden
                />
                <span className="text-[9px] font-medium uppercase tracking-wider">
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
