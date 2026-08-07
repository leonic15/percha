-- =============================================================================
-- Percha — Buckets para PERCHA-034 (body-photos) y PERCHA-035 (look-images)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- BUCKET: body-photos
-- Privado — fotos corporales de referencia para generación IA
-- Path: {user_id}/{filename}
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'body-photos',
  'body-photos',
  false,
  10485760,   -- 10 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "body-photos: select own" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'body-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "body-photos: insert own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'body-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "body-photos: update own" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'body-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "body-photos: delete own" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'body-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );


-- ---------------------------------------------------------------------------
-- BUCKET: look-images
-- Privado — imágenes generadas por IA del usuario con el look puesto
-- Path: {user_id}/{look_id}/vestir_{timestamp}.jpg
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'look-images',
  'look-images',
  false,
  10485760,   -- 10 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "look-images: select own" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'look-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "look-images: insert own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'look-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "look-images: update own" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'look-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "look-images: delete own" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'look-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
