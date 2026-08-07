# Percha — TODO & Deuda Técnica

> Última actualización: 2026-05-23  
> Organizados por prioridad e impacto. Los ítems de "dev/workaround" deben resolverse antes del lanzamiento.

---

## 🚨 Bug abierto — Google OAuth en iPhone (LAN)

**Síntoma:** Después de autorizar con Google, el iPhone redirige a `localhost:3000` en vez de `192.168.1.111:3000`.

**Estado de investigación:**
- El código genera la URL correcta: `redirect_to=http://192.168.1.111:3000/auth/callback` ✓
- Supabase tiene la URL en Redirect URLs ✓
- El middleware fue corregido para no usar `request.url` (bug real confirmado)
- Las cookies PKCE y de sesión se copian explícitamente al response ✓
- El problema persiste → causa raíz aún no identificada

**Candidatos a investigar:**
1. Cors / `allowedDevOrigins` en `next.config.ts` — podría estar bloqueando el request del callback
2. Safari en iPhone con una sesión PKCE corrupta — probar con Chrome en iPhone
3. Que el PKCE code verifier no viaje en el redirect 302 a Google (inspeccionar con mitmproxy o Charles)
4. Posible bug de Supabase SSR con code verifier en Next.js 16 + React 19
5. Probar con `skipBrowserRedirect: false` y `flowType: "implicit"` temporalmente

**Workaround para dev:** usar el emulador de Chrome/Safari DevTools para probar OAuth hasta que se resuelva.

**Archivos relevantes:**
- `app/api/auth/google/route.ts`
- `app/auth/callback/route.ts`
- `proxy.ts`

---

## 🔴 Antes del deploy a producción

### Auth / Supabase

- **Redirect URLs de Supabase**: agregar la URL de producción en
  `Dashboard → Authentication → URL Configuration → Redirect URLs`.
  Actualmente solo hay `http://localhost:3000/auth/callback` y
  `http://192.168.1.111:3000/auth/callback` (dev LAN).
  Necesita: `https://tu-dominio.vercel.app/auth/callback`.

- **Site URL de Supabase**: cambiar de `http://localhost:3000` a
  `https://tu-dominio.vercel.app` antes de activar producción.

- **Google OAuth callback en Google Cloud Console**: agregar
  `https://tu-dominio.vercel.app` como "Authorized JavaScript Origin"
  y `https://<proyecto>.supabase.co/auth/v1/callback` como
  "Authorized Redirect URI" (probablemente ya está si funciona en dev,
  pero verificar que el proyecto de GCP no esté en modo "Testing").

### Infraestructura

- **Push a GitHub**: el repo es solo local, sin remote configurado.
  Crear repo en GitHub y hacer el primer push.

- **Configurar Vercel**: conectar el repo de GitHub a Vercel.
  Agregar todas las variables de entorno del `.env.example`.

- **GitHub Actions CI**: workflow en `.github/workflows/` para correr
  `tsc --noEmit` y `next build` en cada PR antes del merge.
  (El archivo existe pero el repo no tiene remote aún.)

---

## 🟠 Workarounds de dev a limpiar

Estos son hacks necesarios para desarrollo en LAN que hay que revisar
o eliminar cuando el proyecto tenga una URL fija de producción.

- **IP hardcodeada en `next.config.ts`**
  ```ts
  allowedDevOrigins: ["192.168.1.111"],  // ← IP del iPhone en dev
  ```
  Mover a `.env.local` como `NEXT_PUBLIC_DEV_ORIGIN` o eliminar al
  dejar de necesitar acceso LAN.
  → `next.config.ts:22`

- **`getOrigin()` workaround en `/api/auth/google`**
  Next.js dev server normaliza `request.url` a `localhost` aunque el
  cliente acceda por LAN IP. El workaround usa `request.headers.get('host')`.
  En producción detrás de Vercel hay que verificar que `x-forwarded-host`
  se maneje correctamente o usar `NEXT_PUBLIC_SITE_URL` como override.
  → `app/api/auth/google/route.ts`

- **Mismo workaround en `/auth/callback`**
  → `app/auth/callback/route.ts`

- **CSS crítico hardcodeado sin `var()`**
  Los bloques `CRITICAL_CSS` y `AUTH_CSS` en `layout.tsx` y
  `(auth)/layout.tsx` tienen valores de color/tipografía hardcodeados
  (ej. `#f7f5ef`, `52px`). Si se cambian los tokens en `globals.css`
  hay que actualizar estos bloques manualmente.
  Consideración: generar estos bloques automáticamente al compilar.
  → `app/layout.tsx`, `app/[locale]/(auth)/layout.tsx`

---

## 🟡 Features pendientes del producto

### EP-02 — Guardarropas (parcial)

- **PERCHA-010** Ver detalle de prenda
  Pantalla modal o página con foto full, metadatos completos y
  acciones (editar, eliminar, toggle favorito).

- **PERCHA-011** Editar prenda
  Formulario pre-llenado con los datos actuales. Mismo componente
  que "agregar" pero en modo edición. Incluye reemplazar foto.

- **PERCHA-012** Eliminar prenda
  Confirmación + eliminar de DB + eliminar imagen de Supabase Storage.
  Desde el detalle y/o con swipe en la grilla.

### EP-03 — Análisis IA (no implementado)

- Integración con Gemini 2.5 Flash-Lite desde API Routes (server-side).
  `GEMINI_API_KEY` ya está en `.env.example`. Analiza foto de prenda y
  devuelve categoría, color, ocasión, temporada.
  → Ver `docs/stories/` y `Especificaciones.md` para ACs detallados.

### EP-04 — Generación de looks (no implementado)

- Dado el guardarropas del usuario + contexto (clima, ocasión), sugerir
  combinaciones de prendas con IA.

### EP-05 — Clima (no implementado)

- Integración con Open-Meteo (desde backend, no desde el cliente).
  Muestra temperatura y condición en el generador de looks.

### EP-06 — Preferencias / Configuración (no implementado)

- **PERCHA-005** Edición de perfil (diferido de EP-01):
  nombre, avatar, preferencias de estilo.

- **PERCHA-006** Cierre de sesión global (todos los dispositivos).
  La ruta `app/api/auth/logout/route.ts` ya existe pero solo
  cierra la sesión local.

- **PERCHA-007** Eliminación de cuenta (diferido de EP-01):
  soft-delete + eliminar datos del Storage.

---

## 🟢 Mejoras técnicas (no bloqueantes)

### Seguridad

- **CSP: eliminar `unsafe-inline` en `script-src`**
  Next.js hydration lo requiere sin nonces. Migrar a CSP basada en
  nonces (genera un nonce por request en el middleware, lo pasa al
  layout vía header/cookie). Permite alcanzar rating CSP A+.
  → `next.config.ts:49-50`

- **Signed URLs de Supabase Storage expiran en 1h**
  Las URLs de imágenes en el guardarropas se generan con TTL de 3600s.
  Si un usuario deja la app abierta más de 1h, las fotos desaparecen.
  Opciones: refetch periódico, TTL más largo, o rutas proxy server-side.
  → `app/[locale]/(app)/guardarropas/page.tsx:79`

### UI / UX

- **Sidebar collapsed en desktop medio** (tablet/lg)
  El componente `<Sidebar>` tiene el layout documentado pero no
  implementado: modo de solo iconos (64px) para pantallas `lg < xl`.
  → `components/ui/Sidebar.tsx:13-15`

- **Dark mode (PERCHA-025)**
  Los tokens CSS en `globals.css` están preparados con `[data-theme="dark"]`
  pero el toggle de tema no está implementado. `suppressHydrationWarning`
  está puesto en `<html>` esperando este feature.
  → `app/layout.tsx:98`

- **Revisión de pantallas auth vs prototipo (Handoff 02-04)**
  Las pantallas de login, registro y recuperar contraseña están
  funcionales pero no se compararon contra el diseño final del prototipo
  (`/Users/nico/Downloads/percha-proto/prototipo.html`).

### Observabilidad (EP-07)

- **PostHog**: el CSP ya tiene el dominio habilitado y `vercel.json`
  tiene el proxy `/ingest/*` preparado. Falta inicializar el SDK.

- **Sentry**: `connect-src` del CSP tiene `*.ingest.sentry.io`.
  Falta configurar `SENTRY_DSN` y el SDK.

- **Logs estructurados**: los `console.error` en API Routes deberían
  ir a un servicio de logging (Sentry, Axiom, Logtail) en producción.

---

## 📋 Quick reference — archivos con deuda

| Archivo | Deuda |
|---|---|
| `next.config.ts:22` | IP hardcodeada `allowedDevOrigins` |
| `next.config.ts:49` | CSP `unsafe-inline` → migrar a nonces |
| `app/layout.tsx` | `CRITICAL_CSS` hardcodeado, sincronizar si cambian tokens |
| `app/[locale]/(auth)/layout.tsx` | `AUTH_CSS` hardcodeado |
| `app/api/auth/google/route.ts` | Workaround `Host` header (verificar en prod) |
| `app/auth/callback/route.ts` | Workaround `Host` header (verificar en prod) |
| `app/[locale]/(app)/guardarropas/page.tsx:79` | Signed URLs TTL 1h |
| `components/ui/Sidebar.tsx` | Collapsed mode no implementado |
| `.claude/PROJECT.md` | Estado completo del proyecto |
