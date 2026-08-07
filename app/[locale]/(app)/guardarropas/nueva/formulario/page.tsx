import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/lib/database.types";
import { AddFormClient } from "./AddFormClient";

/**
 * PERCHA-009 — Paso 3: Formulario de revisión.
 * Spec 10 · /guardarropas/nueva/formulario
 *
 * Server Component: carga categorías desde la DB y se las pasa al cliente.
 * El cliente lee la imagen y los resultados de IA desde sessionStorage.
 */
export default async function FormularioPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: categoriesData } = await supabase
    .from("categories")
    .select("id, nombre, slug")
    .order("nombre");

  return (
    <AddFormClient categories={(categoriesData ?? []) as Category[]} />
  );
}
