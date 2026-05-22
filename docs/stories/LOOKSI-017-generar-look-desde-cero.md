# [EP-04] Generar look desde cero

**ID:** LOOKSI-017  
**Épica:** EP-04 — Generación de looks con IA  
**Prioridad:** Alta  
**Estimación:** 5 puntos  
**Estado:** Pendiente

---

## Descripción

Como **usuario autenticado**, quiero **generar un look completo indicando ocasión, estilo, clima y preferencia de temperatura** para **recibir una combinación de prendas de mi guardarropas adaptada a mis necesidades del día**.

---

## Criterios de aceptación

### Escenario 1: Acceso al generador de looks
- **Dado** que soy un usuario autenticado con prendas en mi guardarropas
- **Cuando** accedo a la sección "Generar look"
- **Entonces** veo el formulario de generación con los parámetros disponibles y la opción de elegir entre "Desde cero" o "Desde una prenda base"

### Escenario 2: Configurar parámetros y generar
- **Dado** que estoy en el formulario de generación "Desde cero"
- **Cuando** selecciono ocasión, estilo, reviso el clima actual (pre-cargado automáticamente) y ajusto la preferencia de temperatura, y hago clic en "Generar look"
- **Entonces** se muestra un indicador de carga y la IA genera un look con prendas de mi guardarropas

### Escenario 3: Campos del formulario de generación
- **Dado** que estoy en el formulario "Desde cero"
- **Cuando** lo visualizo
- **Entonces** veo:
  - **Ocasión** (selector requerido): Casual, Trabajo, Formal, Deporte, Salida
  - **Estilo** (selector opcional): Casual, Clásico, Deportivo, Elegante, Bohemio, Urbano
  - **Clima actual** (mostrado automáticamente desde la API de clima — ciudad detectada o configurada): temperatura, condición (soleado, nublado, lluvia, etc.)
  - **Preferencia de temperatura** (slider opcional): Más fresco / Neutro / Más abrigado
  - **Prendas a excluir** (multi-selector opcional): el usuario puede seleccionar prendas de su guardarropas que no quiere que aparezcan en el look

### Escenario 4: Look generado exitosamente
- **Dado** que la IA procesó la solicitud correctamente
- **Cuando** el look está listo
- **Entonces** veo el resultado con: lista de prendas recomendadas (con foto, nombre y categoría de cada una), descripción textual del look generada por la IA, y los botones de acción (guardar, regenerar, cambiar prenda)

### Escenario 5: Look parcial por pocas prendas
- **Dado** que mi guardarropas no tiene suficientes prendas para cubrir todas las categorías del look
- **Cuando** la IA genera el resultado
- **Entonces** veo el look con las prendas disponibles y una sección "Para completar este look te falta:" con descripción de las prendas que faltan (sin foto, solo texto)

### Escenario 6: Prendas excluidas
- **Dado** que seleccioné prendas a excluir antes de generar
- **Cuando** el look se genera
- **Entonces** las prendas excluidas no aparecen en el resultado bajo ninguna circunstancia

### Escenario 7: Error en la generación
- **Dado** que ocurre un error al llamar a la API de IA
- **Cuando** falla la generación
- **Entonces** veo un mensaje de error claro con opción de reintentar, sin perder los parámetros configurados

---

## Notas técnicas

- Endpoint: `POST /api/looks/generar` — recibe parámetros del formulario y devuelve el look estructurado
- Modelo: Gemini 2.5 Flash-Lite (texto, no necesita visión en este endpoint)
- El prompt incluye: parámetros del usuario + lista de prendas disponibles (ID, nombre, categoría, subcategoría, color, estación, estilo, ocasión, etiquetas) + condiciones climáticas actuales + prendas excluidas
- La respuesta de la IA es un JSON con: `descripcion_look` (string), `prendas[]` (array de IDs de prendas del guardarropas), `prendas_faltantes[]` (array de descripciones textuales)
- No enviar las imágenes de las prendas a la IA en este endpoint — solo los metadatos textuales (optimización de costos y latencia)
- Timeout: 20 segundos
- Registrar uso en tabla `ai_usage`
- El clima se obtiene desde EP-05 (integración con Open-Meteo); si no está disponible, el campo de clima muestra "No disponible" y la generación funciona sin él
- Textos en español con claves i18n

---

## Dependencias

- [LOOKSI-009] Agregar prenda (necesita prendas en el guardarropas)
- [LOOKSI-014] Análisis automático de prenda con IA (mejor calidad de looks si las prendas tienen metadatos completos)
- [LOOKSI-019] Revisar y ajustar look generado (siguiente paso del flujo)
- [EP-05] Integración de clima (para pre-cargar condiciones climáticas)
