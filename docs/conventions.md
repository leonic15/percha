# Convenciones de código — Percha

> Este documento define las reglas que aplican a todo el código del proyecto. Seguirlas garantiza consistencia y facilita el mantenimiento.

---

## 1. Nombrado de archivos y carpetas

| Tipo | Convención | Ejemplo |
|---|---|---|
| Componentes React | PascalCase | `GarmentCard.tsx` |
| Páginas Next.js | kebab-case (carpeta) + `page.tsx` | `app/[locale]/(app)/guardarropas/page.tsx` |
| API Routes | kebab-case (carpeta) + `route.ts` | `app/api/prendas/analizar/route.ts` |
| Utilidades / helpers | camelCase | `logger.ts`, `cn.ts` |
| Archivos de config | kebab-case | `next.config.ts`, `eslint.config.mjs` |
| Carpetas de features | kebab-case | `components/features/wardrobe/` |
| Traducciones (i18n) | camelCase anidado | `es.json` → `garment.analyzingWithAI` |
| Migraciones SQL | `<timestamp>_<descripcion>.sql` | `20260523000000_initial_schema.sql` |

### Grupos de rutas Next.js (route groups)

Los paréntesis en carpetas de rutas son grupos y no aparecen en la URL:

```
app/[locale]/(auth)/login/page.tsx   → URL: /login
app/[locale]/(app)/guardarropas/     → URL: /guardarropas  (requiere sesión)
```

---

## 2. Estructura de componentes

### Componentes de UI (`components/ui/`)

Componentes base del design system. Sin lógica de negocio, sin llamadas a API.

```tsx
// components/ui/Button.tsx
interface ButtonProps {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline"
  size?: "sm" | "md" | "lg"
  loading?: boolean
  children: React.ReactNode
}

export function Button({ variant = "primary", size = "md", loading, children, ...props }: ButtonProps) {
  // ...
}
```

### Componentes de feature (`components/features/<dominio>/`)

Contienen lógica de negocio. Se dividen en:

- **`<Feature>Client.tsx`** — Client Component (`"use client"`). Maneja estado, interacciones, llamadas a la API del cliente.
- **`<Feature>Page.tsx`** o directamente `page.tsx` — Server Component. Fetch de datos inicial, pasa datos al Client Component vía props.

```tsx
// app/[locale]/(app)/guardarropas/page.tsx  ← Server Component
import { WardrobeClient } from "@/components/features/wardrobe/WardrobeClient"

export default async function GuardarropasPage() {
  const supabase = await createClient()
  const prendas = await fetchPrendas(supabase)
  return <WardrobeClient initialData={prendas} />
}
```

```tsx
// components/features/wardrobe/WardrobeClient.tsx  ← Client Component
"use client"

export function WardrobeClient({ initialData }: { initialData: Prenda[] }) {
  const [prendas, setPrendas] = useState(initialData)
  // ...
}
```

---

## 3. Alias de importación

Usar siempre `@/` para importar desde la raíz del proyecto:

```ts
// ✅ Correcto
import { Button } from "@/components/ui"
import { createClient } from "@/lib/supabase/client"
import { logger, hashUserId } from "@/lib/utils/logger"
import { cn } from "@/lib/cn"

// ❌ Evitar rutas relativas largas
import { Button } from "../../../components/ui"
```

Barrel exports en `components/ui/index.ts`:

```ts
export { Button } from "./Button"
export { Input, Textarea } from "./Input"
// ...
```

---

## 4. Separación cliente / servidor

### Regla fundamental

| Recurso | Client Component | Server Component | API Route |
|---|---|---|---|
| `lib/supabase/client.ts` | ✅ | ❌ | ❌ |
| `lib/supabase/server.ts` (`createClient`) | ❌ | ✅ | ✅ |
| `lib/supabase/server.ts` (`createServiceClient`) | ❌ | ❌ | ✅ (con cuidado) |
| `GEMINI_API_KEY` | ❌ | ❌ | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ | ❌ | ✅ |

### Verificar autenticación siempre en el servidor

```ts
// app/api/prendas/route.ts
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
```

Nunca confiar en datos del cliente para saber si el usuario está autenticado.

---

## 5. Estructura de API Routes

Patrón estándar para toda API Route:

```ts
// app/api/<recurso>/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { logger, hashUserId } from "@/lib/utils/logger"

export async function GET(req: NextRequest) {
  // 1. Autenticación
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // 2. Validación de parámetros (Zod)
  const { searchParams } = req.nextUrl
  // ...

  // 3. Lógica de negocio
  const { data, error } = await supabase.from("...").select("...")

  // 4. Logging estructurado
  if (error) {
    logger.error("Error al obtener recurso", { userId: hashUserId(user.id), error: error.message })
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }

  // 5. Respuesta
  return NextResponse.json({ data })
}
```

---

## 6. Manejo de errores

### En API Routes

- Siempre retornar `{ error: "mensaje" }` con el status HTTP correcto
- Loggear el error antes de retornar con `logger.error()`
- No exponer detalles del error de DB al cliente (ej: nombres de columnas, SQL)

```ts
// ✅ Correcto
return NextResponse.json({ error: "Prenda no encontrada" }, { status: 404 })

// ❌ Evitar
return NextResponse.json({ error: error.message })  // puede exponer SQL
```

### En Client Components

- Usar el sistema de toasts para errores de usuario:

```ts
import { useToast } from "@/components/ui/Toast"

const { toast } = useToast()
toast.error("No se pudo guardar la prenda")
```

- Para errores críticos de render, las rutas protegidas tienen un `ErrorBoundary` global.

### Logging estructurado

```ts
import { logger, hashUserId } from "@/lib/utils/logger"

// ✅ Siempre hashear el userId
logger.info("Prenda creada", { userId: hashUserId(user.id), prendaId: prenda.id })

// ❌ Nunca loggear el UUID real ni datos personales
logger.info("Prenda creada", { userId: user.id, email: user.email })
```

---

## 7. Patrones de llamadas a API (cliente)

### Fetch desde Client Components

```ts
// Patrón: fetch con manejo de errores y loading state
const [loading, setLoading] = useState(false)

async function handleSubmit(data: FormData) {
  setLoading(true)
  try {
    const res = await fetch("/api/prendas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const { error } = await res.json()
      throw new Error(error ?? "Error desconocido")
    }
    const result = await res.json()
    // éxito
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Error al guardar")
  } finally {
    setLoading(false)
  }
}
```

### Optimistic updates

Para acciones rápidas (toggle favorito, eliminar) se actualiza el estado local inmediatamente y se revierte si falla el servidor:

```ts
// Guardar estado previo para revertir
const prev = prendas
setPrendas(prendas.map(p => p.id === id ? { ...p, is_favorite: !p.is_favorite } : p))

const res = await fetch(`/api/garments/${id}/favorite`, { method: "PATCH" })
if (!res.ok) {
  setPrendas(prev)  // revertir
  toast.error("No se pudo actualizar el favorito")
}
```

---

## 8. Convenciones de i18n (next-intl)

### Agregar traducciones

1. Agregar la clave en `messages/es.json` (idioma principal)
2. Agregar la misma clave en `messages/en.json`
3. Usar estructura anidada por dominio:

```json
// messages/es.json
{
  "garment": {
    "add": "Agregar prenda",
    "analyzingWithAI": "Analizando con IA...",
    "errors": {
      "notFound": "Prenda no encontrada"
    }
  }
}
```

### Usar traducciones en componentes

```tsx
// Client Component
"use client"
import { useTranslations } from "next-intl"

export function GarmentCard() {
  const t = useTranslations("garment")
  return <button>{t("add")}</button>
}
```

```tsx
// Server Component
import { getTranslations } from "next-intl/server"

export default async function Page() {
  const t = await getTranslations("garment")
  return <h1>{t("add")}</h1>
}
```

### Rutas localizadas

Las rutas en `(auth)` y `(app)` se manejan sin prefijo de locale para `es` (default). El middleware en `proxy.ts` gestiona la detección y redirección automática.

---

## 9. Estilos con Tailwind CSS v4

### Tokens personalizados

Todos los tokens están en `app/globals.css` en el bloque `@theme {}`. **No usar `tailwind.config.js`**.

```css
/* app/globals.css */
@theme {
  --color-accent: var(--color-sage-600);  /* #6b7563 */
  --font-display: var(--font-archivo);
  --radius-button: 9999px;
}
```

Uso en componentes:

```tsx
<button className="bg-accent text-white rounded-button font-display">
  Guardar
</button>
```

### Escala tipográfica personalizada

La escala de Percha difiere de la de Tailwind estándar:

| Clase | Tamaño |
|---|---|
| `text-sm` | 12px |
| `text-base` | 14px |
| `text-lg` | 16px |

### Componentes condicionales

Usar `cn()` (wrapper de clsx) para clases condicionales:

```tsx
import { cn } from "@/lib/cn"

<div className={cn("rounded-card p-4", isActive && "bg-accent/10", className)} />
```

---

## 10. TypeScript

- **Strict mode** habilitado (`tsconfig.json`)
- Preferir tipos explícitos sobre `any`
- Los tipos de la DB vienen de `lib/database.types.ts` — no definir tipos de tabla manualmente
- Usar `z.infer<typeof schema>` de Zod para tipos de formularios y respuestas de API

```ts
import { z } from "zod"

const PrendaSchema = z.object({
  nombre: z.string().min(1),
  category_id: z.number().int().positive(),
})

type PrendaInput = z.infer<typeof PrendaSchema>
```

---

## 11. Seguridad

| Regla | Razón |
|---|---|
| `GEMINI_API_KEY` solo en API Routes | Nunca exponer al cliente |
| `SUPABASE_SERVICE_ROLE_KEY` solo en API Routes | Bypasea RLS — peligroso en cliente |
| `userId` en logs: siempre `hashUserId(user.id)` | Privacidad — SHA-256 del UUID |
| Email/nombre: nunca a PostHog | GDPR / privacidad de datos |
| Validar con Zod en API Routes | No confiar en el input del cliente |
| RLS habilitado en todas las tablas | Seguridad por defecto en la DB |
