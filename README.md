# Percha

> Tu guardarropas inteligente — generá looks con IA según el clima y la ocasión.

Percha es una PWA mobile-first que te permite digitalizar tu ropa y generar outfits personalizados en segundos. La IA analiza cada prenda al agregarla y genera looks completos teniendo en cuenta el clima actual y la ocasión. También incluye un planificador de viajes que arma looks para cada día según el itinerario y el clima de destino.

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework | [Next.js 16.2.6](https://nextjs.org) — App Router + Turbopack |
| UI | [React 19.2.4](https://react.dev) + TypeScript 5 |
| Estilos | [Tailwind CSS v4](https://tailwindcss.com) (tokens en `@theme {}`) |
| Backend / DB | [Supabase](https://supabase.com) — PostgreSQL + Storage + Auth |
| IA (análisis) | [Gemini 2.5 Flash-Lite](https://ai.google.dev) via Google AI API |
| IA (generación de imágenes) | Gemini 3.x Flash/Pro Image (con fallback entre modelos) |
| Procesamiento de imágenes | [@imgly/background-removal](https://img.ly/products/background-removal) — remoción de fondo client-side |
| PWA | [@ducanh2912/next-pwa](https://github.com/DuCanhGH/next-pwa) |
| Clima | [Open-Meteo](https://open-meteo.com) (sin API key, proxy server-side) |
| i18n | [next-intl v4](https://next-intl-docs.vercel.app) — `es` (default) / `en` |
| Observabilidad | [Sentry](https://sentry.io) + logger JSON estructurado |
| Analytics | [PostHog](https://posthog.com) EU cloud |
| Deploy | [Vercel](https://vercel.com) free tier |

---

## Requisitos previos

- **Node.js** ≥ 20.x ([descargar](https://nodejs.org))
- **npm** ≥ 10.x (viene con Node)
- **Supabase CLI** ([instalación](https://supabase.com/docs/guides/cli/getting-started))
- **Docker Desktop** (para correr Supabase localmente) — [descargar](https://www.docker.com/products/docker-desktop/)
- Cuentas en servicios externos:
  - [Supabase](https://app.supabase.com) — proyecto creado
  - [Google AI Studio](https://aistudio.google.com) — API key de Gemini
  - [Sentry](https://sentry.io) — proyecto Next.js (opcional en dev)
  - [PostHog](https://app.posthog.com) — proyecto (opcional en dev)

---

## Instalación local

### 1. Clonar el repositorio

```bash
git clone <url-del-repo>
cd percha
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

```bash
cp .env.example .env.local
```

Abrí `.env.local` y completá cada variable. Ver [Variables de entorno](#variables-de-entorno) más abajo para la descripción de cada una.

### 4. Iniciar Supabase local

```bash
supabase start
```

Esto levanta PostgreSQL, Auth, Storage y Studio en Docker. Al terminar te muestra las URLs y keys locales:

```
API URL: http://127.0.0.1:54321
anon key: eyJhbGci...
service_role key: eyJhbGci...
Studio URL: http://127.0.0.1:54323
```

Actualizá `.env.local` con esos valores (reemplazando los de producción de Supabase).

### 5. Aplicar migraciones y seeds

```bash
npm run db:reset
```

Esto corre todas las migraciones de `supabase/migrations/` y el seed con categorías de prendas.

### 6. Iniciar el servidor de desarrollo

```bash
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000) en el navegador.

> **Dispositivos físicos en LAN:** cambiá `NEXT_PUBLIC_APP_URL` a tu IP local (ej: `http://192.168.1.X:3000`) para que los redirects OAuth funcionen desde el celular. La IP `192.168.1.111` está autorizada en `allowedDevOrigins` en `next.config.ts`; si tu IP es diferente, actualizala allí también.

---

## Variables de entorno

| Variable | Descripción | ¿Pública? |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | URL base de la app (para redirects OAuth) | ✅ |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key de Supabase (RLS protege los datos) | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key — solo en API Routes server-side | ❌ |
| `GEMINI_API_KEY` | API key de Google AI / Gemini | ❌ |
| `NEXT_PUBLIC_SENTRY_DSN` | DSN de Sentry para el cliente (browser) | ✅ |
| `SENTRY_DSN` | DSN de Sentry para el servidor (Node.js) | ❌ |
| `SENTRY_AUTH_TOKEN` | Token para subir source maps en CI/CD | ❌ |
| `NEXT_PUBLIC_POSTHOG_KEY` | API key de PostHog | ✅ |
| `NEXT_PUBLIC_POSTHOG_HOST` | Host de PostHog (usar EU: `https://eu.i.posthog.com`) | ✅ |

> **Seguridad:** `SUPABASE_SERVICE_ROLE_KEY` y `GEMINI_API_KEY` **nunca** deben tener el prefijo `NEXT_PUBLIC_` ni usarse en Client Components.

---

## Comandos disponibles

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo con Turbopack (puerto 3000) |
| `npm run build` | Build de producción |
| `npm run start` | Servidor de producción (requiere build previo) |
| `npm run lint` | ESLint |
| `npm run typecheck` | Verificación de tipos TypeScript sin emitir |
| `npm run db:reset` | Reinicia la DB local: re-corre migraciones + seed |
| `npm run db:seed` | Alias de `db:reset` (Supabase CLI unifica ambos) |

---

## Estructura del proyecto

Ver [docs/STRUCTURE.md](docs/STRUCTURE.md) para el árbol de carpetas completo con descripción de cada archivo relevante.

---

## Documentación adicional

| Documento | Descripción |
|---|---|
| [docs/STRUCTURE.md](docs/STRUCTURE.md) | Árbol de carpetas y convenciones de nombrado |
| [docs/conventions.md](docs/conventions.md) | Convenciones de código del proyecto |
| [docs/database/schema.md](docs/database/schema.md) | Schema de base de datos documentado |
| [docs/architecture/diagrama-arquitectura.md](docs/architecture/diagrama-arquitectura.md) | Diagrama de arquitectura (Mermaid) |
| [docs/architecture/adr/](docs/architecture/adr/) | Registros de decisiones arquitectónicas (ADRs) |
| [docs/stories/](docs/stories/) | Historias de usuario PERCHA-001 a PERCHA-036 |
| [docs/design/Handoff.html](docs/design/Handoff.html) | Handoff de diseño — 26 pantallas |

---

## Flujo de autenticación

La app usa Supabase Auth con dos providers:

1. **Email / password** — registro, login, recuperación de contraseña
2. **Google OAuth** — login con cuenta Google

El flujo OAuth requiere configurar en Supabase:
- **Redirect URL:** `<tu-dominio>/auth/callback`
- **Google OAuth app** en [Google Cloud Console](https://console.cloud.google.com)

Para producción en Vercel, agregar `https://tu-app.vercel.app/auth/callback` como Redirect URL en Supabase → Authentication → URL Configuration.

---

## Configurar Google OAuth (producción)

1. Ir a [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
2. Crear OAuth 2.0 Client ID → Web application
3. Authorized redirect URIs: `https://<ref>.supabase.co/auth/v1/callback`
4. Copiar Client ID y Client Secret
5. En Supabase → Authentication → Providers → Google: pegar las credenciales y activar

---

## Deploy en Vercel

1. Conectar el repositorio en [vercel.com](https://vercel.com)
2. En Settings → Environment Variables: agregar todas las variables de `.env.example`
3. El build corre automáticamente con cada push a `main`

> **Source maps de Sentry:** agregar `SENTRY_ORG`, `SENTRY_PROJECT` y `SENTRY_AUTH_TOKEN` como variables de entorno en Vercel para que se suban automáticamente en cada build.

---

## Licencia

Propietario — todos los derechos reservados.
