# [EP-04] Generar look desde una prenda base

**ID:** LOOKSI-018  
**Épica:** EP-04 — Generación de looks con IA  
**Prioridad:** Alta  
**Estimación:** 3 puntos  
**Estado:** Completada

---

## Descripción

Como **usuario autenticado**, quiero **elegir una prenda de mi guardarropas como punto de partida y que la IA complete el resto del outfit** para **armar combinaciones a partir de las prendas que tengo ganas de usar ese día**.

---

## Criterios de aceptación

### Escenario 1: Iniciar generación desde el detalle de una prenda
- **Dado** que estoy en el detalle de una prenda
- **Cuando** hago clic en "Armar look con esta prenda"
- **Entonces** accedo al formulario de generación con la prenda ya seleccionada como base y los demás parámetros disponibles para completar

### Escenario 2: Iniciar generación desde el generador de looks
- **Dado** que estoy en el formulario de generación y elijo la opción "Desde una prenda base"
- **Cuando** selecciono una prenda de mi guardarropas usando el selector
- **Entonces** la prenda queda fijada como base y puedo completar los demás parámetros (ocasión, estilo, clima, temperatura, exclusiones)

### Escenario 3: Look generado respeta la prenda base
- **Dado** que generé un look con una prenda base
- **Cuando** veo el resultado
- **Entonces** la prenda base aparece siempre en el look, claramente identificada como "Prenda elegida", y las demás prendas son complementarias a ella

### Escenario 4: Prenda base incompatible con la ocasión
- **Dado** que la prenda base no es apropiada para la ocasión seleccionada (ej: un traje de baño para "Trabajo")
- **Cuando** la IA genera el look
- **Entonces** veo una advertencia indicando la posible incompatibilidad, pero el look se genera igual respetando la prenda base

### Escenario 5: Look parcial por pocas prendas compatibles
- **Dado** que mi guardarropas tiene pocas prendas compatibles con la prenda base
- **Cuando** la IA genera el resultado
- **Entonces** veo el look parcial con las prendas disponibles y la sección "Para completar este look te falta:" igual que en LOOKSI-017

---

## Notas técnicas

- Reutiliza el mismo endpoint `POST /api/looks/generar` de LOOKSI-017, con el campo adicional `prenda_base_id` en el payload
- El prompt de IA incluye los metadatos completos de la prenda base con instrucción de mantenerla fija en el look
- El selector de prenda base muestra la grilla de prendas del guardarropas (con filtros básicos por categoría) para facilitar la búsqueda
- La prenda base no puede ser excluida simultáneamente (el sistema debe validar esto)
- Textos en español con claves i18n

---

## Dependencias

- [LOOKSI-017] Generar look desde cero (comparte endpoint, formulario y flujo de resultado)
- [LOOKSI-010] Ver detalle de prenda (punto de entrada alternativo)
