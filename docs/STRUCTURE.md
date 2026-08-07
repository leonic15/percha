# Estructura del proyecto Percha

> Generado como parte de PERCHA-026 (Setup inicial). Actualizar ante cambios estructurales.

## Árbol de carpetas

```
/
├── app/                              # App Router de Next.js 16
│   ├── [locale]/                     # Rutas internacionalizadas (es / en)
│   │   ├── (auth)/                   # Grupo: rutas públicas de autenticación
│   │   │   ├── login/
│   │   │   ├── registro/
│   │   │   └── recuperar-password/
│   │   ├── (app)/                    # Grupo: rutas protegidas (requieren sesión)
│   │   │   ├── guardarropas/         # EP-02: listado, detalle, agregar, editar
│   │   │   ├── looks/                # EP-04: historial, detalle de look
│   │   │   └── configuracion/        # EP-06: perfil, estilo, preferencias
│   │   ├── layout.tsx                # NextIntlClientProvider + ToastProvider
│   │   └── page.tsx                  # → redirect /guardarropas
│   ├── api/                          # API Routes (server-only, nunca exponen secrets)
│   │   ├── auth/                     # Endpoints de autenticación (Supabase server)
│   │   ├── prendas/                  # EP-02/03: CRUD prendas + análisis IA
│   │   ├── looks/                    # EP-04: generación y gestión de looks
│   │   └── clima/                    # EP-05: proxy Open-Meteo (sin API key)
│   ├── layout.tsx                    # Root layout: fuentes, metadata, viewport
│   └── page.tsx                      # → redirect /guardarropas
│
├── components/
│   ├── ui/                           # Componentes base del design system
│   │   ├── Button.tsx                # 5 variantes × 3 tamaños
│   │   ├── Input.tsx                 # + Textarea, underline-style + badge IA
│   │   ├── Badge.tsx                 # default | ai | success | warning | error
│   │   ├── Chip.tsx                  # Seleccionable (categorías, temporadas, etc.)
│   │   ├── GarmentCard.tsx           # Card 4:5 con toggle favorito
│   │   ├── LookCard.tsx              # Collage 2×2 + variante row
│   │   ├── BottomNav.tsx             # Navegación mobile fija (oculta en md+)
│   │   ├── Sidebar.tsx               # Navegación desktop sticky (visible en md+)
│   │   ├── Toast.tsx                 # ToastProvider + useToast()
│   │   ├── Skeleton.tsx              # GarmentGridSkeleton + LookListSkeleton
│   │   └── index.ts                  # Barrel export
│   └── features/                     # Componentes de dominio (por feature)
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts                 # createClient() — browser (SSR cookies)
│   │   └── server.ts                 # createClient() server + createServiceClient()
│   ├── utils/
│   │   └── logger.ts                 # logger JSON estructurado + hashUserId()
│   ├── i18n/
│   │   └── routing.ts                # defineRouting — locales, defaultLocale
│   └── cn.ts                         # Utility: class-name merge
│
├── i18n/
│   └── request.ts                    # getRequestConfig — config server-side next-intl
│
├── messages/
│   ├── es.json                       # Traducciones español (default)
│   └── en.json                       # Traducciones inglés
│
├── public/
│   ├── manifest.json                 # PWA manifest (nombre, colores, iconos, shortcuts)
│   └── icons/                        # Íconos PWA: 192/512, maskable, svg, shortcuts
│
├── supabase/
│   ├── migrations/                   # Migraciones SQL (PERCHA-027)
│   └── seed.sql                      # Datos iniciales (categorías, subcategorías)
│
├── docs/
│   ├── STRUCTURE.md                  # Este archivo
│   ├── design/
│   │   └── Handoff.html              # Developer handoff de Claude Design (16 pantallas)
│   └── stories/                      # Historias de usuario PERCHA-001 a PERCHA-032
│
├── middleware.ts                     # Auth (Supabase session) + i18n (next-intl)
├── next.config.ts                    # withNextIntl + withPWA + cabeceras HTTP
├── tsconfig.json                     # TypeScript config (@/ → root)
├── postcss.config.mjs               # Tailwind CSS v4
├── eslint.config.mjs                # ESLint
├── .env.example                      # Variables de entorno documentadas (sin valores)
└── .gitignore                        # node_modules, .env*.local, .next, PWA artifacts
```

## Convenciones

### Nombrado de archivos
| Tipo | Convención | Ejemplo |
|------|-----------|---------|
| Componentes React | PascalCase | `GarmentCard.tsx` |
| Utilidades / helpers | camelCase | `logger.ts`, `cn.ts` |
| API Routes | camelCase (carpeta) + `route.ts` | `app/api/prendas/route.ts` |
| Páginas Next.js | `page.tsx` / `layout.tsx` | — |
| Traducciones | camelCase anidado | `garment.analyzingWithAI` |

### Alias de importación
```ts
import { Button } from "@/components/ui"        // @/ = raíz del proyecto
import { createClient } from "@/lib/supabase/client"
import { logger } from "@/lib/utils/logger"
```

### Separación cliente / servidor
- `lib/supabase/client.ts` → solo en Client Components (`"use client"`)
- `lib/supabase/server.ts` → solo en Server Components y API Routes
- `lib/supabase/server.ts` → `createServiceClient()` solo en API Routes con permisos elevados
- Variables `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` → **nunca** con prefijo `NEXT_PUBLIC_`

### Estructura de API Route
```ts
// app/api/prendas/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { logger, hashUserId } from "@/lib/utils/logger"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  // ...
}
```
