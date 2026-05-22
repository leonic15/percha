# [EP-03] Revisión y aprobación de sugerencias de IA

**ID:** LOOKSI-015  
**Épica:** EP-03 — Análisis de prendas con IA  
**Prioridad:** Alta  
**Estimación:** 3 puntos  
**Estado:** Pendiente

---

## Descripción

Como **usuario autenticado**, quiero **revisar, editar y aprobar las sugerencias que la IA detectó de mi prenda** para **asegurarme de que los metadatos guardados sean correctos antes de agregarla al guardarropas**.

---

## Criterios de aceptación

### Escenario 1: Visualización de sugerencias en el formulario
- **Dado** que el análisis de IA completó exitosamente
- **Cuando** las sugerencias se pre-cargan en el formulario
- **Entonces** cada campo sugerido muestra un indicador visual (ej: ícono de estrella o chip "Sugerido por IA") que distingue los valores generados por IA de los ingresados manualmente

### Escenario 2: Aceptar todas las sugerencias sin cambios
- **Dado** que los campos están pre-completados con sugerencias de IA
- **Cuando** el usuario revisa y hace clic en "Guardar" sin modificar nada
- **Entonces** la prenda se guarda con todos los valores sugeridos por la IA

### Escenario 3: Editar una sugerencia antes de guardar
- **Dado** que un campo tiene un valor sugerido por IA que el usuario quiere corregir
- **Cuando** el usuario modifica el campo (ej: cambia la categoría sugerida)
- **Entonces** el campo muestra el nuevo valor ingresado por el usuario, el indicador "Sugerido por IA" desaparece de ese campo y los demás campos sugeridos no se ven afectados

### Escenario 4: Descripción libre de la IA
- **Dado** que la IA generó una descripción textual de la prenda
- **Cuando** el usuario visualiza el formulario
- **Entonces** ve la descripción en un campo de texto editable claramente identificado como "Descripción (generada por IA)" que puede modificar o borrar libremente

### Escenario 5: Etiquetas libres sugeridas por la IA
- **Dado** que la IA detectó etiquetas adicionales (ej: "rayas", "manga larga", "cuello en V")
- **Cuando** el usuario visualiza el formulario
- **Entonces** ve las etiquetas como chips editables que puede quitar individualmente o agregar nuevas manualmente

### Escenario 6: Guardar con campos requeridos vacíos
- **Dado** que la IA no pudo determinar la categoría o el nombre
- **Cuando** el usuario intenta guardar con esos campos vacíos
- **Entonces** ve los mismos errores de validación que en el flujo manual (LOOKSI-009 Escenario 6)

---

## Notas técnicas

- Los valores sugeridos por IA se pre-cargan en el mismo formulario de LOOKSI-009 (no es una pantalla separada)
- Almacenar en la tabla `prendas` una columna `ia_analizada` (boolean) y `ia_descripcion` (text) para registrar que fue analizada y conservar la descripción original de la IA incluso si el usuario la edita
- Los campos editados por el usuario se guardan normalmente; no es necesario distinguir en DB qué valores vinieron de la IA vs. del usuario (excepto la descripción original)
- El indicador visual "Sugerido por IA" es solo de UI, no persiste en la base de datos
- Las etiquetas libres de la IA se almacenan en un array JSONB `etiquetas[]` en la tabla `prendas`
- Si la IA sugiere una categoría que no existe en el sistema, hacer fallback a "Otros" y loguearlo
- Textos en español con claves i18n

---

## Dependencias

- [LOOKSI-014] Análisis automático de prenda con IA al agregar
- [LOOKSI-009] Agregar prenda (reutiliza el formulario)
