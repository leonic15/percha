# LookSi — Estado del proyecto

## Stack (no negociable)
- **Framework:** Next.js 16.2.6 App Router + React 19.2.4 + TypeScript 5 + Turbopack
- **Styling:** Tailwind CSS v4 — tokens en `@theme {}` en `globals.css`, **sin** `tailwind.config.js`
- **Backend/DB:** Supabase (PostgreSQL, Storage, Auth con @supabase/ssr)
- **IA:** Gemini 2.5 Flash-Lite — siempre desde API Routes (server-side). `GEMINI_API_KEY` nunca con prefijo `NEXT_PUBLIC_`
- **Clima:** Open-Meteo (desde backend)
- **Deploy:** Vercel free tier + GitHub Actions (aún no configurado)
- **i18n:** next-intl v4 — localePrefix: "as-needed", locale default `es` (sin prefijo en URL)
- **Middleware:** archivo `proxy.ts` (Next.js 16 renombró middleware.ts → proxy.ts). Exporta `proxy()` no `middleware()`

## Archivos clave
- `app/globals.css` — única fuente de tokens Tailwind v4
- `lib/database.types.ts` — tipos DB con `Relationships: []` en cada tabla y `Views/Functions: Record<string, never>` en schema public (requerido por supabase-js)
- `lib/supabase/server.ts` y `client.ts` — createClient con @supabase/ssr
- `app/layout.tsx` — carga fuentes Inter + Archivo Narrow via next/font
- `docs/design/Handoff.html` — spec de diseño de todas las pantallas
- `/Users/nico/Downloads/LookSi-2/LookSi.html` — prototipo visual interactivo (React inline). **Referencia visual autoritativa.** Ver: `components.jsx`, `screens-1.jsx`, `screens-2.jsx`, `screens-3.jsx`, `tokens.css`

## Tokens Tailwind v4 importantes
- `--font-display: var(--font-archivo)` → clase `font-display` = Archivo Narrow
- `--color-accent: var(--color-sage-600)` = `#6b7563` (verde oliva)
- `--color-bg: var(--color-stone-50)` = `#f7f5ef` (crema muy claro, parece blanco — es correcto)
- `--spacing-13: 52px` → clase `h-13`
- `--radius-button: 9999px` → clase `rounded-button` (pill)
- `--shadow-card: 0 1px 2px rgb(0 0 0 / 0.04), 0 4px 14px rgb(0 0 0 / 0.05)`
- `--text-sm: 12px`, `--text-base: 14px` (escala custom, diferente a Tailwind estándar)

## Seguridad (NUNCA violar)
- `SUPABASE_SERVICE_ROLE_KEY` y `GEMINI_API_KEY` solo en API Routes, NUNCA con `NEXT_PUBLIC_`
- userId en logs/analytics: siempre hash SHA-256, nunca el UUID real
- Email/nombre de usuario: nunca enviar a PostHog

## Estado de implementación (2026-05-23)

### ✅ EP-01 — Autenticación — COMPLETA (18 pts)
- LOOKSI-001 Registro email/password · LOOKSI-002 Login email/password
- LOOKSI-003 Login Google OAuth · LOOKSI-004 Recuperar contraseña
- LOOKSI-005 Edición perfil (diferido a settings) · LOOKSI-006 Cierre sesión global
- LOOKSI-007 Eliminación cuenta (diferido a settings)
- Rutas: `/login`, `/registro`, `/recuperar-password` — route group `app/[locale]/(auth)/`

### ⚠️ EP-02 — Guardarropas — PARCIAL
- ✅ LOOKSI-008 Listado grilla — Handoff 05 implementado:
  - Header sticky (wordmark + iconos, H1 36px "Guardarropa" + contador)
  - Category chips scroll horizontal sin scrollbar
  - Sub-bar: filtros activos + toggle grid/list
  - FAB 56px, right:20 bottom:108
  - Filtros como bottom sheet (slide-up 280ms, pending state, commit/discard)
  - Grilla 2/3/4/5 cols (mobile/md/lg/xl)
  → `components/features/wardrobe/WardrobeClient.tsx`
- ✅ LOOKSI-009 Agregar prenda — flujo 3 pasos con IA:
  - **Paso 1** `/guardarropas/nueva` — captura: dropzone + corner brackets + cámara/galería + sessionStorage
  - **Paso 2** `/guardarropas/nueva/analizar` — scan overlay animado + progress steps + Gemini 2.5 Flash-Lite
  - **Paso 3** `/guardarropas/nueva/formulario` — form con AI prefill + badges desaparecen al editar + color picker 12 colores
  - API `/api/prendas/analizar` — Gemini REST, devuelve nombre/categoría/color/estaciones/ocasiones/estilos/descripción
  - `/api/garments` POST actualizado — acepta `ia_analizada` + `ia_descripcion`
- ✅ LOOKSI-013 Toggle favorito → `app/api/garments/[id]/favorite/route.ts`
- ✅ LOOKSI-010 Ver detalle prenda — Handoff 11 implementado:
  - Hero full-width aspect 1/1.15 + floating top bar (back/heart/edit, glass 38px, blur 8px)
  - Dots de paginación · eyebrow categoría+color · H1 32px
  - AI description box (accent-tint + AIBadge + italic entre comillas)
  - Chips read-only: Temporada / Ocasión / Estilo (active)
  - Bloque "Usado en looks" (placeholder hasta EP-04)
  - Meta row: Agregada / Último uso (mono, DD·MMM·YY)
  - Danger CTA "Eliminar prenda" → confirm bottom sheet → soft-delete → redirect
  - Heart toggle optimistic con revert en error
  - Desktop: sidebar + breadcrumb + two-column (foto sticky left 50%)
  → `app/[locale]/(app)/guardarropas/[id]/page.tsx` + `components/features/wardrobe/GarmentDetailClient.tsx`
  → API: `app/api/garments/[id]/route.ts` (GET prenda+categoría+signedURL · DELETE soft)
- ❌ LOOKSI-011 Editar prenda
- ❌ LOOKSI-012 Eliminar prenda (interfaz — la lógica está en LOOKSI-010)

API: `app/api/garments/route.ts` (GET paginado + POST crear con ia fields)
Storage: bucket `prendas`, path `{user_id}/{prenda_id}.{ext}`, signed URLs 1h
SessionStorage keys: `looksi_nueva_imagen` (base64), `looksi_nueva_tipo` (MIME), `looksi_nueva_ia` (JSON análisis), `looksi_generar_result` (JSON look generado), `looksi_generar_params` (JSON params para regenerar)

### ✅ Handoff 01 — Bienvenida — IMPLEMENTADA
- Ruta `/` → `app/[locale]/page.tsx`
- Mobile: eyebrow + H1 72px (clamp) + 2 GarmentImages rotados (camel/denim) + CTAs pill 54px
- Desktop: split grid `[1fr_1.2fr]` + mosaico 5 prendas
- `GarmentImage`: SVG pattern diagonal + label inferior (fiel a `screens-1.jsx` del prototipo)
- Loading: `app/[locale]/loading.tsx` — wordmark + spinner

### ❌ EP-03 — Análisis IA — NO IMPLEMENTADA

### ⚠️ EP-04 — Generación de looks — PARCIAL
- ✅ LOOKSI-017 Generar look desde cero — Handoffs 12 + 13 implementados:
  - **Config** `/generador` — Handoff 12: wordmark + "PASO 1/2" eyebrow, H1 "Armemos tu look", weather widget (geo → `/api/clima` → Open-Meteo), chips ocasión single-select, textarea contexto, tiles "Desde cero"/"Con base", sticky CTA accent
  - **Con base**: bottom sheet picker de prendas con búsqueda (slide-up 280ms)
  - **Resultado** `/generador/resultado` — Handoff 13: AIBadge + meta + H1 nombre + descripción italic, version stepper, grid 2-col (md:4-col) prendas con swap decorativo, prendas faltantes, acciones "Otro" (regenera) + "Guardar look" (disabled pending LOOKSI-020)
  - **API clima**: `GET /api/clima?lat=&lon=` — proxy a Open-Meteo, cache 30min
  - **API generación**: `POST /api/looks/generar` — Gemini 2.5 Flash-Lite, metadatos sin imágenes, signed URLs resultado, logging ai_usage, timeout 20s
  - SessionStorage: `looksi_generar_result` + `looksi_generar_params`
  → `app/[locale]/(app)/generador/page.tsx`
  → `app/[locale]/(app)/generador/resultado/page.tsx`
  → `components/features/generator/GeneratorConfigClient.tsx`
  → `components/features/generator/GeneratorResultClient.tsx`
  → `app/api/clima/route.ts`
  → `app/api/looks/generar/route.ts`
- ❌ LOOKSI-018 Generar desde prenda base (flujo parcial en LOOKSI-017 — tile "Con base" funcional)
- ❌ LOOKSI-019 Revisar y ajustar look (swap por pieza, UI de botón swap implementado pero deshabilitado)
- ❌ LOOKSI-020 Guardar look (botón visible pero disabled)
- ✅ LOOKSI-035 Vestir mi look (pantallas 22-25):
  - Pantalla 22: botón "Vestir mi look" en resultado del generador (activo/disabled según perfil)
  - Pantalla 23: EscenarioSheet — ocasión pre-llenada + textarea escenario + "Generar imagen"
  - Pantalla 24: VestirGeneratingOverlay — spinner + dots animados
  - Pantalla 25: VestirResultScreen — imagen full-screen, "Guardar imagen" + "Generar otra versión"
  - Auto-save del look antes de generar; rate limit 3/día
  → `components/features/generator/GeneratorResultClient.tsx`
  → `app/api/looks/generar-imagen/route.ts`
  → `app/api/looks/guardar-imagen-vestir/route.ts`
- ✅ LOOKSI-036 Validación imagen con IA:
  - `POST /api/validar-imagen` — Gemini 2.5 Flash-Lite, tipo "prenda" | "foto_corporal"
  - Integrado en Paso 1 de agregar prenda; bottom sheet error bloqueante + advertencia no-bloqueante
  - Fail-open en timeout >5s o error de red
  → `app/api/validar-imagen/route.ts`
  → `app/[locale]/(app)/guardarropas/nueva/page.tsx`
### ❌ EP-05 — Clima — NO IMPLEMENTADA
### ❌ EP-06 — Preferencias/configuración — NO IMPLEMENTADA
### ❌ EP-07 — Infraestructura (CI/CD, observabilidad) — NO IMPLEMENTADA

## Componentes UI existentes
- `components/ui/BottomNav.tsx` — nav mobile fija (guardarropas / generador / looks / perfil)
- `components/ui/Sidebar.tsx` — nav desktop 240px fija + CTA agregar prenda
- `components/ui/Toast.tsx` — toasts globales (API: `toast.success/error/warning/info("msg")`)
- `components/features/wardrobe/WardrobeClient.tsx` — grilla redesign: header sticky, bottom sheet filtros, FAB, grid/list
- `components/features/wardrobe/AddGarmentForm.tsx` — LEGACY (reemplazado por flujo 3 pasos, mantener por si acaso)

## Herramientas de desarrollo
- Dev server: `npm run dev` → puerto 3000
- Screenshots: `npx playwright screenshot --browser chromium --viewport-size 390,844 http://localhost:3000 /tmp/s.png`
- Type-check: `npx tsc --noEmit`
- Build: `npx next build`

## Próximos pasos
1. Completar EP-02: LOOKSI-010 (detalle prenda — Handoff 11), LOOKSI-011 (editar), LOOKSI-012 (eliminar)
2. Revisar pantallas auth (Handoff 02-04) vs prototipo
3. Ajuste desktop Handoff 01
4. Push a GitHub (repo solo local, sin remote)
5. Configurar Vercel + Google OAuth en Supabase (manual)
