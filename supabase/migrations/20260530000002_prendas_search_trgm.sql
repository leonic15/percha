-- =============================================================================
-- LookSi — Índices trigram para búsqueda de prendas
-- Auditoría de performance H-16
-- =============================================================================
--
-- GET /api/garments usa `ilike '%q%'` sobre nombre, color_principal y notas.
-- El comodín inicial impide usar índices B-tree → scan secuencial por usuario.
-- pg_trgm + índices GIN permiten que estos LIKE/ILIKE usen índice.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_prendas_nombre_trgm
  ON prendas USING gin (nombre gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_prendas_color_trgm
  ON prendas USING gin (color_principal gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_prendas_notas_trgm
  ON prendas USING gin (notas gin_trgm_ops);
