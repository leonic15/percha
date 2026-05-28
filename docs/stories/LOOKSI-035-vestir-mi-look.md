# [EP-04] Vestir mi look — imagen fotorrealista del usuario con el outfit

**ID:** LOOKSI-035  
**Épica:** EP-04 — Generación de looks con IA  
**Prioridad:** Alta  
**Estimación:** 8 puntos  
**Estado:** Completada

---

## Descripción

Como **usuario autenticado con foto de referencia y datos corporales completos**, quiero **generar una imagen fotorrealista de mí mismo usando el look armado, en un escenario acorde a la ocasión**, para **visualizar cómo me quedaría el outfit antes de usarlo y guardar esa imagen junto con el look**.

---

## Criterios de aceptación

### Escenario 1: Botón "Vestir mi look" en resultado del generador
- **Dado** que estoy viendo el resultado de un look generado
- **Cuando** tengo foto de referencia, altura y peso cargados en mi perfil
- **Entonces** veo el botón "Vestir mi look" activo en la pantalla de resultado del generador

### Escenario 2: Botón "Vestir mi look" en detalle del look guardado
- **Dado** que estoy viendo el detalle de un look guardado
- **Cuando** tengo foto de referencia, altura y peso cargados en mi perfil
- **Entonces** veo el botón "Vestir mi look" activo en la pantalla de detalle del look

### Escenario 3: Botón deshabilitado — perfil incompleto
- **Dado** que falta mi foto de referencia, altura o peso
- **Cuando** veo el botón "Vestir mi look"
- **Entonces** el botón aparece deshabilitado con el tooltip "Completá tu foto y datos corporales en el perfil para usar esta función"

### Escenario 4: Solicitar escenario al usuario
- **Dado** que toco "Vestir mi look"
- **Cuando** se abre el panel de configuración
- **Entonces** veo:
  - La ocasión del look pre-completada (ej: "Trabajo")
  - Un campo opcional de texto libre: "Describí el escenario" con placeholder (ej: "Oficina moderna con luz natural", "Café en el centro", "Noche de salida en la ciudad")
  - Botón "Generar imagen" (accent, pill)

### Escenario 5: Generación en progreso
- **Dado** que confirmé la generación
- **Cuando** la imagen se está procesando (puede tardar 15-30 seg)
- **Entonces** veo una pantalla de progreso con animación y mensaje ("Generando tu look…") sin posibilidad de cancelar a mitad de proceso

### Escenario 6: Imagen generada exitosamente
- **Dado** que la API de Google Imagen 3 devolvió la imagen
- **Cuando** la generación se completa
- **Entonces** veo la imagen fotorrealista a pantalla completa con:
  - La persona (mi foto de referencia) usando las prendas del look con sus colores, patrones y texturas correctos
  - Un fondo acorde al escenario indicado y la ocasión del look
  - Botón "Guardar imagen" y botón "Generar otra versión"

### Escenario 7: Guardar imagen junto con el look
- **Dado** que estoy viendo la imagen generada
- **Cuando** toco "Guardar imagen"
- **Entonces** la imagen se sube a Supabase Storage y su URL queda asociada al look en `looks.vestir_imagen_url`. Si el look aún no estaba guardado, se guarda automáticamente primero

### Escenario 8: Imagen visible en el detalle del look
- **Dado** que guardé una imagen "Vestir mi look" para un look
- **Cuando** abro el detalle del look
- **Entonces** veo la imagen destacada en la parte superior del detalle, por encima o junto al grid de prendas

### Escenario 9: Regenerar versión alternativa
- **Dado** que la imagen generada no me convence
- **Cuando** toco "Generar otra versión"
- **Entonces** se genera una nueva imagen con los mismos parámetros (distintas semillas) sin cobrar créditos adicionales si ocurre dentro de los 5 minutos posteriores a la primera generación

### Escenario 10: Error en la generación
- **Dado** que la API de Google Imagen 3 falla o devuelve un error de moderación de contenido
- **Cuando** ocurre el error
- **Entonces** veo un mensaje de error claro ("No pudimos generar la imagen. Intentá de nuevo.") con la opción de reintentar, sin perder los parámetros del escenario

### Escenario 11: Atributos de las prendas respetados
- **Dado** que el look tiene prendas con colores y estilos específicos (ej: camisa azul a cuadros, pantalón verde oliva)
- **Cuando** se genera la imagen
- **Entonces** el prompt enviado a Google Imagen 3 incluye descripción detallada de cada prenda (nombre, color, patrón, categoría, estilo) para maximizar la fidelidad visual

---

## Notas técnicas

### API de generación de imágenes
- **Servicio:** Google Imagen 3 via Vertex AI (`imagegeneration@006` o posterior)
  - Modelo soporta "image editing with reference" — se envía la foto de la persona como imagen de referencia
  - Alternativa investigar: `imagen-3.0-generate-002` en Google AI Studio si Vertex no está disponible en free tier
- **Endpoint interno:** `POST /api/looks/generar-imagen`
- **Timeout:** 60 segundos (la generación puede tardar hasta 30 seg)
- **Costo estimado:** ~USD 0.04 por imagen generada — registrar en `ai_usage`

### Payload al endpoint
```json
{
  "look_id": "uuid",
  "escenario": "Oficina moderna con luz natural",
  "ocasion": "trabajo"
}
```

### Lógica del endpoint `POST /api/looks/generar-imagen`
1. Validar que `look_id` pertenece al usuario autenticado
2. Leer `profiles` del usuario: `body_photo_url`, `altura_cm`, `peso_kg`, `genero`
3. Verificar que los tres campos tienen valor; si no, retornar 422
4. Generar signed URL fresca (10 min) de `body_photo_url` para pasarla a Google
5. Obtener prendas del look con sus metadatos: nombre, categoría, color, patrón, estilo
6. Construir prompt de generación (ver abajo)
7. Llamar a Google Imagen 3 con la foto como image reference
8. Subir imagen resultante a Supabase Storage: bucket `look-images`, path `{user_id}/{look_id}/vestir.jpg`
9. No actualizar `looks.vestir_imagen_url` desde aquí — el cliente lo hace al presionar "Guardar imagen"
10. Registrar en `ai_usage`: modelo, tokens/créditos, look_id, user_id_hash

### Construcción del prompt
```
Photorealistic full-body photo of a [genero] person, [altura_cm]cm tall, [peso_kg]kg.
Use the provided reference photo to match the person's appearance exactly.
The person is wearing: [descripción detallada de cada prenda con color/patrón/textura].
Setting: [escenario + ocasión]. Natural lighting, editorial fashion photography style.
```

### Cambios en base de datos
- Tabla `looks`: agregar columna `vestir_imagen_url` — `text`, nullable
- Tabla `ai_usage`: agregar columna `feature` — `text` (valores: 'generar_look', 'analizar_prenda', 'generar_imagen')
- Migración: `supabase/migrations/20260527000002_looks_vestir_imagen.sql`

### Storage
- Bucket `look-images` (privado), RLS: solo el dueño del look puede leer/escribir
- Signed URLs de 1h para mostrar la imagen en el detalle del look

### Rate limiting
- Máximo 3 generaciones de imagen por usuario por día (evitar abuso de costos)
- Si se supera el límite, mostrar: "Alcanzaste el límite de 3 imágenes por día. Volvé mañana."

### Seguridad
- La foto de referencia del usuario NUNCA se expone al cliente como URL firmada — se procesa únicamente server-side
- `GOOGLE_VERTEX_API_KEY` (o credenciales de servicio) solo en variables de entorno sin prefijo `NEXT_PUBLIC_`

---

## Dependencias

- [LOOKSI-033] Datos corporales en perfil (requiere género, altura, peso)
- [LOOKSI-034] Foto de cuerpo completo en perfil (requiere `body_photo_url`)
- [LOOKSI-017] Generar look desde cero (pantalla de resultado donde aparece el botón)
- [LOOKSI-020] Guardar look (para asociar la imagen al look guardado)
- [LOOKSI-021] Historial de looks guardados (la imagen debe mostrarse en el detalle del look)
