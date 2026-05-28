-- Corrige el constraint de genero para que acepte los valores correctos.
-- Necesario si el constraint fue creado con valores diferentes (ej. via dashboard).

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_genero_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_genero_check
    CHECK (genero IN ('hombre', 'mujer', 'prefiero_no_decirlo'));
