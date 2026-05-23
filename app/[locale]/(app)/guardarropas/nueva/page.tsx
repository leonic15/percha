import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AddGarmentForm } from "@/components/features/wardrobe/AddGarmentForm";
import type { Category, Subcategory } from "@/lib/database.types";

/**
 * LOOKSI-009: Agregar prenda.
 * Server Component: carga categorías y subcategorías, renderiza el formulario cliente.
 */
export default async function NuevaPrendaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Cargar todas las categorías y subcategorías en paralelo
  const [{ data: categories }, { data: subcategories }] = await Promise.all([
    supabase.from("categories").select("id, nombre, slug").order("nombre"),
    supabase.from("subcategories").select("id, category_id, nombre, slug").order("nombre"),
  ]);

  return (
    <div className="px-4 pt-5 md:px-6 md:pt-8 max-w-lg mx-auto">
      {/* ── Encabezado ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/guardarropas"
          aria-label="Volver al guardarropas"
          className="grid place-items-center size-9 rounded-full hover:bg-surface-2 transition-colors text-ink-2"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="font-display font-semibold text-xl text-ink">Nueva prenda</h1>
      </div>

      {/* ── Formulario cliente ───────────────────────────────────────────── */}
      <AddGarmentForm
        categories={(categories ?? []) as Category[]}
        subcategories={(subcategories ?? []) as Subcategory[]}
      />
    </div>
  );
}
