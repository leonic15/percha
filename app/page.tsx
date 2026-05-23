import { redirect } from "next/navigation";

// La raíz redirige al locale default (es), que el middleware maneja
export default function RootPage() {
  redirect("/guardarropas");
}
