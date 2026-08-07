# Schema de base de datos — Percha

> Documentación del schema PostgreSQL en Supabase. Para el SQL completo ver `supabase/migrations/20260523000000_initial_schema.sql`.

---

## Diagrama de entidades

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
    auth_users ||--o{ ai_usage : "user_id"
    categories ||--o{ subcategories : "category_id"
    categories ||--o{ prendas : "category_id"
    subcategories ||--o{ prendas : "subcategory_id"
    looks ||--o{ look_prendas : "look_id"
    looks ||--o{ look_usos : "look_id"
    prendas ||--o{ look_prendas : "prenda_id (SET NULL)"
```

---

## Tablas

### `profiles`

Perfil extendido del usuario. Creado automáticamente por el trigger `on_auth_user_created` al registrar un usuario en `auth.users`.

| Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|
| `id` | `uuid` | NO | — | PK + FK a `auth.users(id)` ON DELETE CASCADE |
| `full_name` | `text` | SÍ | — | Nombre completo (opcional) |
| `avatar_url` | `text` | SÍ | — | URL del avatar (Google OAuth o subido) |
| `idioma` | `text` | NO | `'es'` | Idioma de la app: `'es'` \| `'en'` |
| `tema` | `text` | NO | `'sistema'` | Tema visual: `'claro'` \| `'oscuro'` \| `'sistema'` |
| `clima_habilitado` | `boolean` | NO | `true` | Si el widget de clima está activo |
| `ciudad_nombre` | `text` | SÍ | — | Nombre de ciudad configurada manualmente |
| `ciudad_latitud` | `float` | SÍ | — | Latitud de la ciudad |
| `ciudad_longitud` | `float` | SÍ | — | Longitud de la ciudad |
| `ciudad_pais` | `text` | SÍ | — | País de la ciudad |
| `estilos_favoritos` | `jsonb` | NO | `'[]'` | Array de strings: `["casual","clasico",...]` |
| `ocasiones_frecuentes` | `jsonb` | NO | `'[]'` | Array de strings: `["trabajo","casual",...]` |
| `updated_at` | `timestamptz` | NO | `now()` | Actualizado por trigger `trg_profiles_updated_at` |

**RLS:** cada usuario puede SELECT/INSERT/UPDATE solo su propio perfil. DELETE no permitido (se elimina en cascada con `auth.users`).

---

### `categories`

Categorías de prendas. Datos de referencia, cargados en el seed. Solo lectura para usuarios autenticados.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `serial` | PK autoincremental |
| `nombre` | `text` | Nombre visible: "Remeras", "Pantalones", etc. |
| `slug` | `text` | Identificador URL-safe único: "remeras", "pantalones" |

**RLS:** SELECT público (sin autenticación). INSERT/UPDATE/DELETE solo via `service_role`.

---

### `subcategories`

Subcategorías dentro de cada categoría. Mismas reglas de acceso que `categories`.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `serial` | PK autoincremental |
| `category_id` | `int` | FK a `categories(id)` ON DELETE CASCADE |
| `nombre` | `text` | Nombre visible |
| `slug` | `text` | Identificador único |

---

### `prendas`

Prenda del guardarropa de un usuario. Tabla principal de EP-02.

| Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `user_id` | `uuid` | NO | — | FK a `auth.users(id)` ON DELETE CASCADE |
| `nombre` | `text` | NO | — | Nombre de la prenda |
| `category_id` | `int` | SÍ | — | FK a `categories(id)` |
| `subcategory_id` | `int` | SÍ | — | FK a `subcategories(id)` |
| `color_principal` | `text` | SÍ | — | Color en texto libre o hex |
| `estaciones` | `jsonb` | NO | `'[]'` | `["primavera","verano","otono","invierno","todo_el_anio"]` |
| `estilos` | `jsonb` | NO | `'[]'` | `["casual","clasico","deportivo","elegante","bohemio","urbano"]` |
| `ocasiones` | `jsonb` | NO | `'[]'` | `["casual","trabajo","formal","deporte","salida"]` |
| `estado` | `text` | SÍ | — | `'nueva'` \| `'buena'` \| `'desgastada'` |
| `notas` | `text` | SÍ | — | Notas libres del usuario |
| `etiquetas` | `jsonb` | NO | `'[]'` | Tags personalizados |
| `imagen_url` | `text` | SÍ | — | Path en Storage: `{user_id}/{prenda_id}.webp` |
| `is_favorite` | `boolean` | NO | `false` | Marcada como favorita |
| `ia_analizada` | `boolean` | NO | `false` | Si Gemini ya analizó la prenda |
| `ia_descripcion` | `text` | SÍ | — | Descripción generada por IA |
| `deleted_at` | `timestamptz` | SÍ | — | Soft delete — prenda eliminada pero historial preservado |
| `created_at` | `timestamptz` | NO | `now()` | Fecha de creación |
| `updated_at` | `timestamptz` | NO | `now()` | Actualizado por trigger |

> **Por qué JSONB para `estaciones`, `estilos`, `ocasiones`:** Ver [ADR-004](../architecture/adr/ADR-004-jsonb-prendas.md).

> **Por qué soft delete (`deleted_at`):** Las prendas eliminadas pueden estar referenciadas en `look_prendas`. Usando soft delete se preserva el historial de looks sin romper la FK.

**Índices:**
- `idx_prendas_user_id` — listado del guardarropa
- `idx_prendas_category_id` — filtro por categoría
- `idx_prendas_user_favorite` — partial index (solo favoritas)
- `idx_prendas_user_deleted` — partial index (solo no eliminadas)

**RLS:** aislamiento total por `user_id`. SELECT/INSERT/UPDATE/DELETE solo del propio usuario.

---

### `looks`

Look guardado por el usuario. Generado por IA o armado manualmente.

| Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `user_id` | `uuid` | NO | — | FK a `auth.users(id)` ON DELETE CASCADE |
| `nombre` | `text` | NO | — | Nombre del look (generado por IA o editado) |
| `descripcion_ia` | `text` | SÍ | — | Descripción narrativa generada por Gemini |
| `parametros_generacion` | `jsonb` | NO | `'{}'` | Contexto de generación: `{ocasion, clima, prenda_base_id, ...}` |
| `created_at` | `timestamptz` | NO | `now()` | — |
| `updated_at` | `timestamptz` | NO | `now()` | Actualizado por trigger |

**Índices:** `idx_looks_user_id`

**RLS:** aislamiento total por `user_id`.

---

### `look_prendas`

Relación M:N entre looks y prendas. Registra qué prendas componen un look.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `uuid` | PK |
| `look_id` | `uuid` | FK a `looks(id)` ON DELETE CASCADE |
| `prenda_id` | `uuid` | FK a `prendas(id)` **ON DELETE SET NULL** |
| `es_prenda_base` | `boolean` | Si fue la prenda base al generar el look |
| `prenda_eliminada` | `boolean` | Flag cuando `prenda_id` pasa a NULL (prenda eliminada) |

> La FK de `prenda_id` usa `SET NULL` en lugar de `CASCADE` para que eliminar una prenda no destruya el historial de looks que la incluía. `prenda_eliminada = true` indica que esa posición del look ya no tiene prenda disponible.

**Índices:** `idx_look_prendas_look_id`

**RLS:** acceso via subquery a `looks.user_id`.

---

### `look_usos`

Historial de fechas en que se usó un look. Inmutable una vez creado.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `uuid` | PK |
| `look_id` | `uuid` | FK a `looks(id)` ON DELETE CASCADE |
| `fecha_uso` | `date` | Fecha del uso (solo fecha, sin hora) |
| `created_at` | `timestamptz` | Cuándo se registró el uso |

**Índices:** `idx_look_usos_look_id`, `idx_look_usos_fecha` (desc, para "último uso")

**RLS:** SELECT/INSERT/DELETE via subquery a `looks.user_id`. UPDATE no permitido.

---

### `ai_usage`

Registro de llamadas a la IA para tracking de costos y métricas. Solo escritura desde `service_role` en API Routes.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `uuid` | PK |
| `user_id` | `uuid` | FK a `auth.users(id)` ON DELETE CASCADE |
| `tipo` | `text` | `'analisis_prenda'` \| `'generacion_look'` \| `'cambio_prenda'` |
| `tokens_usados` | `int` | Tokens de entrada + salida reportados por la API |
| `costo_estimado` | `numeric(10,6)` | Costo en USD según pricing de Gemini |
| `created_at` | `timestamptz` | Timestamp de la llamada |

**Índices:** `idx_ai_usage_user_date` (user_id, created_at DESC) — para métricas por usuario y período

**RLS:** SELECT del propio usuario. INSERT/UPDATE/DELETE solo via `service_role` (API Routes bypasean RLS).

---

## Funciones y triggers

### `set_updated_at()`

Trigger function que actualiza `updated_at = now()` antes de cada UPDATE. Aplicada en: `profiles`, `prendas`, `looks`.

### `handle_new_user()`

Trigger AFTER INSERT en `auth.users`. Crea automáticamente el perfil en `profiles` con `full_name` y `avatar_url` tomados de `raw_user_meta_data` (provisto por Google OAuth o el formulario de registro). Declarada con `SECURITY DEFINER` para poder escribir en `public.profiles` desde el contexto de `auth`.

---

## Storage

### Bucket `prendas`

| Propiedad | Valor |
|---|---|
| Acceso | **Privado** — URLs firmadas (signed URLs) con TTL de 1 hora |
| Límite por archivo | 5 MB |
| MIME types permitidos | `image/webp`, `image/jpeg`, `image/png` |
| Path | `{user_id}/{prenda_id}.webp` |

**Políticas RLS:** SELECT/INSERT/UPDATE/DELETE solo si `auth.uid() == storage.foldername(name)[1]` (primer segmento del path = user_id).

### Bucket `avatars`

| Propiedad | Valor |
|---|---|
| Acceso | **Público** — URLs directas sin autenticación |
| Límite por archivo | 2 MB |
| MIME types permitidos | `image/webp`, `image/jpeg`, `image/png` |
| Path | `{user_id}/avatar.webp` |

**Políticas RLS:** SELECT público. INSERT/UPDATE/DELETE solo del propio usuario.

---

## Decisiones de diseño relevantes

| Decisión | Razón |
|---|---|
| JSONB para arrays multivalor | Ver [ADR-004](../architecture/adr/ADR-004-jsonb-prendas.md) |
| Soft delete en `prendas` | Preservar historial de looks sin romper FKs |
| `SET NULL` en `look_prendas.prenda_id` | Idem anterior — historial de looks intacto |
| `ai_usage` solo escritura via service_role | Evitar que el cliente manipule métricas de costo |
| Trigger `handle_new_user` | Garantizar que todo usuario tenga perfil; evitar lógica duplicada en múltiples providers OAuth |
| `SECURITY DEFINER` en trigger | Necesario para que el trigger de `auth.users` pueda insertar en `public.profiles` |
