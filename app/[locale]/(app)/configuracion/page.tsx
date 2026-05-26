import { redirect } from "next/navigation";

/**
 * /configuracion → redirect to /perfil (canonical settings route per Handoff 16)
 * La Sidebar desktop también enlaza desde aquí; se unifica en /perfil.
 */
export default function ConfiguracionPage() {
  redirect("/perfil");
}
