-- ---------------------------------------------------------------------------
-- Agrega columna vestir_imagen_url a la tabla looks (PERCHA-035)
-- Almacena el path en Storage del look vestido generado por IA
-- ---------------------------------------------------------------------------
ALTER TABLE looks
  ADD COLUMN IF NOT EXISTS vestir_imagen_url TEXT;
