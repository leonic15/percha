"use client";

import { createContext, useContext, type ReactNode } from "react";

/* ─────────────────────────────────────────────────────────────────────────
   CurrentUserProvider — datos de la cuenta logueada disponibles en cliente.

   Los datos se leen una sola vez en el layout de la app (server component)
   y se exponen por contexto para que cualquier client component del árbol
   (Sidebar, detalles de prenda/look, etc.) muestre nombre, email y foto
   reales sin refetchear.
   ───────────────────────────────────────────────────────────────────────── */

export type CurrentUser = {
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
};

const CurrentUserCtx = createContext<CurrentUser | null>(null);

export function CurrentUserProvider({
  user,
  children,
}: {
  user: CurrentUser | null;
  children: ReactNode;
}) {
  return <CurrentUserCtx.Provider value={user}>{children}</CurrentUserCtx.Provider>;
}

/** Devuelve la cuenta logueada, o null si no hay sesión / no hay provider. */
export function useCurrentUser(): CurrentUser | null {
  return useContext(CurrentUserCtx);
}
