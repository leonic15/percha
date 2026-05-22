# [EP-07] Seguridad: RLS, Storage policies, variables de entorno y cabeceras HTTP

**ID:** LOOKSI-029  
**Épica:** EP-07 — Infraestructura y arquitectura base  
**Prioridad:** Alta  
**Estimación:** 4 puntos  
**Estado:** Pendiente

---

## Descripción

Como **desarrollador**, quiero **configurar RLS en todas las tablas, políticas de Storage, variables de entorno y cabeceras HTTP de seguridad** para **garantizar que los datos de cada usuario estén protegidos y la app sea segura desde el día 1**.

---

## Criterios de aceptación

### Escenario 1: RLS habilitado y configurado en todas las tablas
- **Dado** que la app está en producción
- **Cuando** un usuario autenticado intenta acceder a datos de otro usuario vía cualquier método
- **Entonces** Supabase rechaza la operación a nivel de base de datos sin importar qué haga el código de la app

### Escenario 2: Políticas de Storage configuradas
- **Dado** que los buckets `prendas` y `avatars` existen en Supabase Storage
- **Cuando** un usuario autenticado intenta leer o escribir en el path de otro usuario
- **Entonces** la operación es rechazada por las políticas de Storage

### Escenario 3: API keys nunca expuestas en el cliente
- **Dado** que la app está en producción
- **Cuando** inspecciono el código JavaScript del cliente (bundle)
- **Entonces** no hay ninguna API key de Gemini, Sentry server-side ni service role key de Supabase expuesta

### Escenario 4: Cabeceras HTTP de seguridad configuradas
- **Dado** que la app está deployada en Vercel
- **Cuando** analizo las cabeceras HTTP de la app con una herramienta como securityheaders.com
- **Entonces** la app obtiene al menos una calificación B+, con las cabeceras de seguridad clave configuradas

### Escenario 5: Variables de entorno documentadas
- **Dado** que un desarrollador nuevo clona el repositorio
- **Cuando** lee el `.env.example` y el README
- **Entonces** entiende qué variables necesita configurar, dónde obtenerlas y para qué sirve cada una

---

## Notas técnicas

- **Políticas RLS por tabla:**

| Tabla | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | `auth.uid() = id` | `auth.uid() = id` | `auth.uid() = id` | No permitido (se elimina en cascada con el usuario) |
| `prendas` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` |
| `looks` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` |
| `look_prendas` | Via JOIN con `looks` | Via `looks` | Via `looks` | Via `looks` |
| `look_usos` | Via JOIN con `looks` | Via `looks` | No permitido | Via `looks` |
| `ai_usage` | `auth.uid() = user_id` | Solo desde service role | No permitido | No permitido |
| `categories` | Público (lectura) | Solo service role | Solo service role | Solo service role |
| `subcategories` | Público (lectura) | Solo service role | Solo service role | Solo service role |

- **Políticas de Storage:**
  - Bucket `prendas`: lectura pública deshabilitada; escritura solo para `auth.uid()` coincide con el primer segmento del path (`{user_id}/...`)
  - Bucket `avatars`: lectura pública habilitada (las fotos de perfil son públicas); escritura solo para `auth.uid()` coincide con el primer segmento del path

- **Cabeceras HTTP en `next.config.js`:**
  ```js
  Content-Security-Policy: default-src 'self'; img-src 'self' data: https://*.supabase.co; connect-src 'self' https://*.supabase.co https://api.gemini... https://app.posthog.com https://sentry.io
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=self, geolocation=self, microphone=()
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  ```

- Las variables `SUPABASE_SERVICE_ROLE_KEY` y `GEMINI_API_KEY` solo se usan en API Routes (server-side), nunca con prefijo `NEXT_PUBLIC_`
- Auditar el bundle del cliente con `@next/bundle-analyzer` para confirmar que no hay leaks de secrets

---

## Dependencias

- [LOOKSI-026] Setup inicial del proyecto
- [LOOKSI-027] Schema de base de datos, migraciones y seeds
