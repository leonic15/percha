# Anexo A — Diagramas completos

> Complemento de la Sección 2 del [informe principal](../informe-principal.md).
> Fuente original: [`docs/architecture/diagrama-arquitectura.md`](../../architecture/diagrama-arquitectura.md) y [`docs/database/schema.md`](../../database/schema.md).

---

## A.1 · UML — Modelo de datos (diagrama entidad-relación)

Este es el diagrama de clases/entidades del sistema. Es también el mapa de la **memoria persistente**: cada tabla es una memoria que alimenta decisiones futuras de los agentes.

```mermaid
erDiagram
    auth_users {
        uuid id PK
        text email
        jsonb raw_user_meta_data
    }

    profiles {
        uuid id PK_FK
        text full_name
        text avatar_url
        text genero
        text idioma
        text tema
        boolean clima_habilitado
        text ciudad_nombre
        float ciudad_latitud
        float ciudad_longitud
        text ciudad_pais
        jsonb estilos_favoritos
        jsonb ocasiones_frecuentes
        timestamptz updated_at
    }

    categories {
        serial id PK
        text nombre
        text slug
    }

    subcategories {
        serial id PK
        int category_id FK
        text nombre
        text slug
    }

    prendas {
        uuid id PK
        uuid user_id FK
        text nombre
        int category_id FK
        int subcategory_id FK
        text color_principal
        jsonb estaciones
        jsonb estilos
        jsonb ocasiones
        text estado
        text notas
        jsonb etiquetas
        text imagen_url
        boolean is_favorite
        boolean ia_analizada
        text ia_descripcion
        timestamptz deleted_at
        timestamptz created_at
        timestamptz updated_at
    }

    looks {
        uuid id PK
        uuid user_id FK
        text nombre
        text descripcion_ia
        jsonb parametros_generacion
        text vestir_imagen_url
        timestamptz created_at
        timestamptz updated_at
    }

    look_prendas {
        uuid id PK
        uuid look_id FK
        uuid prenda_id FK
        boolean es_prenda_base
        boolean prenda_eliminada
    }

    look_usos {
        uuid id PK
        uuid look_id FK
        date fecha_uso
        timestamptz created_at
    }

    viajes {
        uuid id PK
        uuid user_id FK
        jsonb destinos
        date fecha_inicio
        date fecha_fin
        text modo_optimizacion
        jsonb eventos
        timestamptz created_at
    }

    ai_usage {
        uuid id PK
        uuid user_id FK
        text tipo
        int tokens_usados
        numeric costo_estimado
        timestamptz created_at
    }

    auth_users ||--|| profiles : "trigger on INSERT"
    auth_users ||--o{ prendas : "user_id"
    auth_users ||--o{ looks : "user_id"
    auth_users ||--o{ viajes : "user_id"
    auth_users ||--o{ ai_usage : "user_id"
    categories ||--o{ subcategories : "category_id"
    categories ||--o{ prendas : "category_id"
    subcategories ||--o{ prendas : "subcategory_id"
    looks ||--o{ look_prendas : "look_id"
    looks ||--o{ look_usos : "look_id"
    prendas ||--o{ look_prendas : "prenda_id (SET NULL)"
    viajes ||--o{ looks : "looks del viaje"
```

### Decisiones de modelado destacadas

| Decisión | Razón |
|---|---|
| **Soft delete en `prendas`** (`deleted_at`) | Una prenda eliminada puede estar referenciada en `look_prendas`. El soft-delete preserva el historial de looks sin romper la integridad referencial, y permite deshacer. |
| **JSONB para `estaciones`, `estilos`, `ocasiones`** | Son listas cerradas de baja cardinalidad que siempre se leen completas con la prenda. Normalizarlas hubiera significado tres tablas de join para ningún beneficio de consulta. Documentado en `ADR-004`. |
| **`parametros_generacion` como JSONB en `looks`** | Guarda ocasión, contexto, clima y modo con los que se generó el look. Permite **regenerar** un look con los mismos parámetros y es trazabilidad de la decisión de la IA. |
| **`ai_usage` como tabla separada** | Es simultáneamente el registro de costos, el sustrato del rate limiting y la fuente del dashboard de consumo del usuario. Solo se escribe con `service_role`. |
| **RLS en todas las tablas de usuario** | El aislamiento por `user_id` vive en la base, no en el código de la aplicación. |

---

## A.2 · Secuencia — Agregar prenda con análisis IA

Es el **ciclo de ingesta**: cómo se puebla la memoria persistente del sistema.

```mermaid
sequenceDiagram
    actor U as Usuario
    participant B as Browser (PWA)
    participant W as WASM local<br/>@imgly/background-removal
    participant VAL as POST /api/validar-imagen
    participant AN as POST /api/prendas/analizar
    participant CR as POST /api/garments
    participant G as Gemini 2.5 Flash-Lite
    participant ST as Supabase Storage
    participant DB as PostgreSQL

    U->>B: Sube o saca foto de la prenda
    B->>B: Comprime (browser-image-compression)

    B->>VAL: POST imagen base64 + tipo "prenda"
    VAL->>G: "¿esto es una prenda de ropa?"
    Note over VAL,G: Timeout 5 s — FAIL-OPEN:<br/>si la IA falla, no bloquea al usuario
    G-->>VAL: {valida, motivo}
    alt No es una prenda
        VAL-->>B: rechazo
        B-->>U: Bottom sheet bloqueante con el motivo
    else Caso dudoso
        VAL-->>B: advertencia
        B-->>U: Aviso no bloqueante — puede continuar
    end

    B->>W: Remoción de fondo (ONNX en el dispositivo)
    W-->>B: Imagen sin fondo
    Note over B,W: Esta inferencia NO sale del dispositivo<br/>y no tiene costo por uso

    B->>B: sessionStorage: percha_nueva_imagen

    B->>AN: POST imagen base64
    AN->>G: Prompt de análisis + imagen
    G-->>AN: JSON {nombre, categoría, color,<br/>estaciones, ocasiones, estilos, descripción}
    AN->>DB: recordAiUsage("analisis_prenda")
    AN-->>B: Atributos propuestos

    B-->>U: Formulario PRE-LLENADO con badges "IA"
    U->>B: Revisa y corrige (los badges desaparecen al editar)
    U->>B: Confirma

    B->>CR: POST {form + imagen}
    CR->>ST: Upload → prendas/{user_id}/{id}.webp
    CR->>DB: INSERT prendas (ia_analizada = true)
    CR-->>B: {prenda_id}
    B->>B: Limpia sessionStorage
    B-->>U: Redirige a /guardarropas
```

**Punto de diseño clave:** el usuario nunca ve un formulario vacío, pero **siempre tiene la última palabra**. La IA propone, el humano dispone, y la interfaz marca visualmente qué campo sigue siendo propuesta de la máquina y cuál ya fue confirmado por la persona.

---

## A.3 · Secuencia — Autenticación con Google OAuth

```mermaid
sequenceDiagram
    actor U as Usuario
    participant B as Browser
    participant P as proxy.ts (Edge)
    participant CB as /auth/callback
    participant SA as Supabase Auth
    participant G as Google OAuth

    U->>B: Clic "Continuar con Google"
    B->>SA: signInWithOAuth({provider: "google"})
    SA-->>B: Redirect a Google
    B->>G: Autorización de cuenta
    G-->>B: Redirect a /auth/callback?code=...
    B->>CB: GET /auth/callback?code=...
    Note over CB: Valida que el parámetro `next`<br/>empiece con "/" (hallazgo H-12)<br/>para evitar redirección abierta
    CB->>SA: exchangeCodeForSession(code)
    SA-->>CB: Sesión (JWT en cookie httpOnly)
    CB-->>B: Redirect a /guardarropas

    Note over P: En cada request siguiente, proxy.ts<br/>refresca la sesión en Edge y protege<br/>las rutas privadas antes de Node
```

---

## A.4 · Secuencia — Vestir mi look (generación de imagen)

Es la operación más cara del sistema y la que maneja el dato más sensible (foto corporal). Su tratamiento explica varias decisiones de seguridad y de control de costos.

```mermaid
sequenceDiagram
    actor U as Usuario
    participant B as Browser
    participant SV as POST /api/looks/guardar
    participant GI as POST /api/looks/generar-imagen
    participant RL as lib/ai/usage
    participant DB as PostgreSQL
    participant ST as Storage
    participant G as Gemini (modelo de imagen)

    U->>B: "Vestir mi look"
    alt Sin foto corporal en el perfil
        B-->>U: Botón deshabilitado + explicación
    end
    U->>B: Escribe el escenario (ocasión pre-llenada)

    B->>SV: Auto-guarda el look antes de generar
    SV->>DB: INSERT looks + look_prendas
    SV-->>B: look_id

    B->>GI: POST {look_id, escenario}
    GI->>RL: checkAiRateLimit("generacion_imagen")
    RL->>DB: COUNT ai_usage últimas 24 h
    alt Límite alcanzado
        RL-->>GI: denegado
        GI-->>B: 429 "Alcanzaste el límite de 3 imágenes por día. Volvé mañana."
    end

    GI->>ST: Signed URLs de la foto corporal + prendas
    GI->>G: Prompt + foto corporal + imágenes de prendas
    Note over GI,G: Fallback en cascada entre modelos<br/>de imagen si el primario no responde<br/>maxDuration 60 s en Vercel
    G-->>GI: Imagen generada
    GI->>ST: Guarda en bucket look-images (privado)
    GI->>DB: UPDATE looks.vestir_imagen_url
    GI->>RL: recordAiUsage("generacion_imagen")
    GI-->>B: URL firmada de la imagen
    B-->>U: Pantalla full-screen + "Guardar imagen" / "Otra versión"
```

---

## A.5 · Capas y responsabilidades

| Capa | Archivos | Responsabilidad | Runtime |
|---|---|---|---|
| **Middleware** | `proxy.ts` | Guard de autenticación + ruteo i18n. Refresca la sesión antes de que la request llegue a Node. | Edge |
| **Server Components** | `app/[locale]/(app)/*/page.tsx` | Fetch inicial de datos autenticados. Sin lógica de UI ni estado. | Node |
| **Client Components** | `components/features/*/` | Estado, interacción, llamadas a las API Routes. | Browser |
| **API Routes — CRUD** | `app/api/{garments,looks,perfil,viajes}/**` | Lógica de negocio determinista. Validan sesión y payload. | Node |
| **API Routes — IA** | `app/api/{prendas/analizar,validar-imagen,looks/generar,looks/cambiar-prenda,looks/generar-imagen,viajes/generar-looks}` | Los seis agentes. Construyen el prompt, llaman a Gemini con timeout, validan la salida contra la base. | Node |
| **Guarda transversal** | `lib/ai/usage.ts` | Rate limiting previo a la llamada + registro de consumo posterior. Toda ruta de IA pasa por acá. | Node |
| **Cliente de IA** | `lib/gemini/client.ts` | Único punto de contacto con la API de Gemini. La API key nunca sale de acá. | Node |
| **Datos** | `supabase/migrations/*.sql` | Schema, RLS, políticas de Storage, índices. 9 migraciones versionadas. | PostgreSQL |
| **Observabilidad** | `instrumentation*.ts`, `sentry.*.config.ts`, `lib/utils/logger.ts` | Errores de cliente, servidor y edge; logs JSON estructurados con `user_id` hasheado. | Todos |

---

## A.6 · Mapa de endpoints

**33 API Routes.** Las marcadas con ⚡ son agentes de IA y pasan obligatoriamente por `lib/ai/usage.ts`.

| Grupo | Endpoints |
|---|---|
| **Auth** | `/api/auth/{login, signup, logout, google, reset-password, update-password}` |
| **Prendas** | `/api/garments` · `/api/garments/[id]` · `/api/garments/[id]/favorite` · `/api/garments/[id]/image` · ⚡`/api/garments/[id]/analizar` · ⚡`/api/prendas/analizar` |
| **Looks** | `/api/looks` · `/api/looks/[id]` · `/api/looks/[id]/log` · `/api/looks/guardar` · ⚡`/api/looks/generar` · ⚡`/api/looks/cambiar-prenda` · `/api/looks/agregar-prenda` · ⚡`/api/looks/generar-imagen` · `/api/looks/guardar-imagen-vestir` |
| **Viajes** | `/api/viajes` · `/api/viajes/[id]` · `/api/viajes/[id]/looks/[lookId]` · ⚡`/api/viajes/generar-looks` |
| **Perfil** | `/api/perfil` · `/api/perfil/avatar` · `/api/perfil/foto-corporal` · `/api/perfil/uso-ia` |
| **Clima** | `/api/clima` · `/api/clima/ciudades` |
| **Otros** | ⚡`/api/validar-imagen` · `/api/img/[slug]` |
