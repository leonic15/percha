# [EP-04] Ver historial de looks guardados

**ID:** LOOKSI-021  
**Épica:** EP-04 — Generación de looks con IA  
**Prioridad:** Media  
**Estimación:** 3 puntos  
**Estado:** Pendiente

---

## Descripción

Como **usuario autenticado**, quiero **ver todos mis looks guardados con su historial de uso** para **reutilizar outfits que me gustaron y llevar un registro de mi estilo**.

---

## Criterios de aceptación

### Escenario 1: Listado de looks guardados
- **Dado** que tengo looks guardados
- **Cuando** accedo a la sección "Mis looks"
- **Entonces** veo una lista de mis looks con: nombre, miniaturas de las prendas que lo componen, última fecha de uso (o "Nunca usado" si no tiene registros) y cantidad total de usos

### Escenario 2: Historial vacío
- **Dado** que no tengo ningún look guardado
- **Cuando** accedo a "Mis looks"
- **Entonces** veo un estado vacío con mensaje motivador y acceso directo al generador de looks

### Escenario 3: Ver detalle de un look guardado
- **Dado** que estoy en el historial de looks
- **Cuando** hago tap/clic en un look
- **Entonces** veo el detalle con: nombre, descripción de la IA, prendas que lo componen (con fotos), parámetros originales de generación y todas las fechas de uso registradas

### Escenario 4: Reutilizar un look guardado
- **Dado** que estoy en el detalle de un look guardado
- **Cuando** hago clic en "Usar hoy"
- **Entonces** se registra la fecha de hoy como nuevo uso del look (igual que LOOKSI-020 Escenario 3)

### Escenario 5: Eliminar un look guardado
- **Dado** que estoy en el detalle de un look guardado
- **Cuando** hago clic en "Eliminar look" y confirmo
- **Entonces** el look y su historial de usos se eliminan de la base de datos; las prendas que lo componen no se ven afectadas

### Escenario 6: Prenda eliminada dentro de un look guardado
- **Dado** que una prenda que formaba parte de un look guardado fue eliminada del guardarropas
- **Cuando** veo el detalle del look
- **Entonces** en el lugar de esa prenda veo un placeholder con texto "Prenda eliminada" en lugar de romper el look o mostrar un error

### Escenario 7: Filtrar looks por ocasión o fecha
- **Dado** que tengo muchos looks guardados
- **Cuando** uso los filtros disponibles (por ocasión o por rango de fechas de uso)
- **Entonces** el listado muestra solo los looks que coinciden con los filtros aplicados

---

## Notas técnicas

- Ruta: `/looks` para el listado, `/looks/[look_id]` para el detalle
- Query a Supabase con JOIN entre `looks`, `look_prendas` y `look_usos` para traer todos los datos en una sola llamada
- Las miniaturas del look se muestran como un conjunto de hasta 4 imágenes en un grid pequeño (tipo collage)
- Ordenar el listado por defecto: looks más recientemente usados primero; si nunca usados, por fecha de creación
- El placeholder de "Prenda eliminada" se renderiza cuando `look_prendas.prenda_id` apunta a una prenda con `deleted_at` no nulo (soft-delete) o cuando la prenda ya no existe
- Textos en español con claves i18n

---

## Dependencias

- [LOOKSI-020] Guardar look con nombre y fecha de uso
- [LOOKSI-012] Eliminar prenda (para manejar el escenario de prenda eliminada)
