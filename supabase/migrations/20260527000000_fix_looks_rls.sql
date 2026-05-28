-- LOOKSI-020: Aplica las políticas RLS de looks/look_prendas/look_usos
-- que pudieron no haberse ejecutado en la instancia de Supabase.
-- Usar IF NOT EXISTS para que sea idempotente.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'looks' AND policyname = 'looks: insert own'
  ) THEN
    CREATE POLICY "looks: insert own"
      ON looks FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'looks' AND policyname = 'looks: select own'
  ) THEN
    CREATE POLICY "looks: select own"
      ON looks FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'looks' AND policyname = 'looks: update own'
  ) THEN
    CREATE POLICY "looks: update own"
      ON looks FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'looks' AND policyname = 'looks: delete own'
  ) THEN
    CREATE POLICY "looks: delete own"
      ON looks FOR DELETE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'look_prendas' AND policyname = 'look_prendas: insert own'
  ) THEN
    CREATE POLICY "look_prendas: insert own"
      ON look_prendas FOR INSERT
      WITH CHECK (auth.uid() = (SELECT user_id FROM looks WHERE id = look_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'look_prendas' AND policyname = 'look_prendas: select own'
  ) THEN
    CREATE POLICY "look_prendas: select own"
      ON look_prendas FOR SELECT
      USING (auth.uid() = (SELECT user_id FROM looks WHERE id = look_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'look_usos' AND policyname = 'look_usos: insert own'
  ) THEN
    CREATE POLICY "look_usos: insert own"
      ON look_usos FOR INSERT
      WITH CHECK (auth.uid() = (SELECT user_id FROM looks WHERE id = look_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'look_usos' AND policyname = 'look_usos: select own'
  ) THEN
    CREATE POLICY "look_usos: select own"
      ON look_usos FOR SELECT
      USING (auth.uid() = (SELECT user_id FROM looks WHERE id = look_id));
  END IF;
END $$;
