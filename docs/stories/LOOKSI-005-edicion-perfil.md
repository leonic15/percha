# [EP-01] Edición de perfil básico

**ID:** LOOKSI-005  
**Épica:** EP-01 — Autenticación y gestión de cuenta  
**Prioridad:** Media  
**Estimación:** 3 puntos  
**Estado:** Completada

---

## Descripción

Como **usuario autenticado**, quiero **editar mi nombre y foto de perfil** para **personalizar mi cuenta en LookSi**.

---

## Criterios de aceptación

### Escenario 1: Actualización de nombre exitosa
- **Dado** que estoy en la pantalla de edición de perfil
- **Cuando** modifico mi nombre y guardo los cambios
- **Entonces** el nombre se actualiza en la tabla `profiles` y veo el nuevo nombre reflejado en toda la app (header, menú, etc.)

### Escenario 2: Actualización de foto de perfil exitosa
- **Dado** que estoy en la pantalla de edición de perfil
- **Cuando** selecciono una imagen desde mi dispositivo y guardo
- **Entonces** la imagen se sube a Supabase Storage en el bucket `avatars`, se actualiza la URL en `profiles` y veo la nueva foto reflejada en toda la app

### Escenario 3: Formato de imagen no soportado
- **Dado** que intento subir un archivo que no es una imagen (o un formato no soportado)
- **Cuando** selecciono el archivo
- **Entonces** veo un mensaje de error indicando los formatos aceptados (JPG, PNG, WebP) sin que el archivo se suba

### Escenario 4: Imagen demasiado grande
- **Dado** que intento subir una imagen que supera el tamaño máximo permitido (5 MB)
- **Cuando** selecciono el archivo
- **Entonces** veo un mensaje de error indicando el tamaño máximo permitido

### Escenario 5: Cancelar edición
- **Dado** que modifiqué campos en el formulario de perfil
- **Cuando** hago clic en "Cancelar" sin guardar
- **Entonces** los cambios se descartan y veo los datos originales del perfil

---

## Notas técnicas

- La tabla `profiles` tiene campos: `id` (FK a `auth.users`), `full_name`, `avatar_url`, `updated_at`
- Las imágenes de avatar se suben a Supabase Storage: bucket `avatars`, path `{user_id}/avatar.{ext}`
- Aplicar RLS en Supabase Storage: cada usuario solo puede escribir en su propio path
- Redimensionar/comprimir la imagen en el cliente antes de subir (usar `browser-image-compression`) para optimizar costos de storage
- Tamaño máximo: 5 MB antes de compresión; formatos aceptados: JPG, PNG, WebP
- La URL del avatar en `profiles` es una URL pública de Supabase Storage (bucket público para avatares)
- Si el usuario se registró con Google, pre-poblar `avatar_url` con la foto de Google al crear el perfil
- Textos en español con claves i18n

---

## Dependencias

- [LOOKSI-001] Registro con email y contraseña (estructura de tabla `profiles`)
- [LOOKSI-003] Login con Google (pre-población de avatar desde Google)
