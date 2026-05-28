# [EP-03] Reintentar análisis de IA desde el detalle de prenda

**ID:** LOOKSI-016  
**Épica:** EP-03 — Análisis de prendas con IA  
**Prioridad:** Media  
**Estimación:** 2 puntos  
**Estado:** Completada

---

## Descripción

Como **usuario autenticado**, quiero **poder lanzar el análisis de IA sobre una prenda ya guardada** para **obtener o actualizar las sugerencias de metadatos en cualquier momento**.

---

## Criterios de aceptación

### Escenario 1: Prenda sin análisis previo — botón disponible
- **Dado** que tengo una prenda guardada que nunca fue analizada por IA (por saltar el análisis o por error previo)
- **Cuando** accedo al detalle de la prenda
- **Entonces** veo un botón o sección "Analizar con IA" que me permite lanzar el análisis manualmente

### Escenario 2: Análisis lanzado desde el detalle
- **Dado** que hago clic en "Analizar con IA" desde el detalle de la prenda
- **Cuando** el análisis se dispara
- **Entonces** veo un indicador de progreso y al finalizar se muestran las sugerencias de IA para que las revise y apruebe (igual que en LOOKSI-015)

### Escenario 3: Prenda ya analizada — opción de re-analizar
- **Dado** que la prenda ya fue analizada previamente por IA
- **Cuando** accedo al detalle
- **Entonces** veo una opción secundaria "Re-analizar con IA" (menos prominente que el botón principal) que permite obtener un nuevo análisis, por ejemplo si se reemplazó la foto

### Escenario 4: Re-análisis sobreescribe sugerencias anteriores
- **Dado** que lanzo un re-análisis sobre una prenda ya analizada
- **Cuando** el nuevo análisis completa
- **Entonces** las nuevas sugerencias de IA reemplazan las anteriores en la pantalla de revisión; los valores que el usuario ya editó y guardó no se sobreescriben automáticamente (se muestran como sugerencias a revisar)

### Escenario 5: Error en el reintento
- **Dado** que lanzo el análisis desde el detalle y ocurre un error o timeout
- **Cuando** falla el análisis
- **Entonces** veo un mensaje de error no intrusivo con opción de reintentar, sin perder los datos existentes de la prenda

---

## Notas técnicas

- Reutilizar el mismo endpoint `POST /api/prendas/analizar` de LOOKSI-014
- En este flujo, la imagen ya está en Supabase Storage: pasarle la URL de la imagen existente al endpoint
- Al completar el análisis, abrir el formulario de edición (LOOKSI-011) pre-completado con las nuevas sugerencias
- Actualizar `ia_analizada = true` y `ia_descripcion` en la tabla `prendas` al guardar el resultado
- Registrar el uso en `ai_usage` igual que en LOOKSI-014 (para futura facturación/límites)
- El botón "Analizar con IA" / "Re-analizar con IA" se ubica en la pantalla de detalle, no en el listado
- Textos en español con claves i18n

---

## Dependencias

- [LOOKSI-014] Análisis automático de prenda con IA al agregar (comparte endpoint y lógica)
- [LOOKSI-015] Revisión y aprobación de sugerencias de IA (comparte pantalla de revisión)
- [LOOKSI-010] Ver detalle de prenda (punto de entrada)
- [LOOKSI-011] Editar prenda (flujo de aprobación desemboca en formulario de edición)
