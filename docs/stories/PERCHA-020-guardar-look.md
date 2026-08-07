# [EP-04] Guardar look con nombre y fecha de uso

**ID:** PERCHA-020  
**Épica:** EP-04 — Generación de looks con IA  
**Prioridad:** Alta  
**Estimación:** 3 puntos  
**Estado:** Completada

---

## Descripción

Como **usuario autenticado**, quiero **guardar un look generado con un nombre y registrar cuándo lo usé** para **tener un historial de mis outfits y poder consultarlos o reutilizarlos después**.

---

## Criterios de aceptación

### Escenario 1: Guardar look con nombre
- **Dado** que estoy satisfecho con un look generado
- **Cuando** hago clic en "Guardar look", ingreso un nombre (o acepto el sugerido por la IA) y confirmo
- **Entonces** el look se guarda en la base de datos con sus prendas, descripción, parámetros de generación y nombre, y soy redirigido al detalle del look guardado

### Escenario 2: Nombre sugerido por la IA
- **Dado** que voy a guardar un look
- **Cuando** se abre el diálogo de guardado
- **Entonces** el campo de nombre viene pre-completado con un nombre sugerido por la IA (ej: "Look casual de otoño") que puedo editar libremente

### Escenario 3: Usar hoy — registrar fecha de uso
- **Dado** que estoy viendo un look (recién generado o guardado previamente)
- **Cuando** hago clic en "Usar hoy"
- **Entonces** se registra la fecha de hoy como fecha de uso del look; si el look no estaba guardado, se guarda automáticamente antes de registrar el uso

### Escenario 4: Registrar uso en una fecha pasada
- **Dado** que quiero registrar que usé un look en un día anterior
- **Cuando** hago clic en "Registrar uso" y selecciono una fecha pasada en el date picker
- **Entonces** se agrega esa fecha al historial de usos del look

### Escenario 5: Un look puede tener múltiples fechas de uso
- **Dado** que guardé un look y lo usé en distintas ocasiones
- **Cuando** registro múltiples usos
- **Entonces** el look muestra todas las fechas en las que fue usado, ordenadas de más reciente a más antigua

### Escenario 6: Guardar sin nombre
- **Dado** que borro el nombre sugerido y no ingreso ninguno
- **Cuando** intento guardar
- **Entonces** veo un error de validación indicando que el nombre es requerido

---

## Notas técnicas

- Tabla `looks`: `id`, `user_id`, `nombre`, `descripcion_ia`, `parametros_generacion` (JSONB: ocasión, estilo, clima, temperatura), `created_at`
- Tabla `look_prendas`: `look_id`, `prenda_id`, `es_prenda_base` (boolean) — relación N:N entre looks y prendas
- Tabla `look_usos`: `id`, `look_id`, `fecha_uso` (date), `created_at` — historial de usos del look
- Si una prenda del look es eliminada posteriormente (PERCHA-012), el registro en `look_prendas` queda con `prenda_id` marcado (via soft-delete o columna `prenda_eliminada: true`) para no romper el historial
- El nombre sugerido por la IA viene en la respuesta del endpoint de generación (`POST /api/looks/generar`), campo `nombre_sugerido`
- El guardado del look se hace desde una API Route con validación de que todas las prendas pertenecen al usuario
- Textos en español con claves i18n

---

## Dependencias

- [PERCHA-017] Generar look desde cero
- [PERCHA-018] Generar look desde prenda base
- [PERCHA-019] Revisar y ajustar look generado
- [PERCHA-021] Ver historial de looks guardados
