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
- ✅ LOOKSI-008 Listado grilla + filtros + búsqueda + infinite scroll → `app/[locale]/(app)/guardarropas/`
- ✅ LOOKSI-009 Agregar prenda (foto + compresión client-side + metadatos) → `app/[locale]/(app)/guardarropas/nueva/`
- ✅ LOOKSI-013 Toggle favorito → `app/api/garments/[id]/favorite/route.ts`
- ❌ LOOKSI-010 Ver detalle prenda
- ❌ LOOKSI-011 Editar prenda
- ❌ LOOKSI-012 Eliminar prenda

API: `app/api/garments/route.ts` (GET paginado + POST crear)
Storage: bucket `prendas`, path `{user_id}/{prenda_id}.{ext}`, signed URLs 1h

### ✅ Handoff 01 — Bienvenida — IMPLEMENTADA
- Ruta `/` → `app/[locale]/page.tsx`
- Mobile: eyebrow + H1 72px (clamp) + 2 GarmentImages rotados (camel/denim) + CTAs pill 54px
- Desktop: split grid `[1fr_1.2fr]` + mosaico 5 prendas
- `GarmentImage`: SVG pattern diagonal + label inferior (fiel a `screens-1.jsx` del prototipo)
- Loading: `app/[locale]/loading.tsx` — wordmark + spinner

### ❌ EP-03 — Análisis IA — NO IMPLEMENTADA
### ❌ EP-04 — Generación de looks — NO IMPLEMENTADA
### ❌ EP-05 — Clima — NO IMPLEMENTADA
### ❌ EP-06 — Preferencias/configuración — NO IMPLEMENTADA
### ❌ EP-07 — Infraestructura (CI/CD, observabilidad) — NO IMPLEMENTADA

## Componentes UI existentes
- `components/ui/BottomNav.tsx` — nav mobile fija (guardarropas / generador / looks / perfil)
- `components/ui/Sidebar.tsx` — nav desktop 240px fija + CTA agregar prenda
- `components/ui/ToastProvider.tsx` — toasts globales
- `components/features/wardrobe/WardrobeClient.tsx` — filtros, infinite scroll, optimistic favorite
- `components/features/wardrobe/AddGarmentForm.tsx` — nueva prenda con imagen y categorías

## Herramientas de desarrollo
- Dev server: `npm run dev` → puerto 3000
- Screenshots: `npx playwright screenshot --browser chromium --viewport-size 390,844 http://localhost:3000 /tmp/s.png`
- Type-check: `npx tsc --noEmit`
- Build: `npx next build`

## Próximos pasos
1. Completar EP-02: LOOKSI-010 (detalle), LOOKSI-011 (editar), LOOKSI-012 (eliminar)
2. Revisar pantallas auth (Handoff 02-04) vs prototipo
3. Ajuste desktop Handoff 01
4. Push a GitHub (repo solo local, sin remote)
5. Configurar Vercel + Google OAuth en Supabase (manual)
