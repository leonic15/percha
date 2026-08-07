# [EP-02] Listado del guardarropas

**ID:** PERCHA-008  
**Épica:** EP-02 — Gestión del guardarropas (CRUD de prendas)  
**Prioridad:** Alta  
**Estimación:** 3 puntos  
**Estado:** Completada

---

## Descripción

Como **usuario autenticado**, quiero **ver todas mis prendas en una grilla con filtros y búsqueda** para **encontrar rápidamente cualquier prenda de mi guardarropas**.

---

## Criterios de aceptación

### Escenario 1: Visualización de la grilla
- **Dado** que tengo prendas cargadas en mi guardarropas
- **Cuando** accedo a la sección principal del guardarropas
- **Entonces** veo una grilla de tarjetas con la foto de cada prenda, su nombre y categoría

### Escenario 2: Guardarropas vacío
- **Dado** que no tengo ninguna prenda cargada
- **Cuando** accedo al guardarropas
- **Entonces** veo un estado vacío con un mensaje motivador y un botón de acceso rápido para agregar la primera prenda

### Escenario 3: Filtrar por categoría
- **Dado** que estoy en el listado del guardarropas
- **Cuando** selecciono una o más categorías en el panel de filtros
- **Entonces** la grilla muestra solo las prendas que corresponden a esas categorías, actualizándose en tiempo real

### Escenario 4: Filtrar por estación
- **Dado** que estoy en el listado del guardarropas
- **Cuando** selecciono una estación (Primavera, Verano, Otoño, Invierno, Todo el año)
- **Entonces** la grilla muestra solo las prendas etiquetadas con esa estación

### Escenario 5: Filtrar por ocasión
- **Dado** que estoy en el listado del guardarropas
- **Cuando** selecciono una ocasión (Casual, Trabajo, Formal, Deporte, Salida)
- **Entonces** la grilla muestra solo las prendas etiquetadas con esa ocasión

### Escenario 6: Filtrar por favoritos
- **Dado** que tengo prendas marcadas como favoritas
- **Cuando** activo el filtro de favoritos
- **Entonces** la grilla muestra solo las prendas marcadas como favoritas

### Escenario 7: Combinar múltiples filtros
- **Dado** que tengo filtros activos (ej: categoría + estación)
- **Cuando** agrego un filtro adicional
- **Entonces** la grilla muestra solo las prendas que cumplen todos los filtros activos simultáneamente

### Escenario 8: Búsqueda por texto
- **Dado** que estoy en el listado del guardarropas
- **Cuando** escribo en el campo de búsqueda
- **Entonces** la grilla se actualiza mostrando solo las prendas cuyo nombre, color o notas contengan el texto ingresado (búsqueda case-insensitive)

### Escenario 9: Sin resultados para los filtros aplicados
- **Dado** que apliqué filtros o búsqueda que no tienen coincidencias
- **Cuando** la grilla queda vacía
- **Entonces** veo un mensaje indicando que no hay prendas con esos criterios y un botón para limpiar los filtros

---

## Notas técnicas

- Query a Supabase con filtros combinados usando `.filter()` y `.ilike()` para búsqueda de texto
- Implementar paginación o scroll infinito (pageSize: 20 prendas) para no cargar todo el guardarropas de una vez
- Los filtros activos persisten durante la sesión (estado en URL params para permitir compartir/volver)
- La grilla es responsive: 2 columnas en mobile, 3-4 en tablet/desktop
- Las imágenes se muestran desde Supabase Storage usando URLs públicas con lazy loading
- Categorías y subcategorías disponibles como seed data en la DB (ver PERCHA-009)
- Valores de estación: `primavera`, `verano`, `otoño`, `invierno`, `todo_el_año`
- Valores de ocasión: `casual`, `trabajo`, `formal`, `deporte`, `salida`
- Textos en español con claves i18n

---

## Dependencias

- [PERCHA-009] Agregar prenda (para tener datos que mostrar)
- [PERCHA-002] Login con email y contraseña (ruta protegida)
