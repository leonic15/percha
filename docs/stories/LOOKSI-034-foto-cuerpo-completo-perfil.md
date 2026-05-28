# [EP-06] Foto de cuerpo completo en perfil

**ID:** LOOKSI-034  
**Épica:** EP-06 — Preferencias y configuración del usuario  
**Prioridad:** Alta  
**Estimación:** 3 puntos  
**Estado:** Completada

---

## Descripción

Como **usuario autenticado**, quiero **subir una foto de cuerpo completo en mi perfil** para **que la app pueda generar imágenes fotorrealistas de cómo me queda un look (LOOKSI-035)**.

---

## Criterios de aceptación

### Escenario 1: Acceso al campo de foto corporal
- **Dado** que estoy en Configuración / Perfil, sección "Datos personales"
- **Cuando** accedo a la sección
- **Entonces** veo un área específica para "Foto de referencia" con una guía visual (ilustración o overlay) que muestra cómo debe ser la foto: cuerpo completo de frente, fondo claro o neutro, ropa ajustada o de color sólido

### Escenario 2: Subir foto desde galería
- **Dado** que quiero agregar mi foto de referencia
- **Cuando** toco el área de foto y selecciono una imagen de mi galería
- **Entonces** la imagen se previsualiza, se comprime en el cliente y se sube a Supabase Storage. Veo una confirmación de éxito y el botón "Vestir mi look" (LOOKSI-035) se habilita

### Escenario 3: Capturar foto con la cámara
- **Dado** que quiero tomar la foto directamente
- **Cuando** toco "Usar cámara" y capturo la foto
- **Entonces** se abre la cámara con orientación de captura (overlay guía de silueta), se previsualiza el resultado y, al confirmar, se sube a Storage

### Escenario 4: Guías de captura visibles
- **Dado** que el usuario abre el selector de foto
- **Cuando** la interfaz se carga
- **Entonces** ve un checklist de requisitos: ✓ Cuerpo completo (cabeza a pies), ✓ Fondo claro o neutro, ✓ Sin otros objetos que obstruyan, ✓ Pose natural de frente

### Escenario 5: Validación de formato y tamaño
- **Dado** que el usuario selecciona un archivo no imagen o mayor a 10 MB
- **Cuando** intenta subirlo
- **Entonces** ve un error específico ("Solo se aceptan imágenes JPG/PNG/WebP" o "La imagen no puede superar 10 MB") sin que el archivo se suba

### Escenario 6: Reemplazar foto existente
- **Dado** que ya tengo una foto de referencia subida
- **Cuando** subo una nueva imagen
- **Entonces** la foto anterior se reemplaza en Storage (mismo path, nuevo archivo) y el perfil se actualiza con la nueva URL

### Escenario 7: Eliminar foto de referencia
- **Dado** que tengo una foto de referencia
- **Cuando** toco "Eliminar foto" y confirmo
- **Entonces** la foto se elimina de Storage, `profiles.body_photo_url` se pone en `null` y el botón "Vestir mi look" vuelve a deshabilitarse

### Escenario 8: Privacidad — aviso al usuario
- **Dado** que el usuario va a subir su foto
- **Cuando** accede al área de foto por primera vez
- **Entonces** ve un aviso claro: "Esta foto se usa únicamente para generar imágenes de looks. No es visible para otros usuarios."

---

## Notas técnicas

- Agregar columna a `profiles`:
  - `body_photo_url` — `text`, nullable — URL firmada o pública del bucket `body-photos`
- Supabase Storage: bucket `body-photos` (privado), path `{user_id}/body.{ext}`
  - RLS: el usuario solo puede leer y escribir en su propio path
  - Las imágenes se acceden vía signed URLs (1h de vigencia) para mantenerlas privadas
- Compresión en cliente con `browser-image-compression` antes de subir: max 2 MB, max 2000px en el lado mayor
- Tamaño máximo antes de compresión: 10 MB; formatos: JPG, PNG, WebP
- La URL del body photo se necesita en el endpoint `POST /api/looks/generar-imagen` (LOOKSI-035). Generar una signed URL fresca en el servidor antes de pasarla a Google Imagen 3
- Migración: incluir en `supabase/migrations/20260527000001_profiles_datos_corporales.sql` (junto con LOOKSI-033) o migración propia
- El botón "Vestir mi look" requiere que estén completos: `body_photo_url` ≠ null Y (`altura_cm` ≠ null O `peso_kg` ≠ null) — validación client-side con tooltip explicativo
- Textos en español con claves i18n

---

## Dependencias

- [LOOKSI-033] Datos corporales en perfil (comparte pantalla y migración)
- [LOOKSI-035] Vestir mi look (consume `body_photo_url`)
