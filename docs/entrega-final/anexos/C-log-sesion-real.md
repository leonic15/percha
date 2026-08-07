# Anexo C — Log de una sesión real

> Requisito de la Sección 4 de la consigna: *"una ejecución completa del sistema con datos reales (no de prueba)"*.
>
> **Estado: pendiente de captura.** Este anexo contiene el **protocolo de captura** y la estructura exacta del log. Los bloques marcados `[PEGAR AQUÍ]` se completan corriendo los pasos de abajo contra la aplicación en producción con un guardarropas real cargado.

---

## C.0 · Protocolo de captura

### Requisitos previos

- Cuenta real con **al menos 15 prendas cargadas** (no seed, no datos de prueba).
- La app corriendo en producción (Vercel) o en local contra la base de producción.
- Acceso al SQL Editor de Supabase.

### Paso 1 — Habilitar la traza detallada

En local, correr el servidor capturando stdout a archivo:

```bash
npm run dev 2>&1 | tee docs/entrega-final/anexos/sesion-real.log
```

En producción, la traza sale de **Vercel → Deployment → Functions → Logs**, filtrando por `/api/looks/generar`. Exportar como texto.

### Paso 2 — Ejecutar el ciclo completo en la app

Recorrer, en una sola sesión y sin cortar:

1. Login.
2. Agregar una prenda real (foto → validación → análisis → revisión → guardar).
3. Ir al generador, permitir geolocalización, elegir una ocasión y escribir un contexto real.
4. Generar el look.
5. Cambiar una prenda del look.
6. Guardar el look.
7. Marcar el look como usado.
8. Abrir `/perfil` y capturar el dashboard de consumo de IA.

### Paso 3 — Extraer el registro de consumo de IA

En el SQL Editor de Supabase:

```sql
-- Consumo de IA de la sesión, por operación
select
  tipo,
  count(*)                       as llamadas,
  sum(tokens_usados)             as tokens_total,
  round(sum(costo_estimado), 6)  as costo_usd,
  min(created_at)                as primera,
  max(created_at)                as ultima
from ai_usage
where user_id = '<UUID_DEL_USUARIO>'
  and created_at >= '<TIMESTAMP_INICIO_SESION>'
group by tipo
order by primera;
```

```sql
-- Traza cronológica fila por fila
select tipo, tokens_usados, costo_estimado, created_at
from ai_usage
where user_id = '<UUID_DEL_USUARIO>'
  and created_at >= '<TIMESTAMP_INICIO_SESION>'
order by created_at;
```

```sql
-- El look generado y sus prendas
select l.id, l.nombre, l.descripcion_ia, l.parametros_generacion, l.created_at,
       p.nombre as prenda, p.color_principal, c.nombre as categoria
from looks l
join look_prendas lp on lp.look_id = l.id
join prendas p       on p.id = lp.prenda_id
left join categories c on c.id = p.category_id
where l.id = '<LOOK_ID>';
```

> **Antes de pegar:** anonimizar el `user_id` real. En el informe usar el hash SHA-256 de los primeros 8 caracteres, que es exactamente el formato con el que la aplicación lo escribe en sus propios logs.

---

## C.1 · Metadatos de la sesión

| Campo | Valor |
|---|---|
| Fecha y hora | `[PEGAR AQUÍ]` |
| Entorno | `[producción Vercel / local contra DB de producción]` |
| Usuario (hash) | `[PEGAR AQUÍ — primeros 8 chars del SHA-256]` |
| Prendas en el guardarropas | `[PEGAR AQUÍ]` |
| Dispositivo | `[PEGAR AQUÍ — ej: iPhone, Safari, PWA instalada]` |

---

## C.2 · Traza de la generación de look

### Entrada del usuario

```json
{
  "ocasion":  "[PEGAR AQUÍ]",
  "contexto": "[PEGAR AQUÍ — el texto libre real que se escribió]",
  "modo":     "desde_cero",
  "clima":    { "temperatura": 0, "condicion": "[PEGAR AQUÍ]" }
}
```

### Traza server-side

Estructura que emite `POST /api/looks/generar` (ver `app/api/looks/generar/route.ts`). Pegar la traza real:

```
[PEGAR AQUÍ — salida real del logger]

Estructura esperada:
  auth.getUser            → user_id validado
  checkAiRateLimit        → generacion_look · allowed
  SELECT prendas          → N prendas (deleted_at IS NULL, límite 100)
  SELECT profiles.genero  → genero
  SELECT últimos 5 looks  → look_prendas → M prendas usadas recientemente
  shuffle Fisher-Yates    → inventario reordenado
  SELECT categories       → mapa de categorías
  gemini call             → gemini-2.5-flash-lite · temperature 0.5 · maxOutputTokens 512
  gemini response         → HTTP 200 · totalTokenCount: T · latencia: L ms
  validación de IDs       → K devueltos → K' válidos (K-K' descartados por no existir)
  createSignedUrls        → K' URLs firmadas (TTL 3600 s)
  recordAiUsage           → INSERT ai_usage (service role) OK
```

### Prompt efectivo enviado al modelo

El prompt se construye server-side en `app/api/looks/generar/route.ts`. Pegar el prompt real de esta sesión (el inventario listado es dato real del usuario):

```
[PEGAR AQUÍ — prompt completo]
```

> Para capturarlo, agregar temporalmente un `logger.debug("prompt", { prompt })` antes de la llamada a Gemini, o inspeccionarlo desde el debugger. **Quitar el log antes de volver a desplegar** — el prompt contiene el inventario completo del usuario.

### Respuesta cruda del modelo

```json
[PEGAR AQUÍ — el JSON exacto que devolvió Gemini, sin editar]
```

### Validación aplicada sobre la respuesta

| Control | Resultado |
|---|---|
| IDs devueltos por el modelo | `[N]` |
| IDs que existen en el guardarropas del usuario | `[N']` |
| IDs descartados por inexistentes (alucinación) | `[N - N']` |
| Prendas del mismo grupo repetidas | `[sí / no]` |
| Prenda de parte inferior presente | `[sí / no]` |
| Abrigo sin prenda base debajo | `[sí / no]` |

> Estos cuatro últimos controles son las **reglas de composición** que se agregaron al prompt tras detectar fallas reales del modelo. Verificarlas sobre una ejecución real es la evidencia de que la corrección funciona.

### Salida presentada al usuario

| Campo | Valor |
|---|---|
| Nombre del look | `[PEGAR AQUÍ]` |
| Descripción generada | `[PEGAR AQUÍ]` |
| Prendas seleccionadas | `[PEGAR AQUÍ — nombre, categoría, color de cada una]` |
| Prendas faltantes señaladas | `[PEGAR AQUÍ]` |
| Latencia total percibida | `[PEGAR AQUÍ] ms` |

---

## C.3 · Traza del cambio de una prenda

```
[PEGAR AQUÍ]

Estructura esperada (app/api/looks/cambiar-prenda/route.ts):
  checkAiRateLimit   → cambio_prenda · allowed
  prenda a reemplazar → id + categoría
  candidatas filtradas → hasta 30 de la misma categoría, excluyendo las ya presentes
  gemini call         → timeout 15 s
  respuesta           → 1 prenda elegida + justificación
  validación          → la prenda existe y pertenece al usuario
  recordAiUsage       → cambio_prenda
```

| Campo | Valor |
|---|---|
| Prenda reemplazada | `[PEGAR AQUÍ]` |
| Candidatas evaluadas | `[PEGAR AQUÍ]` |
| Prenda elegida | `[PEGAR AQUÍ]` |
| Latencia | `[PEGAR AQUÍ] ms` |

---

## C.4 · Registro de consumo de IA de la sesión

Resultado de las consultas del Paso 3:

| Operación | Llamadas | Tokens | Costo estimado (USD) |
|---|---|---|---|
| `validacion_imagen` | `[ ]` | `[ ]` | `[ ]` |
| `analisis_prenda` | `[ ]` | `[ ]` | `[ ]` |
| `generacion_look` | `[ ]` | `[ ]` | `[ ]` |
| `cambio_prenda` | `[ ]` | `[ ]` | `[ ]` |
| **Total de la sesión** | `[ ]` | `[ ]` | `[ ]` |

Traza cronológica fila por fila:

```
[PEGAR AQUÍ — resultado de la segunda consulta SQL]
```

**Lectura de este registro.** Esta tabla es la evidencia de que el control de costos funciona de punta a punta: cada operación de IA dejó su fila, escrita con `service_role` (hallazgo H-01 remediado), y esas mismas filas son las que consulta `checkAiRateLimit()` antes de autorizar la siguiente llamada. El mismo dato alimenta el dashboard que ve el usuario en `/perfil`.

---

## C.5 · Estado persistido después de la sesión

```
[PEGAR AQUÍ — resultado de la tercera consulta SQL: el look guardado con sus prendas]
```

| Verificación | Resultado |
|---|---|
| `looks` — fila creada con `parametros_generacion` completo | `[ ]` |
| `look_prendas` — una fila por prenda del look | `[ ]` |
| `look_usos` — fila del registro de uso | `[ ]` |
| `prendas` — la prenda nueva con `ia_analizada = true` e `ia_descripcion` | `[ ]` |
| Storage — imagen en `prendas/{user_id}/{id}.webp`, bucket privado | `[ ]` |

Esta verificación cierra el ciclo: la sesión no solo produjo una salida visible, **modificó la memoria persistente** que va a condicionar las próximas decisiones del estilista (el lazo 7 → 3 del diagrama de ciclo del informe principal).

---

## C.6 · Evidencia complementaria disponible en vivo

| Fuente | Qué muestra | Cómo se accede |
|---|---|---|
| Dashboard de consumo de IA | Barras de uso por tipo contra el límite diario, en tiempo real | `/perfil` en la app · `GET /api/perfil/uso-ia` |
| Tabla `ai_usage` | Una fila por llamada a IA, con tipo, tokens y costo | Supabase → Table Editor |
| Sentry | Errores de cliente, servidor y edge de sesiones reales | Proyecto Sentry |
| PostHog (EU) | Eventos de producto con `user_id` hasheado | Proyecto PostHog |
| Vercel Functions Logs | Traza de ejecución de cada API Route en producción | Vercel → Deployment → Functions |
