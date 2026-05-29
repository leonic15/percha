"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Barra de progreso fina en la parte superior que aparece cuando el usuario
 * hace clic en un link de navegación interna y desaparece al completar.
 */
export function NavigationProgress() {
  const pathname        = usePathname();
  const [visible, setVisible] = useState(false);
  const currentPath     = useRef(pathname);

  // Mostrar al hacer clic en links internos
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || /^https?:\/\//.test(href) || href.startsWith("mailto:")) return;
      const targetPath = href.split("?")[0];
      if (targetPath === currentPath.current) return;
      setVisible(true);
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  // Ocultar cuando la navegación completa (pathname actualizado)
  useEffect(() => {
    currentPath.current = pathname;
    setVisible(false);
  }, [pathname]);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className="fixed top-0 inset-x-0 z-[100] h-[2px] bg-accent pointer-events-none origin-left"
      style={{ animation: "nav-progress 10s ease-out forwards" }}
    />
  );
}
