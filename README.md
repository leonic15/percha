# Percha

> Tu guardarropas inteligente — generá looks con IA según el clima y la ocasión.

Percha es una PWA mobile-first para digitalizar tu ropa y armar outfits en segundos. La IA analiza cada prenda al agregarla, genera looks completos considerando el clima y la ocasión, puede mostrarte el look puesto sobre tu propia foto, y arma la maleta de un viaje día por día según el itinerario y los destinos.

---

## Índice

- [Funcionalidades](#funcionalidades)
- [Stack tecnológico](#stack-tecnológico)
- [Arquitectura](#arquitectura)
- [Requisitos previos](#requisitos-previos)
- [Instalación local](#instalación-local)
- [Variables de entorno](#variables-de-entorno)
- [Comandos disponibles](#comandos-disponibles)
- [Estructura del proyecto](#estructura-del-proyecto)
- [API Routes](#api-routes)
- [Modelo de datos](#modelo-de-datos)
- [Uso de IA](#uso-de-ia)
- [Seguridad](#seguridad)
- [Observabilidad y analytics](#observabilidad-y-analytics)
- [PWA y caching](#pwa-y-caching)
- [i18n y tema](#i18n-y-tema)
- [CI/CD y deploy](#cicd-y-deploy)
- [Documentación adicional](#documentación-adicional)

---

## Funcionalidades

### Guardarropas (`/guardarropas`)
- Alta de prendas con foto: compresión client-side, remoción de fondo en el navegador (WASM) y validación previa con IA de que la imagen realmente muestra una prenda.
- Análisis automático con Gemini: nombre, categoría, color, estaciones, ocasiones, estilos y descripción, todo editable antes de guardar. Reintento manual si el análisis falla.
- Listado con búsqueda (índices trigram en `nombre`, `color_principal`, `notas`), filtros por categoría y favoritos.
- Detalle, edición y borrado lógico (`deleted_at`) para no romper el historial de looks.

### Generador de looks (`/generador`)
- Dos modos: desde cero o partiendo de una prenda base.
- Contexto de generación: ocasión, texto libre del usuario, clima actual y preferencias de estilo del perfil.
- Sólo se mandan metadatos textuales al modelo (no imágenes) → menos costo y latencia. Los IDs devueltos se validan contra el guardarropas real antes de mostrarlos.
- Ajuste del resultado: cambiar una prenda, agregar otra, regenerar, guardar.

### Looks (`/looks`)
- Historial de looks guardados, detalle con las prendas que lo componen y registro de usos (`look_usos`).
- **Vestir mi look**: genera con IA una imagen tuya con el outfit puesto, usando la foto corporal del perfil como referencia. Estrategia de fallback entre varios modelos de imagen de Gemini/Imagen; la imagen resultante se guarda en un bucket privado.

### Viajes / asistente de maletas (`/viajes`)
- Wizard: destinos, fechas, tipos de evento (trabajo, playa, outdoor, salidas, paseos, deporte, formal) con cantidad de looks por evento, estilos preferidos, prendas a incluir/excluir.
- Dos modos de optimización: **maleta liviana** (menos prendas, más combinaciones) o **estilo completo** (cada look diferenciado).
- Todos los looks del viaje se generan en una sola llamada al modelo; se puede regenerar un look puntual. Además sugiere básicos a llevar (`viaje_basicos_sugeridos`).

### Perfil y configuración (`/perfil`, `/configuracion`)
- Datos personales, avatar, datos corporales (género, altura, peso) y foto de cuerpo completo para la generación de imágenes.
- Preferencias: idioma, tema, ciudad manual para el clima, estilos favoritos y ocasiones frecuentes.
- Panel de uso de IA (`/api/perfil/uso-ia`) con el consumo registrado en `ai_usage`.
- Cierre de sesión y eliminación de cuenta.

### Transversal
- Autenticación con email/password y Google OAuth.
- Clima vía Open-Meteo (sin API key) con búsqueda de ciudades por geocoding.
- PWA instalable con caching offline de imágenes.
- Bilingüe `es`/`en` y tema claro/oscuro/sistema.

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework | [Next.js 16.2.6](https://nextjs.org) — App Router + Turbopack |
| UI | [React 19.2.4](https://react.dev) + TypeScript 5 |
| Estilos | [Tailwind CSS v4](https://tailwindcss.com) — tokens semánticos en `@theme {}` |
| Iconos | [lucide-react](https://lucide.dev) |
| Backend / DB | [Supabase](https://supabase.com) — PostgreSQL + Auth + Storage, todo con RLS |
| IA (texto y visión) | [Gemini 2.5 Flash-Lite](https://ai.google.dev) — análisis de prendas, validación de imágenes, generación de looks y de viajes |
| IA (imagen) | Gemini 3.x Pro/Flash Image · Gemini 2.x Image · Imagen 4.0 (cadena de fallback) |
| Procesamiento de imágenes | [@imgly/background-removal](https://img.ly/products/background-removal) (WASM, client-side) + [browser-image-compression](https://github.com/Donaldcwl/browser-image-compression) |
| Validación | [Zod v4](https://zod.dev) |
| PWA | [@ducanh2912/next-pwa](https://github.com/DuCanhGH/next-pwa) (Workbox) |
| Clima | [Open-Meteo](https://open-meteo.com) — sin API key, proxy server-side |
| i18n | [next-intl v4](https://next-intl-docs.vercel.app) — `es` (default) / `en` |
| Observabilidad | [Sentry](https://sentry.io) + logger JSON estructurado |
| Analytics | [PostHog](https://posthog.com) EU cloud (client + server) |
| Deploy | [Vercel](https://vercel.com) — región `gru1` |

---

## Arquitectura

```
Browser (PWA)
   │
   ├─ proxy.ts ────────── sesión Supabase + guardas de ruta + i18n + CSP con nonce por request
   │
   ├─ Server Components ─ lectura directa a Supabase con la sesión del usuario (RLS)
   │
   └─ API Routes ──────── único lugar donde viven los secretos
        ├─ Gemini        (GEMINI_API_KEY, server-only)
        ├─ Supabase svc  (SUPABASE_SERVICE_ROLE_KEY, sólo donde hace falta bypassear RLS)
        ├─ Open-Meteo    (proxy con cache de 30 min)
        └─ Storage proxy (/api/garments/[id]/image, /api/storage/[bucket]/[...path])
```

Puntos de diseño que conviene conocer antes de tocar el código:

- **`proxy.ts` (middleware).** Refresca la sesión de Supabase en cada request, redirige rutas protegidas a `/login` y rutas de auth a `/guardarropas` si ya hay sesión, arma la CSP con nonce y delega en el middleware de next-intl. No corre sobre `/api/*`, `/auth/*` ni assets.
- **Imágenes con URL estable.** Los buckets privados no se linkean con signed URLs (el token expira y rompe la vista, y cambia en cada render → nada cacheable). Todo pasa por rutas proxy autenticadas que firman internamente por 60 s; el token nunca llega al browser y el service worker puede cachear la URL. Ver [lib/storage/urls.ts](lib/storage/urls.ts).
- **Soft delete.** Borrar una prenda no destruye los looks que la incluían: `prendas.deleted_at` + `look_prendas.prenda_id ON DELETE SET NULL` con el flag `prenda_eliminada`.
- **Validación de salida de la IA.** Los IDs de prenda que devuelve el modelo se cruzan siempre contra el guardarropas del usuario antes de persistir o mostrar nada.
- **Rate limiting sin infra externa.** Se cuenta sobre la tabla `ai_usage` por `(user_id, tipo)` en ventana deslizante. Ver [lib/ai/usage.ts](lib/ai/usage.ts).

Diagrama completo en [docs/architecture/diagrama-arquitectura.md](docs/architecture/diagrama-arquitectura.md).

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

Abrí `.env.local` y completá cada variable. Ver [Variables de entorno](#variables-de-entorno).

### 4. Iniciar Supabase local

```bash
supabase start
```

Levanta PostgreSQL, Auth, Storage y Studio en Docker, y muestra las URLs y keys locales:

```
API URL: http://127.0.0.1:54321
anon key: eyJhbGci...
service_role key: eyJhbGci...
Studio URL: http://127.0.0.1:54323
```

Actualizá `.env.local` con esos valores.

### 5. Aplicar migraciones y seeds

```bash
npm run db:reset
```

Corre todas las migraciones de `supabase/migrations/` (schema, RLS, buckets, extensiones) y el seed con las 8 categorías y sus subcategorías.

### 6. Iniciar el servidor de desarrollo

```bash
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000).

> **Dispositivos físicos en LAN:** cambiá `NEXT_PUBLIC_APP_URL` a tu IP local (ej: `http://192.168.1.X:3000`) para que los redirects OAuth funcionen desde el celular, y agregá esa URL + `/auth/callback` en Supabase → Authentication → URL Configuration. La IP `192.168.1.111` está autorizada en `allowedDevOrigins` en [next.config.ts](next.config.ts); si la tuya es distinta, actualizala ahí también.

---

## Variables de entorno

| Variable | Descripción | ¿Pública? |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | URL base de la app (controla el `redirect_to` del flujo OAuth). En producción no hace falta: Vercel inyecta `VERCEL_URL` | ✅ |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key de Supabase (RLS protege los datos) | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key — sólo en API Routes server-side, bypasea RLS | ❌ |
| `GEMINI_API_KEY` | API key de Google AI / Gemini (alternativa aceptada: `GOOGLE_VERTEX_API_KEY`) | ❌ |
| `NEXT_PUBLIC_SENTRY_DSN` | DSN de Sentry para el cliente (browser) | ✅ |
| `SENTRY_DSN` | DSN de Sentry para el servidor (Node.js) | ❌ |
| `SENTRY_AUTH_TOKEN` | Token para subir source maps en CI/CD | ❌ |
| `SENTRY_ORG` / `SENTRY_PROJECT` | Slugs de Sentry para el upload de source maps | ❌ |
| `NEXT_PUBLIC_POSTHOG_KEY` | API key de PostHog | ✅ |
| `NEXT_PUBLIC_POSTHOG_HOST` | Host de PostHog (EU: `https://eu.i.posthog.com`) | ✅ |

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
| `npm run db:seed` | Alias de `db:reset` (la CLI de Supabase unifica ambos) |

---

## Estructura del proyecto

```
/
├── app/
│   ├── [locale]/
│   │   ├── (auth)/                 # públicas: login, registro, recuperar-password
│   │   └── (app)/                  # protegidas
│   │       ├── guardarropas/       # listado, [id], [id]/editar, nueva/{analizar,formulario}
│   │       ├── generador/          # config + resultado
│   │       ├── looks/              # historial + [id]
│   │       ├── viajes/             # listado, nuevo (wizard), [id]
│   │       ├── perfil/             # perfil + datos
│   │       └── configuracion/
│   ├── api/                        # API Routes (ver tabla más abajo)
│   ├── auth/                       # callback OAuth + reset-password
│   ├── layout.tsx                  # root layout: fuentes, metadata, bootstrap de tema
│   ├── globals.css                 # tokens Tailwind v4 (@theme) claro/oscuro
│   └── critical.css                # CSS crítico inline (anti-FOUC con Turbopack)
│
├── components/
│   ├── ui/                         # design system: Button, Input, Badge, Chip, GarmentCard,
│   │                               # LookCard, BottomNav, Sidebar, Toast, Skeleton, …
│   ├── features/                   # componentes de dominio por feature
│   │   ├── generator/  looks/  settings/  viajes/  wardrobe/
│   ├── auth/                       # GoogleSignInButton
│   └── providers/                  # CurrentUserProvider, PosthogProvider
│
├── lib/
│   ├── ai/          usage.ts       # rate limiting + registro en ai_usage
│   ├── gemini/      client.ts      # cliente HTTP de Gemini (API key por header)
│   ├── supabase/    client.ts · server.ts (incluye createServiceClient)
│   ├── storage/     urls.ts        # URLs estables vía proxy autenticado
│   ├── viajes/      constants.ts · basicos.ts
│   ├── posthog/     client.ts · server.ts
│   ├── upload/      validation.ts  # límites de tamaño + magic bytes
│   ├── utils/       logger.ts · initials.ts
│   ├── i18n/        routing.ts
│   ├── csp.ts       theme.ts       cn.ts      database.types.ts
│
├── i18n/request.ts                 # config server-side de next-intl
├── messages/                       # es.json (default) · en.json
├── public/                         # manifest.json, iconos PWA, imágenes
├── supabase/
│   ├── migrations/                 # 9 migraciones SQL
│   └── seed.sql                    # categorías y subcategorías
├── docs/                           # ver "Documentación adicional"
├── proxy.ts                        # middleware: auth + i18n + CSP
├── next.config.ts                  # PWA + next-intl + Sentry + headers de seguridad
├── vercel.json                     # región, maxDuration, rewrites de PostHog
└── instrumentation.ts · sentry.*.config.ts
```

Convenciones de nombrado e importación: [docs/STRUCTURE.md](docs/STRUCTURE.md) y [docs/conventions.md](docs/conventions.md).

---

## API Routes

Todas las rutas requieren sesión salvo las de auth. Los endpoints de IA además pasan por rate limiting.

### Auth
| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/auth/signup` | Registro con email/password |
| `POST` | `/api/auth/login` | Login con email/password |
| `POST` | `/api/auth/logout` | Cierre de sesión |
| `GET` | `/api/auth/google` | Inicio del flujo OAuth de Google |
| `POST` | `/api/auth/reset-password` | Envío de mail de recuperación |
| `POST` | `/api/auth/update-password` | Cambio de contraseña |

### Prendas
| Método | Ruta | Descripción |
|---|---|---|
| `GET` `POST` | `/api/garments` | Listado (búsqueda, filtros, paginado) y alta |
| `GET` `PATCH` `DELETE` | `/api/garments/[id]` | Detalle, edición, soft delete |
| `POST` | `/api/garments/[id]/favorite` | Toggle de favorito |
| `GET` | `/api/garments/[id]/image` | Proxy autenticado a la imagen (URL estable, cacheable) |
| `POST` | `/api/garments/[id]/analizar` | Re-análisis IA de una prenda existente |
| `POST` | `/api/prendas/analizar` | Análisis IA de una imagen antes de crear la prenda |
| `POST` | `/api/validar-imagen` | Valida con IA si la imagen sirve (`prenda` \| `foto_corporal`) |

### Looks
| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/looks` | Historial de looks |
| `GET` `DELETE` | `/api/looks/[id]` | Detalle y borrado |
| `POST` | `/api/looks/[id]/log` | Registrar uso del look |
| `POST` | `/api/looks/generar` | Generación de look con IA |
| `POST` | `/api/looks/cambiar-prenda` | Reemplazar una prenda del look |
| `POST` | `/api/looks/agregar-prenda` | Sumar una prenda al look |
| `POST` | `/api/looks/guardar` | Persistir el look generado |
| `POST` | `/api/looks/generar-imagen` | "Vestir mi look" — imagen IA sobre la foto corporal |
| `POST` | `/api/looks/guardar-imagen-vestir` | Guardar la imagen generada en Storage |

### Viajes
| Método | Ruta | Descripción |
|---|---|---|
| `GET` `POST` | `/api/viajes` | Listado y creación (viaje + destinos + eventos + preferencias) |
| `GET` `PATCH` `DELETE` | `/api/viajes/[id]` | Detalle, actualización, borrado |
| `POST` | `/api/viajes/generar-looks` | Genera todos los looks del viaje (o regenera uno) |
| `PUT` `DELETE` | `/api/viajes/[id]/looks/[lookId]` | Editar o eliminar un look del viaje |

### Perfil, clima y storage
| Método | Ruta | Descripción |
|---|---|---|
| `GET` `PATCH` `DELETE` | `/api/perfil` | Perfil, preferencias y eliminación de cuenta |
| `POST` | `/api/perfil/avatar` | Subida de avatar (bucket público) |
| `POST` `DELETE` | `/api/perfil/foto-corporal` | Foto de cuerpo completo (bucket privado) |
| `GET` | `/api/perfil/uso-ia` | Métricas de consumo de IA del usuario |
| `GET` | `/api/clima?lat=&lon=` | Proxy a Open-Meteo, cache 30 min, códigos WMO en español |
| `GET` | `/api/clima/ciudades?q=` | Geocoding de ciudades |
| `GET` | `/api/storage/[bucket]/[...path]` | Proxy autenticado para `body-photos` y `look-images` |
| `GET` | `/api/img/[slug]` | Sirve imágenes estáticas de demo (workaround de Turbopack en LAN) |

---

## Modelo de datos

Documentación detallada en [docs/database/schema.md](docs/database/schema.md). Resumen de tablas:

| Tabla | Rol |
|---|---|
| `profiles` | Perfil extendido (idioma, tema, ciudad, estilos, género, altura, peso). Creado por el trigger `handle_new_user` al insertar en `auth.users` |
| `categories` · `subcategories` | Datos de referencia cargados por el seed (8 categorías) |
| `prendas` | Prenda del guardarropas. Arrays multivalor en JSONB, soft delete, flags de IA |
| `looks` | Look guardado: nombre, `descripcion_ia`, `parametros_generacion` (JSONB), `vestir_imagen_url` |
| `look_prendas` | M:N look ↔ prenda, con `es_prenda_base` y `prenda_eliminada` |
| `look_usos` | Fechas de uso de cada look |
| `ai_usage` | Una fila por llamada a IA: `tipo`, tokens, costo estimado. Alimenta el rate limiter y el panel de uso |
| `viajes` | Viaje: fechas, `modo_optimizacion`, `estado` (borrador/listo/en_viaje/completado) |
| `destinos` · `viaje_eventos` | Ciudades del viaje y eventos con cantidad de looks |
| `viaje_preferencias_prendas` · `viaje_preferencias_estilos` | Inclusiones/exclusiones y estilos del viaje |
| `viaje_looks` · `viaje_look_prendas` | Looks generados para el viaje y su composición |
| `viaje_basicos_sugeridos` | Básicos que la IA sugiere llevar |

**RLS en todas las tablas de usuario**: aislamiento por `user_id`, y por subquery al padre en las tablas hijas. `ai_usage` sólo se escribe con `service_role`.

**Extensiones:** `pg_trgm` con índices GIN sobre `nombre`, `color_principal` y `notas` para que las búsquedas `ILIKE '%q%'` usen índice.

### Buckets de Storage

| Bucket | Acceso | Límite | Path |
|---|---|---|---|
| `prendas` | Privado (proxy autenticado) | 5 MB | `{user_id}/{prenda_id}.webp` |
| `avatars` | Público | 2 MB | `{user_id}/avatar.webp` |
| `body-photos` | Privado (proxy autenticado) | 10 MB | `{user_id}/{filename}` |
| `look-images` | Privado (proxy autenticado) | 10 MB | `{user_id}/{look_id}/vestir_{ts}.jpg` |

Las políticas de Storage validan que el primer segmento del path sea el `auth.uid()` del usuario.

---

## Uso de IA

| Función | Modelo | Entrada |
|---|---|---|
| Análisis de prenda | `gemini-2.5-flash-lite` | Imagen + prompt con taxonomía cerrada; responde JSON estricto |
| Validación de imagen | `gemini-2.5-flash-lite` | Imagen; decide si es una prenda o una foto de cuerpo completo válida. **Fail-open**: si el servicio falla, no bloquea al usuario |
| Generación de look | `gemini-2.5-flash-lite` | Sólo metadatos textuales de las prendas (sin imágenes) |
| Generación de looks de viaje | `gemini-2.5-flash-lite` | Todos los looks del viaje en una sola llamada (timeout 45 s) |
| "Vestir mi look" | `gemini-3-pro-image` → `gemini-3.1-flash-image` → `gemini-2.5-flash-image` → `imagen-4.0-*` | Foto corporal + imágenes de las prendas. Recorre la cadena hasta el primer modelo disponible y cachea en memoria cuál funcionó |

**Rate limits por usuario** (ventana deslizante sobre `ai_usage`, fail-open si el limiter falla):

| Tipo | Por minuto | Por día |
|---|---|---|
| `analisis_prenda` | 15 | 200 |
| `generacion_look` | 10 | 120 |
| `cambio_prenda` | 15 | 200 |
| `generacion_viaje` | 5 | 40 |
| `validacion_imagen` | 30 | 300 |
| `generacion_imagen` | — | 5 |

Al superarlos, la API devuelve `429` con `Retry-After`.

---

## Seguridad

- **RLS en toda la base**: ninguna consulta del cliente puede ver datos de otro usuario. La `anon key` es pública a propósito.
- **`service_role` acotado**: sólo en API Routes donde hace falta bypassear RLS (por ejemplo el insert en `ai_usage`).
- **Secretos server-only**: `GEMINI_API_KEY` viaja por header `x-goog-api-key`, nunca en query string, y jamás llega al bundle del cliente.
- **CSP con nonce por request** ([lib/csp.ts](lib/csp.ts)): en producción `script-src` va sin `'unsafe-inline'`, con `'strict-dynamic'`. `'unsafe-eval'` se habilita únicamente en `/guardarropas/nueva/analizar`, donde el WASM de remoción de fondo lo necesita. Las respuestas no-documento (`/api/*`, `/auth/*`) usan `default-src 'none'`.
- **Headers**: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS con preload.
- **Uploads**: MIME real detectado por magic bytes (no por la extensión ni por el `Content-Type` declarado), con límites de tamaño explícitos.
- **Sin signed URLs en el browser**: el token de Storage nunca sale del servidor.
- **Rate limiting** en todos los endpoints de IA.

---

## Observabilidad y analytics

- **Sentry** en client, server y edge (`sentry.*.config.ts`, `instrumentation.ts`). Source maps subidos en el build de producción y borrados del bundle público. El auto-instrumentado de API Routes y middleware está desactivado a propósito: se instrumenta manualmente donde interesa el contexto de usuario.
- **Logger JSON estructurado** ([lib/utils/logger.ts](lib/utils/logger.ts)) con `hashUserId()` — nunca se loguea el ID crudo del usuario.
- **PostHog** EU cloud, client + server, servido a través del rewrite `/ingest/*` de [vercel.json](vercel.json) para esquivar bloqueadores. Eventos: `prenda_agregada`, `prenda_editada`, `prenda_eliminada`, `ia_analisis_iniciado` / `_completado` / `_fallido`, `look_generado`, `look_regenerado`, `look_guardado`, `vestir_imagen_generada`, `vestir_imagen_descargada`.

---

## PWA y caching

- Manifest e iconos (192/512, maskable, shortcuts) en `public/`. El service worker está desactivado en desarrollo.
- Estrategias de runtime caching ([next.config.ts](next.config.ts)):
  - `CacheFirst` para imágenes de categoría (1 año, 20 entradas).
  - `StaleWhileRevalidate` para `/api/garments/*/image` (30 días, 500 entradas) y `/api/storage/*` (30 días, 200 entradas). Esto funciona justamente porque esas URLs son estables.
- `critical.css` inline en el root layout: con Turbopack el CSS de Tailwind se bundlea en JS, así que el `<style>` crítico evita el FOUC en redes lentas.

---

## i18n y tema

- **next-intl v4** con `es` como default y `en` disponible. Rutas prefijadas por locale (`/es/...`, `/en/...`); el middleware normaliza el prefijo antes de aplicar las guardas de auth. Traducciones en `messages/es.json` y `messages/en.json`.
- **Tema** ([lib/theme.ts](lib/theme.ts)): preferencia `claro | oscuro | sistema` guardada en la DB y cacheada en `localStorage` para poder aplicarla antes del primer paint. Se representa con `data-theme` en `<html>`; los componentes usan tokens semánticos (`bg-bg`, `text-ink`, `border-line`), nunca colores hardcodeados. El `<meta name="theme-color">` se sincroniza para que el notch no corte.

---

## CI/CD y deploy

**CI** ([.github/workflows/ci.yml](.github/workflows/ci.yml)): en cada PR hacia `main` corre typecheck, lint y build sobre Node 20, con cancelación de runs previos del mismo PR. Sólo necesita las variables `NEXT_PUBLIC_SUPABASE_*` como secrets — las keys sensibles no se usan en build time.

**Deploy en Vercel:**

1. Conectar el repositorio en [vercel.com](https://vercel.com).
2. Settings → Environment Variables: cargar todas las variables de `.env.example` (Production + Preview).
3. Cada push a `main` dispara el build.

Configuración relevante en [vercel.json](vercel.json): región `gru1` (São Paulo), `maxDuration` de 30 s para las API Routes y 60 s para `/api/looks/generar-imagen`, cache largo para iconos y manifest, y los rewrites de PostHog.

### Google OAuth (producción)

1. [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials.
2. Crear OAuth 2.0 Client ID → Web application.
3. Authorized redirect URI: `https://<ref>.supabase.co/auth/v1/callback`.
4. Pegar Client ID y Secret en Supabase → Authentication → Providers → Google.
5. Agregar `https://tu-app.vercel.app/auth/callback` en Supabase → Authentication → URL Configuration → Redirect URLs.

---

## Documentación adicional

| Documento | Descripción |
|---|---|
| [docs/STRUCTURE.md](docs/STRUCTURE.md) | Árbol de carpetas y convenciones de nombrado |
| [docs/conventions.md](docs/conventions.md) | Convenciones de código del proyecto |
| [docs/database/schema.md](docs/database/schema.md) | Schema de base de datos documentado |
| [docs/architecture/diagrama-arquitectura.md](docs/architecture/diagrama-arquitectura.md) | Diagrama de arquitectura (Mermaid) |
| [docs/architecture/adr/](docs/architecture/adr/) | ADRs: App Router, Supabase, Gemini Flash-Lite, JSONB en prendas, PWA vs. nativa |
| [docs/stories/](docs/stories/) | Historias de usuario PERCHA-001 a PERCHA-036 |
| [docs/design/Handoff.html](docs/design/Handoff.html) | Handoff de diseño — 26 pantallas |

---

## Licencia

Propietario — todos los derechos reservados.
