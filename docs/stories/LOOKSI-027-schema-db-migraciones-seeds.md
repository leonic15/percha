# [EP-07] Schema de base de datos, migraciones y seeds

**ID:** LOOKSI-027  
**Épica:** EP-07 — Infraestructura y arquitectura base  
**Prioridad:** Alta  
**Estimación:** 5 puntos  
**Estado:** Pendiente

---

## Descripción

Como **desarrollador**, quiero **tener el schema completo de la base de datos definido con migraciones versionadas y datos de seed** para **garantizar consistencia entre entornos y una base de datos lista para todas las features del MVP**.

---

## Criterios de aceptación

### Escenario 1: Migraciones ejecutables
- **Dado** que tengo el proyecto configurado con Supabase CLI
- **Cuando** ejecuto `supabase db reset`
- **Entonces** todas las migraciones se aplican en orden sin errores y la base de datos queda en el estado esperado

### Escenario 2: Schema completo y consistente
- **Dado** que las migraciones se ejecutaron
- **Cuando** reviso las tablas creadas
- **Entonces** existen todas las tablas definidas (ver Notas técnicas) con sus columnas, tipos, constraints y relaciones correctas

### Escenario 3: Seed de datos de referencia
- **Dado** que las migraciones se ejecutaron
- **Cuando** ejecuto el seed
- **Entonces** la tabla `categories` tiene las 8 categorías y la tabla `subcategories` tiene todas las subcategorías asociadas definidas en LOOKSI-009

### Escenario 4: Trigger de creación de perfil
- **Dado** que se crea un nuevo usuario en `auth.users` (por email o Google)
- **Cuando** el trigger se dispara
- **Entonces** se crea automáticamente un registro en `profiles` con los valores por defecto correctos

### Escenario 5: RLS habilitado en todas las tablas
- **Dado** que las migraciones se ejecutaron
- **Cuando** reviso las políticas de RLS
- **Entonces** todas las tablas tienen RLS habilitado con políticas que garantizan que cada usuario solo puede acceder a sus propios datos (detalle en LOOKSI-029)

---

## Notas técnicas

- **Schema completo:**

```sql
-- Perfiles de usuario
profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  idioma TEXT DEFAULT 'es',
  tema TEXT DEFAULT 'sistema',
  clima_habilitado BOOLEAN DEFAULT true,
  ciudad_nombre TEXT,
  ciudad_latitud FLOAT,
  ciudad_longitud FLOAT,
  ciudad_pais TEXT,
  estilos_favoritos JSONB DEFAULT '[]',
  ocasiones_frecuentes JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT now()
)

-- Categorías de prendas
categories (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL
)

-- Subcategorías de prendas
subcategories (
  id SERIAL PRIMARY KEY,
  category_id INT REFERENCES categories(id),
  nombre TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL
)

-- Prendas del guardarropas
prendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  category_id INT REFERENCES categories(id),
  subcategory_id INT REFERENCES subcategories(id),
  color_principal TEXT,
  estaciones JSONB DEFAULT '[]',
  estilos JSONB DEFAULT '[]',
  ocasiones JSONB DEFAULT '[]',
  estado TEXT,
  notas TEXT,
  etiquetas JSONB DEFAULT '[]',
  imagen_url TEXT,
  is_favorite BOOLEAN DEFAULT false,
  ia_analizada BOOLEAN DEFAULT false,
  ia_descripcion TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
)

-- Looks generados y guardados
looks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion_ia TEXT,
  parametros_generacion JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
)

-- Relación entre looks y prendas
look_prendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  look_id UUID REFERENCES looks(id) ON DELETE CASCADE,
  prenda_id UUID REFERENCES prendas(id) ON DELETE SET NULL,
  es_prenda_base BOOLEAN DEFAULT false,
  prenda_eliminada BOOLEAN DEFAULT false
)

-- Historial de usos de looks
look_usos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  look_id UUID REFERENCES looks(id) ON DELETE CASCADE,
  fecha_uso DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
)

-- Registro de uso de IA
ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL, -- 'analisis_prenda' | 'generacion_look' | 'cambio_prenda'
  tokens_usados INT,
  costo_estimado NUMERIC(10,6),
  created_at TIMESTAMPTZ DEFAULT now()
)
```

- Trigger `on_auth_user_created`: función PostgreSQL que inserta en `profiles` al crear usuario en `auth.users`
- Índices clave: `prendas(user_id)`, `prendas(category_id)`, `looks(user_id)`, `look_usos(look_id)`, `ai_usage(user_id, created_at)`
- Todas las migraciones en `/supabase/migrations/` con nombre `YYYYMMDDHHMMSS_descripcion.sql`
- Seed en `/supabase/seed.sql` con las categorías y subcategorías de LOOKSI-009

---

## Dependencias

- [LOOKSI-026] Setup inicial del proyecto
