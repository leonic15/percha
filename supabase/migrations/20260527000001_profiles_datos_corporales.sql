-- LOOKSI-033 (LSI-53) · Datos corporales en perfil
-- Agrega género, altura y peso a la tabla profiles.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS genero    text
    CHECK (genero IN ('hombre', 'mujer', 'prefiero_no_decirlo')),
  ADD COLUMN IF NOT EXISTS altura_cm smallint
    CHECK (altura_cm BETWEEN 80 AND 250),
  ADD COLUMN IF NOT EXISTS peso_kg   smallint
    CHECK (peso_kg BETWEEN 30 AND 250);
