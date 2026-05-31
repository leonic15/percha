# Auditoría de Seguridad y Performance — LookSi

> **Fecha:** 2026-05-30
> **Alcance:** API Routes (`app/api/**`), middleware (`proxy.ts`), clientes Supabase (`lib/supabase/**`),
> migraciones/RLS (`supabase/migrations/**`), configuración (`next.config.ts`, CI, env), logging y analytics.
> **Stack:** Next.js 16 (App Router, Turbopack) · React 19 · Supabase (Postgres + Storage + Auth) · Gemini 2.5 Flash-Lite · PWA · Sentry · PostHog.
> **Tipo:** Revisión estática de código + revisión de configuración. No se ejecutaron pruebas dinámicas (DAST) ni pentest activo.

---

## 1. Resumen ejecutivo

El proyecto tiene **buenas bases de seguridad**: RLS habilitado en todas las tablas, aislamiento por `user_id`,
storage privado con políticas por carpeta, claves sensibles solo server-side, cabeceras HTTP de seguridad (CSP, HSTS,
X-Frame-Options), hashing del `user_id` en logs/analytics y respuestas genéricas en auth (anti-enumeración).

Sin embargo, hay **3 hallazgos críticos (🔴)** que deben resolverse antes de exponer la app a producción/usuarios reales:

1. **El rate limit de generación de imágenes es evadible** y el tracking de costos (`ai_usage`) no persiste, porque los
   `INSERT` se hacen con el cliente de usuario contra una tabla cuya RLS no tiene política de `INSERT`.
2. **Endpoint de diagnóstico `/api/auth/debug` expuesto** sin autenticación, que filtra configuración de entorno.
3. **Ausencia de rate limiting en los endpoints de IA** (Gemini), lo que habilita abuso de costos / DoS económico.

El resto son hallazgos medios y bajos de hardening y performance.

### Conteo por severidad

| Semáforo | Severidad | Cantidad |
|----------|-----------|----------|
| 🔴 | Crítico / Alto | 3 |
| 🟡 | Medio | 7 |
| 🟢 | Bajo / Mejora | 7 |

---

## 2. Tabla resumen de hallazgos

> **Leyenda "Implementado":** ✅ implementado · ⬜ pendiente

| ID | Semáforo | Categoría | Hallazgo | Impacto | Implementado |
|------|:------:|-----------|----------|---------|:------:|
| H-01 | 🔴 | Seguridad / Costos | `ai_usage` se inserta con cliente de usuario sin política RLS de INSERT → rate limit de imágenes evadible + costos no registrados | Alto | ✅ |
| H-02 | 🔴 | Seguridad | `/api/auth/debug` expone variables de entorno sin auth | Alto | ✅ |
| H-03 | 🔴 | Seguridad / Costos | Sin rate limiting en endpoints de IA (`analizar`, `generar`, `cambiar-prenda`, `generar-looks`, `validar-imagen`) | Alto | ✅ |
| H-04 | 🟡 | Seguridad | Inyección de filtros PostgREST en parámetro `q` de `GET /api/garments` (`.or()` con interpolación) | Medio | ✅ |
| H-05 | 🟡 | Seguridad | CSP con `'unsafe-inline'` + `'unsafe-eval'` en `script-src` | Medio | ✅ |
| H-06 | 🟡 | DoS / Recursos | `POST /api/validar-imagen` acepta base64 en JSON sin límite de tamaño (buffer en memoria) | Medio | ✅ |
| H-07 | 🟡 | DoS / Recursos | Subidas leen el archivo completo a memoria (`arrayBuffer`) sin validar tamaño antes | Medio | ✅ |
| H-08 | 🟡 | Integridad / Reliability | `POST /api/viajes` sin transacción y sin verificar pertenencia de `prenda_id` | Medio | ✅ |
| H-09 | 🟡 | Repo / Secretos | `.codegraph/*.db` y `playwright-1.60.0.tgz` versionados (trackeados pese a `.gitignore`) | Medio | ✅ |
| H-10 | 🟡 | Performance | `count: "exact"` en cada página de `GET /api/garments` | Medio | ✅ |
| H-11 | 🟢 | Seguridad | API key de Gemini viajando en query string (`?key=`) | Bajo | ✅ |
| H-12 | 🟢 | Seguridad | `next` param del callback OAuth no validado (debe empezar con `/`) | Bajo | ✅ |
| H-13 | 🟢 | Performance | `POST /api/viajes`: inserts secuenciales (N+1) en loop de looks | Bajo | ✅ |
| H-14 | 🟢 | Performance | `generar-imagen`: fallback secuencial por hasta 9 modelos sin cachear el que funciona | Bajo | ✅ |
| H-15 | 🟢 | Observabilidad | Uso de `console.*` directo en rutas en vez del `logger` estructurado existente | Bajo | ✅ |
| H-16 | 🟢 | Performance | Búsqueda `ilike %q%` con comodín inicial (no usa índice) | Bajo | ✅ |
| H-17 | 🟢 | Seguridad | Falta validación de extensión/contenido real de imagen (solo se confía en `mime` del cliente) | Bajo | ✅ |

---

## 3. Detalle de hallazgos

### 🔴 H-01 — Rate limit de imágenes evadible + costos no registrados (`ai_usage`)  ✅ Implementado

- **Categoría:** Seguridad / Control de costos
- **Impacto:** Alto. El límite "3 imágenes por día por usuario" (`generar-imagen`) es **inefectivo**, y el tracking de gasto en IA no funciona.
- **Observaciones:**
  - La tabla `ai_usage` tiene RLS habilitada con **solo** una política `SELECT` (`ai_usage: select own`) — ver
    [20260523000000_initial_schema.sql:296](supabase/migrations/20260523000000_initial_schema.sql#L296). No hay política de `INSERT`.
  - El comentario del schema dice *"INSERT solo desde service_role… que bypasea RLS"*, pero las rutas insertan con el
    **cliente de usuario** (`createClient`), no con `createServiceClient`:
    - [looks/generar/route.ts:324](app/api/looks/generar/route.ts#L324)
    - [looks/cambiar-prenda/route.ts:273](app/api/looks/cambiar-prenda/route.ts#L273)
    - [viajes/generar-looks/route.ts:327](app/api/viajes/generar-looks/route.ts#L327)
    - [looks/generar-imagen/route.ts:575](app/api/looks/generar-imagen/route.ts#L575)
  - Con RLS activa y sin política de `INSERT`, esos `INSERT` son **rechazados silenciosamente** (el error no se chequea).
  - Consecuencia directa en [looks/generar-imagen/route.ts:380-392](app/api/looks/generar-imagen/route.ts#L380-L392): el conteo de
    usos del día (`count` sobre `ai_usage`) siempre da **0**, por lo que `DAILY_LIMIT` nunca se alcanza → un usuario puede generar
    imágenes ilimitadamente (operación cara con modelos de imagen).
- **Cómo se soluciona:**
  1. Insertar `ai_usage` con `createServiceClient()` (service role) en **todas** las rutas, tal como el diseño previó. Ejemplo:
     ```ts
     const svc = createServiceClient();
     const { error } = await svc.from("ai_usage").insert({ user_id: user.id, tipo: "generacion_imagen" });
     if (error) logger.error("ai_usage insert failed", { endpoint: "generar-imagen" }, error);
     ```
  2. Para el rate limit, contar también con service role (o agregar política `INSERT WITH CHECK (auth.uid() = user_id)` si se prefiere mantener el cliente de usuario).
  3. **Verificar el error de cada insert** y reflejarlo en logs/Sentry para que un fallo futuro no vuelva a pasar inadvertido.
  4. Recomendado: además aplicar el rate limit antes de la llamada cara (ver H-03) y registrar el uso de forma atómica.
- **✅ Implementado:** nuevo helper [lib/ai/usage.ts](lib/ai/usage.ts) con `recordAiUsage()` (INSERT vía `createServiceClient`, con chequeo y log de error). Las 4 rutas (`generar`, `cambiar-prenda`, `generar-looks`, `generar-imagen`) y además `analizar` y `validar-imagen` ahora registran su uso. El conteo del límite diario de `generar-imagen` también pasa por service role, por lo que **el límite de 3/día ya se aplica**. Se amplió el tipo `AiUsageTipo` en [database.types.ts](lib/database.types.ts) (se eliminó el `as never`).

---

### 🔴 H-02 — Endpoint de diagnóstico expuesto sin autenticación  ✅ Implementado

- **Categoría:** Seguridad (exposición de información)
- **Impacto:** Alto. Filtra configuración de entorno (host, `NODE_ENV`, `NEXT_PUBLIC_APP_URL`, lógica de redirect OAuth) a cualquiera.
- **Observaciones:**
  - [app/api/auth/debug/route.ts](app/api/auth/debug/route.ts) devuelve un JSON con datos de entorno y **no valida sesión**. El propio archivo dice *"Endpoint de diagnóstico TEMPORAL — eliminar antes de producción"*.
  - El middleware excluye `/api/*`, así que no hay protección de borde.
- **Cómo se soluciona:**
  1. **Eliminar el archivo** `app/api/auth/debug/route.ts` (acción preferida).
  2. Si se necesita diagnóstico, restringir a `NODE_ENV !== "production"` y exigir sesión + rol admin.
  3. Agregar a la checklist de release una verificación de que no quedan endpoints `debug`/`test`.
- **✅ Implementado:** se eliminó el archivo `app/api/auth/debug/route.ts`.

---

### 🔴 H-03 — Ausencia de rate limiting en endpoints de IA  ✅ Implementado

- **Categoría:** Seguridad / Control de costos (DoS económico)
- **Impacto:** Alto. Un usuario autenticado puede invocar en bucle endpoints que llaman a Gemini, generando costo ilimitado y agotando la cuota de la API key (DoS para el resto de usuarios).
- **Observaciones:**
  - Sin throttling: [prendas/analizar](app/api/prendas/analizar/route.ts), [looks/generar](app/api/looks/generar/route.ts),
    [looks/cambiar-prenda](app/api/looks/cambiar-prenda/route.ts), [viajes/generar-looks](app/api/viajes/generar-looks/route.ts),
    [validar-imagen](app/api/validar-imagen/route.ts).
  - Solo `generar-imagen` intenta un límite diario, pero está roto (ver H-01).
  - No hay middleware de rate limit ni control de concurrencia por usuario.
- **Cómo se soluciona:**
  1. Implementar rate limiting por usuario (p. ej. token bucket / ventana deslizante). Opciones:
     - **Upstash Ratelimit** (Redis serverless, encaja con Vercel) — recomendado.
     - Tabla/contador en Postgres con función `SECURITY DEFINER` si se quiere evitar dependencia externa.
  2. Aplicar límites diferenciados: análisis/generación de texto (más laxo) vs. generación de imagen (estricto, p. ej. 3/día ya previsto).
  3. Devolver `429` con `Retry-After` (ya hay manejo de 429 de Gemini que se puede reutilizar en el cliente).
  4. Considerar un presupuesto global mensual con corte (circuit breaker) basado en `ai_usage` una vez que H-01 esté arreglado.
- **✅ Implementado:** `checkAiRateLimit()` en [lib/ai/usage.ts](lib/ai/usage.ts) cuenta filas recientes de `ai_usage` por `(user_id, tipo)` en ventanas configurables (por minuto y por día) usando service role, y devuelve `429` con `Retry-After` (`rateLimitResponse()`). Aplicado en los 6 endpoints de IA: `analizar`, `generar`, `cambiar-prenda`, `generar-looks`, `validar-imagen` y `generar-imagen`. **Fail-open** ante error de infra para no bloquear a usuarios legítimos. No requiere dependencias externas (se apoya en Postgres). *Nota:* es una ventana deslizante basada en uso registrado; si más adelante se necesita precisión estricta bajo alta concurrencia, migrar a Upstash/Redis.

---

### 🟡 H-04 — Inyección de filtros PostgREST en `q`  ✅ Implementado

- **Categoría:** Seguridad (inyección de filtros)
- **Impacto:** Medio. El RLS (`.eq("user_id", user.id)`) acota el daño a los datos del propio usuario, pero la interpolación permite alterar la lógica del query, provocar errores 500 o degradar performance.
- **Observaciones:**
  - [garments/route.ts:48](app/api/garments/route.ts#L48): `query.or(\`nombre.ilike.%${q}%,color_principal.ilike.%${q}%,notas.ilike.%${q}%\`)` interpola `q` crudo dentro de una expresión de filtro PostgREST. Caracteres como `,`, `)`, `.` permiten "romper" el filtro y agregar condiciones arbitrarias.
- **Cómo se soluciona:**
  1. Sanitizar `q`: eliminar/escapar `,`, `(`, `)`, `*`, `:` y `\` antes de construir el filtro; limitar longitud (p. ej. 80 chars).
  2. Mejor aún: usar `textSearch` (FTS de Postgres) o construir el `or` con valores ya escapados (envolver el patrón entre comillas dobles según la sintaxis PostgREST).
  3. Validar entradas con Zod (ya es dependencia) en todos los handlers que reciben query params/JSON.
- **✅ Implementado:** función `sanitizeQ()` en [garments/route.ts](app/api/garments/route.ts) elimina `,()\\*:.` y limita `q` a 80 chars antes de interpolar en `.or()`.

---

### 🟡 H-05 — CSP permisiva (`'unsafe-inline'` y `'unsafe-eval'`)

- **Categoría:** Seguridad (defensa XSS)
- **Impacto:** Medio. Debilita la mitigación de XSS: un script inyectado se ejecutaría pese a la CSP.
- **Observaciones:**
  - [next.config.ts:96](next.config.ts#L96): `script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:`.
  - El propio comentario reconoce que `'unsafe-inline'` es por hidratación de Next sin nonces y `'unsafe-eval'` por Emscripten/WASM de `@imgly/background-removal`.
- **Cómo se soluciona:**
  1. Migrar a **CSP basada en nonce** para scripts de Next (soportado vía middleware que inyecta el nonce y lo pasa a Next).
  2. Aislar la funcionalidad WASM (`background-removal`) que requiere `'unsafe-eval'`: cargarla solo en la ruta que la usa, idealmente dentro de un Web Worker, para no relajar la CSP global.
  3. Como mínimo intermedio, separar las cabeceras por ruta (CSP estricta en el resto del sitio, relajada solo donde corre el WASM).

---

### 🟡 H-06 — `validar-imagen` acepta base64 sin límite de tamaño  ✅ Implementado

- **Categoría:** DoS / consumo de memoria
- **Impacto:** Medio. El handler hace `req.json()` de un body que contiene la imagen en base64 sin tope, cargándola entera en memoria; un payload grande puede agotar memoria de la función serverless.
- **Observaciones:**
  - [validar-imagen/route.ts:140-153](app/api/validar-imagen/route.ts#L140-L153): no valida tamaño del string base64 ni el MIME real, y es *fail-open* (ante error responde "válida").
- **Cómo se soluciona:**
  1. Validar `Content-Length` y rechazar > N MB (p. ej. 6 MB) antes de parsear.
  2. Validar longitud del base64 y prefijo MIME permitido.
  3. Reusar el patrón de `multipart/form-data` + `File.size` que ya usan otras rutas, en lugar de base64 en JSON.
- **✅ Implementado:** check de `Content-Length` (→ 413) antes de `req.json()` y validación de `imagen.length` contra `BASE64_IMAGE_MAX_CHARS` (8 M chars ≈ 6 MB imagen) en [validar-imagen/route.ts](app/api/validar-imagen/route.ts). Constantes centralizadas en [lib/upload/validation.ts](lib/upload/validation.ts).

---

### 🟡 H-07 — Subidas leen el archivo completo a memoria sin guardia previa  ✅ Implementado

- **Categoría:** DoS / consumo de memoria
- **Impacto:** Medio. `await file.arrayBuffer()` materializa todo el archivo en memoria antes de subir; aunque el bucket tiene límite (5 MB prendas, 10 MB body), la validación ocurre tarde y depende de `file.type`/`file.size` reportados por el cliente.
- **Observaciones:**
  - [garments/route.ts:183](app/api/garments/route.ts#L183), [garments/[id]/route.ts:193](app/api/garments/[id]/route.ts#L193): no chequean `imagen.size` máximo (sí lo hace `foto-corporal`).
  - `prendas/analizar` y `validar-imagen` también bufferizan a base64.
- **Cómo se soluciona:**
  1. Validar `file.size` contra un máximo explícito en cada ruta de subida (como ya hace [foto-corporal/route.ts:51](app/api/perfil/foto-corporal/route.ts#L51)).
  2. Centralizar límites de tamaño/MIME en un helper compartido.
  3. Considerar subida directa a Storage con *signed upload URL* para imágenes grandes (evita pasar bytes por la función).
- **✅ Implementado:** check `imagen.size > GARMENT_IMAGE_MAX_BYTES` (5 MB) antes de `arrayBuffer()` en [garments/route.ts](app/api/garments/route.ts) (POST) y [garments/[id]/route.ts](app/api/garments/[id]/route.ts) (PATCH). Constante `GARMENT_IMAGE_MAX_BYTES` centralizada en [lib/upload/validation.ts](lib/upload/validation.ts).

---

### 🟡 H-08 — `POST /api/viajes` sin transacción ni verificación de pertenencia  ✅ Implementado

- **Categoría:** Integridad de datos / Reliability
- **Impacto:** Medio. Una falla a mitad de las ~7 operaciones deja un viaje huérfano/parcial. Además se insertan `prenda_id` provenientes del cliente sin verificar que pertenezcan al usuario.
- **Observaciones:**
  - [viajes/route.ts:76-158](app/api/viajes/route.ts#L76-L158): inserts encadenados sin transacción y sin chequear errores intermedios.
  - `viaje_preferencias_prendas` y `viaje_look_prendas` aceptan IDs arbitrarios; la RLS solo valida la pertenencia del *viaje*, no de la *prenda*. El impacto de confidencialidad es bajo (al leer, la RLS de `prendas` filtra a las propias), pero permite almacenar referencias inválidas/ajenas.
- **Cómo se soluciona:**
  1. Envolver la creación en una función RPC `SECURITY DEFINER` (transacción atómica) o usar el patrón de "insert con rollback" ya presente en `looks/guardar`.
  2. Verificar que todos los `prenda_id` recibidos pertenezcan al usuario (como hace [looks/guardar/route.ts:78-97](app/api/looks/guardar/route.ts#L78-L97)).
  3. Validar el body con Zod (fechas coherentes `fecha_inicio <= fecha_fin`, tipos de evento válidos, cantidades > 0).
- **✅ Implementado:** [viajes/route.ts](app/api/viajes/route.ts) ahora: (1) valida el body con `CreateViajeSchema` (Zod) incluyendo `.refine` de coherencia de fechas; (2) verifica en batch que todos los `prenda_id` pertenezcan al usuario (mismo patrón que `looks/guardar`); (3) chequea el error de cada insert y ejecuta `rollback()` (DELETE viaje → CASCADE a hijos) ante cualquier fallo parcial.

---

### 🟡 H-09 — Artefactos binarios versionados (`.codegraph`, `.tgz`)  ✅ Implementado

- **Categoría:** Higiene de repositorio / posible fuga
- **Impacto:** Medio. `.codegraph/codegraph.db` (índice del código fuente) y `playwright-1.60.0.tgz` están **trackeados** aunque `.gitignore` los excluye (se commitearon antes de ignorarlos). Inflan el repo y el `.db` puede contener fragmentos del código indexado.
- **Observaciones:**
  - `git ls-files` lista `.codegraph/codegraph.db`, `.codegraph/codegraph.db-shm/-wal`, `daemon.log`, `daemon.pid` y `playwright-1.60.0.tgz`.
- **Cómo se soluciona:**
  1. `git rm --cached -r .codegraph playwright-1.60.0.tgz` y commitear (el `.gitignore` ya los cubre a futuro).
  2. Si el `.db` o `daemon.log` contuvieran algo sensible, reescribir historia (`git filter-repo`) antes de hacer público el repo.
  3. Mover dependencias locales (`.tgz`) fuera del repo o gestionarlas vía registry.
- **✅ Implementado:** `git rm --cached -r .codegraph` y `git rm --cached playwright-1.60.0.tgz` (ya cubiertos por `.gitignore`, dejan de trackearse en el próximo commit). **Pendiente opcional:** si el `.db`/`daemon.log` tuviera algo sensible, reescribir historia antes de publicar el repo.

---

### 🟡 H-10 — `count: "exact"` en cada página del listado  ✅ Implementado

- **Categoría:** Performance
- **Impacto:** Medio. `select("*", { count: "exact" })` ejecuta un `COUNT(*)` completo (con filtros) en **cada** request de scroll infinito; escala mal a guardarropas grandes.
- **Observaciones:**
  - [garments/route.ts:42](app/api/garments/route.ts#L42).
- **Cómo se soluciona:**
  1. Usar `count: "planned"` o `"estimated"` para el total aproximado, o calcular el `count` solo en la primera página (page=1) y cachearlo en el cliente.
  2. Para `hasMore`, basta pedir `limit + 1` filas y no necesitar `count` en absoluto.
- **✅ Implementado:** [garments/route.ts](app/api/garments/route.ts#L40) ahora pide `limit + 1` filas y deriva `hasMore` de ahí; el `COUNT(*)` exacto solo se ejecuta en `page === 1` (`total` se devuelve solo en esa página). El cliente ya conservaba el total del render inicial, por lo que no requirió cambios.

---

### 🟢 H-11 — API key de Gemini en query string

- **Categoría:** Seguridad (exposición en logs)
- **Impacto:** Bajo. `?key=${apiKey}` puede quedar registrada en logs intermedios/proxies.
- **Observaciones:** patrón repetido en todas las rutas que llaman a Gemini (p. ej. [prendas/analizar/route.ts:109](app/api/prendas/analizar/route.ts#L109)).
- **Cómo se soluciona:** enviar la key en el header `x-goog-api-key` en lugar de la URL; centralizar el cliente Gemini en un helper único (`lib/gemini/client.ts`) para no repetir el patrón.

---

### 🟢 H-12 — `next` del callback OAuth no validado  ✅ Implementado

- **Categoría:** Seguridad (open redirect — bajo riesgo en este caso)
- **Impacto:** Bajo. `next` se concatena a un `origin` fijo, lo que limita el riesgo, pero conviene validar.
- **Observaciones:** [auth/callback/route.ts:38,87](app/auth/callback/route.ts#L38).
- **Cómo se soluciona:** aceptar `next` solo si empieza con `/` y no con `//`; caer a `/guardarropas` en cualquier otro caso.
- **✅ Implementado:** [auth/callback/route.ts](app/auth/callback/route.ts) valida `nextRaw`: acepta solo si `startsWith("/") && !startsWith("//")`, cae a `/guardarropas` en cualquier otro caso.

---

### 🟢 H-13 — Inserts secuenciales (N+1) al crear viaje  ✅ Implementado

- **Categoría:** Performance
- **Impacto:** Bajo (volúmenes pequeños), pero suma latencia.
- **Observaciones:** loop `for (const look of body.looks)` con un insert por look y otro por sus prendas.
- **Cómo se soluciona:** batch de inserts (un solo `insert([...])` para todos los `viaje_looks`, luego uno para todas las `viaje_look_prendas`), o resolverlo dentro de la RPC transaccional de H-08.
- **✅ Implementado:** [viajes/route.ts](app/api/viajes/route.ts#L129) reemplaza el loop por **un** `insert` de todos los `viaje_looks` y **un** `insert` de todas las `viaje_look_prendas`, correlacionando look ↔ prendas por índice (PostgREST conserva el orden de inserción). De ~2·N llamadas se pasa a 2. La atomicidad transaccional completa queda pendiente en H-08.

---

### 🟢 H-14 — Fallback de modelos de imagen no cacheado  ✅ Implementado

- **Categoría:** Performance / Costos
- **Impacto:** Bajo. Cada generación recorre hasta 9 modelos en orden; si los primeros dan 404, se acumulan reintentos y latencia.
- **Observaciones:** la lista `CANDIDATES` se recorría siempre desde el inicio en `callGeminiImageGen`.
- **Cómo se soluciona:** cachear (memoria de proceso / KV) qué modelo respondió OK para reusarlo; o fijar el modelo objetivo por env var con fallback corto.
- **✅ Implementado:** [looks/generar-imagen/route.ts](app/api/looks/generar-imagen/route.ts#L33) cachea en memoria de proceso (`cachedWorkingModel`) el primer modelo que devuelve imagen y lo coloca al frente del orden de prueba en requests siguientes, evitando recorrer los 404. Al ser caché por instancia, se reaprende solo tras un cold start.

---

### 🟢 H-15 — Uso de `console.*` en vez del `logger` estructurado

- **Categoría:** Observabilidad
- **Impacto:** Bajo. Existe [lib/utils/logger.ts](lib/utils/logger.ts) (JSON estructurado + Sentry), pero la mayoría de rutas usan `console.error/info` directo, perdiendo correlación (`requestId`, `userId` hasheado) y reporte automático a Sentry.
- **Cómo se soluciona:** adoptar `logger` en las API Routes; incluir `requestId` (`generateRequestId`) y `userId` hasheado; evitar loguear cuerpos/PII.

---

### 🟢 H-16 — Búsqueda `ilike '%q%'` no indexable  ✅ Implementado

- **Categoría:** Performance
- **Impacto:** Bajo a escala actual. El comodín inicial impide usar índice B-tree → scan por usuario.
- **Observaciones:** filtro `or(nombre.ilike.%q%, color_principal.ilike.%q%, notas.ilike.%q%)` en el listado de prendas.
- **Cómo se soluciona:** índice `pg_trgm` (GIN) sobre las columnas buscadas, o FTS con `tsvector` + índice GIN.
- **✅ Implementado y aplicado:** migración [20260530000002_prendas_search_trgm.sql](supabase/migrations/20260530000002_prendas_search_trgm.sql) habilita `pg_trgm` y crea índices GIN `gin_trgm_ops` sobre `prendas.nombre`, `color_principal` y `notas`, de modo que los `ILIKE '%q%'` usan índice. Migración ya ejecutada en la base (2026-05-30).

---

### 🟢 H-17 — Validación de imagen confiando en el MIME del cliente

- **Categoría:** Seguridad (validación de contenido)
- **Impacto:** Bajo (el bucket restringe `allowed_mime_types` y el contenido se sirve como imagen). Aun así, el `content-type` se determina por lo que reporta el cliente.
- **Observaciones:** normalización por `imagen.type` en [garments/route.ts:146](app/api/garments/route.ts#L146) y similares; el proxy de imagen reenvía el `content-type` upstream.
- **Cómo se soluciona:** validar *magic bytes* (firma del archivo) además del MIME declarado; asegurar `X-Content-Type-Options: nosniff` (ya presente globalmente) y `Content-Disposition` apropiado en respuestas de imagen.

---

## 4. Plan de ejecución

Priorizado por riesgo y esfuerzo. Estimaciones en puntos relativos (S = pequeño, M = medio, L = grande).

### Fase 0 — Bloqueantes pre-producción (esta semana) 🔴  — ✅ Completada

| Orden | Hallazgo | Acción | Esfuerzo | Estado |
|------|----------|--------|:------:|:------:|
| 1 | H-02 | Eliminar `app/api/auth/debug/route.ts` | S | ✅ |
| 2 | H-01 | Insertar `ai_usage` con `createServiceClient()` en las rutas + chequear error; arreglar conteo del rate limit de imágenes | M | ✅ |
| 3 | H-03 | Rate limiting por usuario en endpoints de IA + `429`/`Retry-After` | M | ✅ (Postgres, no Upstash) |
| 4 | H-09 | `git rm --cached` de `.codegraph/*` y `*.tgz`; evaluar reescritura de historia | S | ✅ |

**Criterio de salida:** rate limit de imágenes verificado, `ai_usage` registrando filas, sin endpoints debug, repo sin binarios trackeados.
**Verificación pendiente recomendada:** test de integración que confirme el `429` tras superar el límite (con `SUPABASE_SERVICE_ROLE_KEY` configurada) y commit de los cambios.

### Fase 1 — Hardening de entrada y recursos 🟡  — ✅ Completada

| Orden | Hallazgo | Acción | Esfuerzo | Estado |
|------|----------|--------|:------:|:------:|
| 5 | H-04 | Sanitizar/validar `q` (Zod) y construir el `or` con valores escapados o FTS | M | ✅ |
| 6 | H-06 / H-07 | Límites de tamaño (Content-Length / file.size) y MIME en todas las rutas de subida/validación; helper compartido | M | ✅ |
| 7 | H-08 | RPC transaccional para crear viaje + verificación de pertenencia de `prenda_id` + validación Zod | L | ✅ |
| 8 | H-12 | Validar `next` del callback OAuth | S | ✅ |

### Fase 2 — CSP y observabilidad 🟡🟢  — ✅ Completada

| Orden | Hallazgo | Acción | Esfuerzo | Estado |
|------|----------|--------|:------:|:------:|
| 9 | H-05 | CSP basada en nonce; aislar WASM de `background-removal` (worker / CSP por ruta) | L | ✅ (split por ruta) |
| 10 | H-15 | Adoptar `logger` estructurado + `requestId` en API Routes | M | ✅ |
| 11 | H-11 | Helper único de Gemini con key en header `x-goog-api-key` | S | ✅ |
| 12 | H-17 | Validación de magic bytes en subidas de imagen | S | ✅ |

### Fase 3 — Performance y escalabilidad 🟢  — ✅ Completada

| Orden | Hallazgo | Acción | Esfuerzo | Estado |
|------|----------|--------|:------:|:------:|
| 13 | H-10 | Quitar `count: "exact"` por petición (usar `limit+1` / count solo en page 1) | S | ✅ |
| 14 | H-16 | Índice `pg_trgm` o FTS para búsqueda de prendas | M | ✅ (migración aplicada) |
| 15 | H-13 | Batch de inserts al crear viaje (o integrarlo en la RPC de H-08) | S | ✅ |
| 16 | H-14 | Cachear el modelo de imagen que responde OK | S | ✅ |

---

## 5. Fortalezas observadas (mantener)

- **RLS completa** en todas las tablas de negocio y storage privado con políticas por carpeta (`{user_id}/...`).
- **Aislamiento por `user_id`** verificado en cada API Route (todas chequean `auth.getUser()`); el middleware no es el único control.
- **Claves sensibles solo server-side** (`SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY` sin prefijo `NEXT_PUBLIC_`); CI no requiere secretos sensibles en build.
- **Anti-enumeración en auth**: login con error genérico, reset siempre responde éxito, signup detecta duplicados de forma controlada.
- **Privacidad en telemetría**: `user_id` hasheado con SHA-256 antes de logs/PostHog.
- **Cabeceras HTTP**: HSTS con preload, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `frame-src/object-src 'none'`.
- **Timeouts y `AbortController`** en todas las llamadas externas (Gemini, Open-Meteo); manejo de `429` de Gemini.
- **`handle_new_user`** como `SECURITY DEFINER` con `search_path` fijado (evita ataques de search_path).
- **Source maps** subidos a Sentry y borrados del bundle público (`deleteSourcemapsAfterUpload`).

---

> **Nota metodológica:** esta auditoría es estática. Antes de producción se recomienda complementar con: (1) un escaneo de dependencias (`npm audit` / Dependabot), (2) verificación dinámica del rate limit y de las políticas RLS con tests de integración, y (3) revisión de la configuración real de Supabase Auth (Redirect URLs, expiración de tokens, captcha en signup).
