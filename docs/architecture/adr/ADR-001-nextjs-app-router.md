# ADR-001 — Elección de Next.js App Router

**Fecha:** 2026-05-01  
**Estado:** Aceptado  
**Historia relacionada:** LOOKSI-026 (Setup inicial)

---

## Contexto

Se necesitaba un framework React para construir una PWA con rutas protegidas por autenticación, internacionalización (es/en), Server Side Rendering para SEO y buen rendimiento en mobile. El proyecto requería también integración con Supabase Auth (cookies de sesión), API Routes server-side para no exponer secrets al cliente, y un sistema de estilos moderno.

Las alternativas consideradas fueron:

1. **Next.js 16 App Router** — framework full-stack con React Server Components, file-system routing, API Routes integradas y soporte oficial de Vercel.
2. **Next.js Pages Router** — versión anterior del routing de Next.js, más madura pero con menor soporte de React 19 y Server Components.
3. **Remix** — framework full-stack con modelo de datos vía loaders/actions, buena integración con Supabase.
4. **Vite + React SPA** — solo cliente, requeriría backend separado para las API Routes y no soporta SSR nativamente.

---

## Decisión

Se eligió **Next.js 16 App Router** con Turbopack como bundler.

---

## Justificación

### A favor

- **React Server Components**: permite fetch de datos directamente en componentes de servidor sin exponer secrets al cliente. Ideal para cargar el guardarropa inicial sin una API Route adicional.
- **API Routes integradas**: Gemini y la service role key de Supabase nunca salen del servidor. Sin backend separado que mantener.
- **Turbopack**: builds de desarrollo significativamente más rápidos que webpack. Crítico en un proyecto con muchos componentes y estilos.
- **`@supabase/ssr`**: librería oficial de Supabase diseñada específicamente para Next.js App Router — manejo transparente de cookies de sesión en Server Components, Client Components y middleware.
- **next-intl v4**: soporte nativo de App Router con `localePrefix: "as-needed"` — URLs limpias sin prefijo `/es/` para el idioma default.
- **next-pwa**: plugin de Workbox para App Router — genera Service Worker y manifest PWA sin configuración manual.
- **Vercel**: plataforma de deploy diseñada para Next.js. Variables de entorno, preview deployments y analytics sin configuración adicional.

### Consideraciones

- **Complejidad del App Router**: la distinción Server/Client Component requiere disciplina. Mitigado con convenciones documentadas en `docs/conventions.md`.
- **Renombrado de `middleware.ts` → `proxy.ts`**: Next.js 16 cambió la convención de nombrado. Documentado en `CLAUDE.md` y `PROJECT.md`.
- **Turbopack + CSS de Tailwind**: Turbopack inyecta el CSS via JS en lugar de un archivo `.css` — puede causar FOUC en redes lentas. Mitigado con un bloque `<style>` crítico incrustado en `layout.tsx`.

---

## Consecuencias

- Toda la lógica de negocio sensible (llamadas a Gemini, service role de Supabase) permanece en el servidor.
- El middleware (`proxy.ts`) corre en Edge Runtime — limitaciones: no puede usar Node.js APIs, solo Web APIs.
- Los Client Components solo pueden importar desde `lib/supabase/client.ts`, nunca desde `server.ts`.
