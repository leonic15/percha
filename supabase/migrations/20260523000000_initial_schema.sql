-- =============================================================================
-- Percha — Migración inicial
-- PERCHA-027: Schema completo, trigger, índices y RLS
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensiones
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()


-- ---------------------------------------------------------------------------
-- TABLA: profiles
-- Un perfil por usuario auth.users. Se crea via trigger.
-- ---------------------------------------------------------------------------
CREATE TABLE profiles (
  id                   UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name            TEXT,
  avatar_url           TEXT,
  -- Preferencias de app (PERCHA-025)
  idioma               TEXT        NOT NULL DEFAULT 'es',
  tema                 TEXT        NOT NULL DEFAULT 'sistema',  -- 'claro' | 'oscuro' | 'sistema'
  clima_habilitado     BOOLEAN     NOT NULL DEFAULT true,
  -- Ciudad para clima (PERCHA-023)
  ciudad_nombre        TEXT,
  ciudad_latitud       FLOAT,
  ciudad_longitud      FLOAT,
  ciudad_pais          TEXT,
  -- Preferencias de estilo (PERCHA-024) — JSONB para arrays flexibles
  estilos_favoritos    JSONB       NOT NULL DEFAULT '[]',
  ocasiones_frecuentes JSONB       NOT NULL DEFAULT '[]',
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  profiles                      IS 'Perfil extendido de usuario. 1:1 con auth.users.';
COMMENT ON COLUMN profiles.estilos_favoritos    IS 'Array de strings: ["casual","clasico","deportivo",...]';
COMMENT ON COLUMN profiles.ocasiones_frecuentes IS 'Array de strings: ["trabajo","casual","formal",...]';


-- ---------------------------------------------------------------------------
-- TABLA: categories
-- Categorías de prendas — datos de referencia (solo escritura via service role)
-- ---------------------------------------------------------------------------
CREATE TABLE categories (
  id     SERIAL PRIMARY KEY,
  nombre TEXT   NOT NULL,
  slug   TEXT   NOT NULL UNIQUE
);

COMMENT ON TABLE categories IS 'Categorías de prendas. Lectura pública, escritura solo service_role.';


-- ---------------------------------------------------------------------------
-- TABLA: subcategories
-- Subcategorías, dependientes de categories
-- ---------------------------------------------------------------------------
CREATE TABLE subcategories (
  id          SERIAL  PRIMARY KEY,
  category_id INT     NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  nombre      TEXT    NOT NULL,
  slug        TEXT    NOT NULL UNIQUE
);

COMMENT ON TABLE subcategories IS 'Subcategorías de prendas. FK a categories.';


-- ---------------------------------------------------------------------------
-- TABLA: prendas
-- Prenda del guardarropas de un usuario
-- ---------------------------------------------------------------------------
CREATE TABLE prendas (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre           TEXT        NOT NULL,
  category_id      INT         REFERENCES categories(id),
  subcategory_id   INT         REFERENCES subcategories(id),
  color_principal  TEXT,
  -- Atributos multivalor — JSONB permite arrays flexibles sin tabla de join (PERCHA-004 ADR)
  estaciones       JSONB       NOT NULL DEFAULT '[]',  -- ["primavera","verano","otono","invierno","todo_el_anio"]
  estilos          JSONB       NOT NULL DEFAULT '[]',  -- ["casual","clasico","deportivo","elegante","bohemio","urbano"]
  ocasiones        JSONB       NOT NULL DEFAULT '[]',  -- ["casual","trabajo","formal","deporte","salida"]
  estado           TEXT,                                -- 'nueva' | 'buena' | 'desgastada'
  notas            TEXT,
  etiquetas        JSONB       NOT NULL DEFAULT '[]',
  imagen_url       TEXT,
  is_favorite      BOOLEAN     NOT NULL DEFAULT false,
  -- IA (PERCHA-014 / PERCHA-015)
  ia_analizada     BOOLEAN     NOT NULL DEFAULT false,
  ia_descripcion   TEXT,
  -- Soft delete — se usa para mantener historial en look_prendas
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  prendas           IS 'Prenda del guardarropas. user_id garantiza aislamiento.';
COMMENT ON COLUMN prendas.estaciones IS 'JSONB array — flexible para filtros multi-valor sin tabla de join.';
COMMENT ON COLUMN prendas.deleted_at IS 'Soft delete: prenda eliminada pero referenciada en look_prendas.';


-- ---------------------------------------------------------------------------
-- TABLA: looks
-- Look guardado por el usuario
-- ---------------------------------------------------------------------------
CREATE TABLE looks (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre                TEXT        NOT NULL,
  descripcion_ia        TEXT,
  parametros_generacion JSONB       NOT NULL DEFAULT '{}',  -- {ocasion, clima, prenda_base_id, ...}
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE looks IS 'Look guardado. parametros_generacion guarda el contexto de la IA.';


-- ---------------------------------------------------------------------------
-- TABLA: look_prendas
-- Relación M:N entre looks y prendas
-- ---------------------------------------------------------------------------
CREATE TABLE look_prendas (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  look_id          UUID    NOT NULL REFERENCES looks(id) ON DELETE CASCADE,
  prenda_id        UUID    REFERENCES prendas(id) ON DELETE SET NULL,  -- SET NULL si se elimina la prenda
  es_prenda_base   BOOLEAN NOT NULL DEFAULT false,
  prenda_eliminada BOOLEAN NOT NULL DEFAULT false   -- flag cuando prenda_id pasa a NULL
);

COMMENT ON TABLE  look_prendas              IS 'Relación M:N look ↔ prenda.';
COMMENT ON COLUMN look_prendas.prenda_id   IS 'SET NULL si la prenda se elimina; prenda_eliminada=true como flag.';


-- ---------------------------------------------------------------------------
-- TABLA: look_usos
-- Historial de fechas en que se usó un look
-- ---------------------------------------------------------------------------
CREATE TABLE look_usos (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  look_id    UUID        NOT NULL REFERENCES looks(id) ON DELETE CASCADE,
  fecha_uso  DATE        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE look_usos IS 'Historial de usos de un look. Inmutable una vez creado.';


-- ---------------------------------------------------------------------------
-- TABLA: ai_usage
-- Registro de llamadas a la IA para tracking de costos (PERCHA-031)
-- Solo escritura desde service_role (API Routes)
-- ---------------------------------------------------------------------------
CREATE TABLE ai_usage (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo            TEXT         NOT NULL,  -- 'analisis_prenda' | 'generacion_look' | 'cambio_prenda'
  tokens_usados   INT,
  costo_estimado  NUMERIC(10,6),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

COMMENT ON TABLE  ai_usage          IS 'Registro de uso de IA. Escritura solo via service_role desde API Routes.';
COMMENT ON COLUMN ai_usage.tipo    IS 'analisis_prenda | generacion_look | cambio_prenda';


-- ---------------------------------------------------------------------------
-- FUNCIÓN + TRIGGER: updated_at automático
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_prendas_updated_at
  BEFORE UPDATE ON prendas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_looks_updated_at
  BEFORE UPDATE ON looks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ---------------------------------------------------------------------------
-- FUNCIÓN + TRIGGER: on_auth_user_created
-- Crea el perfil automáticamente cuando auth.users registra un usuario nuevo
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ---------------------------------------------------------------------------
-- ÍNDICES
-- Optimizan los queries más frecuentes del MVP
-- ---------------------------------------------------------------------------

-- prendas: listado y filtros del guardarropas
CREATE INDEX idx_prendas_user_id        ON prendas (user_id);
CREATE INDEX idx_prendas_category_id    ON prendas (category_id);
CREATE INDEX idx_prendas_user_favorite  ON prendas (user_id, is_favorite) WHERE is_favorite = true;
CREATE INDEX idx_prendas_user_deleted   ON prendas (user_id) WHERE deleted_at IS NULL;

-- looks: historial de looks del usuario
CREATE INDEX idx_looks_user_id          ON looks (user_id);

-- look_prendas: composición del look
CREATE INDEX idx_look_prendas_look_id   ON look_prendas (look_id);

-- look_usos: historial y último uso
CREATE INDEX idx_look_usos_look_id      ON look_usos (look_id);
CREATE INDEX idx_look_usos_fecha        ON look_usos (look_id, fecha_uso DESC);

-- ai_usage: métricas de costo por usuario y período (PERCHA-031)
CREATE INDEX idx_ai_usage_user_date     ON ai_usage (user_id, created_at DESC);


-- ---------------------------------------------------------------------------
-- RLS — Row Level Security
-- Habilitado en todas las tablas. Políticas detalladas en PERCHA-029.
-- ---------------------------------------------------------------------------

ALTER TABLE profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories   ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE prendas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE looks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE look_prendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE look_usos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage     ENABLE ROW LEVEL SECURITY;

-- profiles: cada usuario ve y modifica solo su perfil
CREATE POLICY "profiles: select own"  ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles: insert own"  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles: update own"  ON profiles FOR UPDATE USING (auth.uid() = id);
-- DELETE no permitido: se elimina en cascada con auth.users

-- categories / subcategories: lectura pública, escritura solo service_role
CREATE POLICY "categories: public read"    ON categories    FOR SELECT USING (true);
CREATE POLICY "subcategories: public read" ON subcategories FOR SELECT USING (true);

-- prendas: aislamiento total por user_id
CREATE POLICY "prendas: select own"  ON prendas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "prendas: insert own"  ON prendas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "prendas: update own"  ON prendas FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "prendas: delete own"  ON prendas FOR DELETE USING (auth.uid() = user_id);

-- looks: aislamiento total por user_id
CREATE POLICY "looks: select own"    ON looks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "looks: insert own"    ON looks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "looks: update own"    ON looks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "looks: delete own"    ON looks FOR DELETE USING (auth.uid() = user_id);

-- look_prendas: acceso via FK a looks (el user_id está en looks)
CREATE POLICY "look_prendas: select own" ON look_prendas FOR SELECT
  USING (auth.uid() = (SELECT user_id FROM looks WHERE id = look_id));
CREATE POLICY "look_prendas: insert own" ON look_prendas FOR INSERT
  WITH CHECK (auth.uid() = (SELECT user_id FROM looks WHERE id = look_id));
CREATE POLICY "look_prendas: update own" ON look_prendas FOR UPDATE
  USING (auth.uid() = (SELECT user_id FROM looks WHERE id = look_id));
CREATE POLICY "look_prendas: delete own" ON look_prendas FOR DELETE
  USING (auth.uid() = (SELECT user_id FROM looks WHERE id = look_id));

-- look_usos: acceso via FK a looks
CREATE POLICY "look_usos: select own" ON look_usos FOR SELECT
  USING (auth.uid() = (SELECT user_id FROM looks WHERE id = look_id));
CREATE POLICY "look_usos: insert own" ON look_usos FOR INSERT
  WITH CHECK (auth.uid() = (SELECT user_id FROM looks WHERE id = look_id));
-- UPDATE no permitido — los usos son inmutables
CREATE POLICY "look_usos: delete own" ON look_usos FOR DELETE
  USING (auth.uid() = (SELECT user_id FROM looks WHERE id = look_id));

-- ai_usage: los usuarios ven sus registros pero no pueden crear/modificar
-- (INSERT solo desde service_role en API Routes, que bypasea RLS)
CREATE POLICY "ai_usage: select own" ON ai_usage FOR SELECT
  USING (auth.uid() = user_id);
