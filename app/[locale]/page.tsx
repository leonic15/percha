import { redirect } from "next/navigation";

/**
 * Página raíz del locale — redirige al guardarropas (ruta protegida).
 * Si el usuario no está autenticado, el middleware lo lleva a /login.
 */
export default function HomePage() {
  redirect("/guardarropas");
}
