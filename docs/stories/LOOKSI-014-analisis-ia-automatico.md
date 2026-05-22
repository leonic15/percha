# [EP-03] Análisis automático de prenda con IA al agregar

**ID:** LOOKSI-014  
**Épica:** EP-03 — Análisis de prendas con IA  
**Prioridad:** Alta  
**Estimación:** 5 puntos  
**Estado:** Pendiente

---

## Descripción

Como **usuario autenticado**, quiero **que la IA analice automáticamente la foto de mi prenda al agregarla** para **obtener una descripción y sugerencias de metadatos sin tener que completarlos manualmente**.

---

## Criterios de aceptación

### Escenario 1: Análisis iniciado automáticamente
- **Dado** que subí una foto en el formulario de agregar prenda
- **Cuando** la imagen queda seleccionada en el formulario
- **Entonces** se muestra un indicador de "Analizando prenda..." y el análisis de IA se dispara automáticamente en background

### Escenario 2: Análisis completado exitosamente
- **Dado** que la IA procesó la imagen correctamente
- **Cuando** el análisis finaliza
- **Entonces** los campos del formulario se pre-completan con las sugerencias de la IA (descripción, categoría, subcategoría, color, estación, estilo, ocasión y etiquetas libres) y el indicador desaparece

### Escenario 3: El usuario salta el análisis
- **Dado** que el análisis está en progreso
- **Cuando** el usuario hace clic en "Saltar análisis de IA"
- **Entonces** el análisis se cancela, los campos del formulario quedan vacíos para completar manualmente y puede guardar la prenda sin análisis

### Escenario 4: Error o timeout en el análisis
- **Dado** que el análisis de IA falla o supera el tiempo máximo de espera (15 segundos)
- **Cuando** ocurre el error o timeout
- **Entonces** se muestra un mensaje no intrusivo ("No se pudo analizar la prenda. Podés completar los datos manualmente o intentarlo más tarde") y el formulario queda habilitado para completar a mano

### Escenario 5: La IA no reconoce la imagen como prenda
- **Dado** que la imagen subida no contiene una prenda de ropa reconocible
- **Cuando** la IA procesa la imagen
- **Entonces** se muestra un mensaje indicando que no se detectó una prenda y se sugiere tomar una nueva foto, sin bloquear el guardado

---

## Notas técnicas

- El análisis de IA se ejecuta **siempre desde una API Route de Next.js**, nunca desde el cliente
- Endpoint: `POST /api/prendas/analizar` — recibe la imagen (como base64 o URL temporal de Storage) y devuelve las sugerencias
- Modelo:  Gemini 2.5 Flash-Lite con visión (multimodal); usar el modelo más económico disponible que soporte imágenes
- Prompt del sistema diseñado para devolver un JSON estructurado con los campos: `descripcion`, `categoria`, `subcategoria`, `color_principal`, `estaciones[]`, `estilos[]`, `ocasiones[]`, `etiquetas_libres[]`
- Timeout de la llamada a la API de IA: 15 segundos
- La imagen se envía a la API de IA **solo después de ser comprimida** en el cliente (máx. 800KB, 1200px) — no enviar imágenes full-res a la API de IA para controlar costos
- La llamada a la API de IA ocurre **antes** de guardar la prenda en la DB (el usuario aún está en el formulario)
- Arquitectura preparada para un sistema de límites/créditos: loguear cada llamada a la IA en una tabla `ai_usage` con `user_id`, `timestamp`, `tokens_usados`, `costo_estimado`
- No exponer la API key de Gemini a en el cliente bajo ninguna circunstancia
- Textos en español con claves i18n

---

## Dependencias

- [LOOKSI-009] Agregar prenda (el análisis se dispara desde el formulario de agregar)
- [LOOKSI-015] Revisión y aprobación de sugerencias de IA (siguiente paso del flujo)
