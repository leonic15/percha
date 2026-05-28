# [EP-02] Ver detalle de prenda

**ID:** LOOKSI-010  
**Épica:** EP-02 — Gestión del guardarropas (CRUD de prendas)  
**Prioridad:** Alta  
**Estimación:** 2 puntos  
**Estado:** Completada

---

## Descripción

Como **usuario autenticado**, quiero **ver todos los detalles de una prenda** para **conocer su información completa y acceder a las acciones disponibles sobre ella**.

---

## Criterios de aceptación

### Escenario 1: Acceder al detalle desde la grilla
- **Dado** que estoy en el listado del guardarropas
- **Cuando** hago tap/clic en una prenda de la grilla
- **Entonces** accedo a la pantalla de detalle de esa prenda

### Escenario 2: Visualización del detalle
- **Dado** que estoy en la pantalla de detalle de una prenda
- **Cuando** la pantalla carga
- **Entonces** veo:
  - Imagen de la prenda en tamaño grande
  - Nombre de la prenda
  - Categoría y subcategoría
  - Color principal (si fue cargado)
  - Estaciones aplicables (chips/tags)
  - Estilos (chips/tags)
  - Ocasiones (chips/tags)
  - Estado de la prenda
  - Notas (si las hay)
  - Indicador visual si está marcada como favorita
  - Fecha en que fue agregada al guardarropas
  - Botones de acción: Editar, Eliminar, Marcar/desmarcar favorita

### Escenario 3: Prenda con descripción generada por IA
- **Dado** que la prenda tiene una descripción generada por IA (EP-03)
- **Cuando** veo el detalle
- **Entonces** veo también la descripción de IA en una sección separada claramente identificada

### Escenario 4: Navegación hacia atrás
- **Dado** que estoy en el detalle de una prenda
- **Cuando** presiono el botón de volver
- **Entonces** regreso al listado del guardarropas manteniendo los filtros que tenía activos

---

## Notas técnicas

- Ruta: `/guardarropas/[prenda_id]` — ruta dinámica de Next.js
- Verificar que la prenda pertenezca al usuario autenticado (RLS en Supabase + validación en API Route)
- La imagen se sirve desde la URL pública de Supabase Storage
- Implementar OG tags básicos para la ruta (no es pública, pero buena práctica)
- Los chips de estación/estilo/ocasión provienen de los arrays JSONB almacenados en la tabla `prendas`
- Textos en español con claves i18n

---

## Dependencias

- [LOOKSI-008] Listado del guardarropas
- [LOOKSI-009] Agregar prenda
