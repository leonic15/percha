-- =============================================================================
-- Percha — Políticas de Storage
-- PERCHA-029: Buckets y RLS para imágenes de prendas y avatares
-- =============================================================================
--
-- Estructura de paths:
--   prendas/{user_id}/{prenda_id}.webp
--   avatars/{user_id}/avatar.webp
--
-- storage.foldername(name) devuelve el array de segmentos del path.
-- El primer segmento [1] es siempre el user_id.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- BUCKET: prendas
-- Privado — solo el dueño puede leer sus imágenes
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'prendas',
  'prendas',
  false,            -- No público: las URLs requieren autenticación
  5242880,          -- 5 MB máximo por imagen
  ARRAY['image/webp', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- SELECT: solo el dueño puede leer sus propias imágenes
CREATE POLICY "prendas: select own" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'prendas'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- INSERT: solo el dueño puede subir a su carpeta
CREATE POLICY "prendas: insert own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'prendas'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- UPDATE: solo el dueño puede actualizar sus imágenes
CREATE POLICY "prendas: update own" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'prendas'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- DELETE: solo el dueño puede eliminar sus imágenes
CREATE POLICY "prendas: delete own" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'prendas'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );


-- ---------------------------------------------------------------------------
-- BUCKET: avatars
-- Público para lectura — las fotos de perfil son accesibles públicamente.
-- Escritura restringida al dueño.
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,             -- Público: las URLs no requieren autenticación
  2097152,          -- 2 MB máximo por avatar
  ARRAY['image/webp', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- SELECT: acceso público (bucket público — política permisiva)
CREATE POLICY "avatars: public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

-- INSERT: solo el dueño puede subir su avatar
CREATE POLICY "avatars: insert own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- UPDATE: solo el dueño puede actualizar su avatar
CREATE POLICY "avatars: update own" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- DELETE: solo el dueño puede eliminar su avatar
CREATE POLICY "avatars: delete own" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
