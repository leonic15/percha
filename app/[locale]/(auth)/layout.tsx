/**
 * Layout compartido para las páginas de autenticación.
 * Centra el contenido vertical y horizontalmente, fondo bg-bg.
 * Las páginas bajo este layout: /login, /registro, /recuperar-password.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-sm">
        {children}
      </div>
    </div>
  );
}
