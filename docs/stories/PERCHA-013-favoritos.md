# [EP-02] Marcar / desmarcar prenda como favorita

**ID:** PERCHA-013  
**Épica:** EP-02 — Gestión del guardarropas (CRUD de prendas)  
**Prioridad:** Media  
**Estimación:** 1 punto  
**Estado:** Completada

---

## Descripción

Como **usuario autenticado**, quiero **marcar o desmarcar prendas como favoritas** para **acceder rápidamente a las prendas que más uso o que más me gustan**.

---

## Criterios de aceptación

### Escenario 1: Marcar como favorita desde el detalle
- **Dado** que estoy en el detalle de una prenda no marcada como favorita
- **Cuando** hago clic en el ícono de favorito (corazón/estrella vacío)
- **Entonces** la prenda queda marcada como favorita, el ícono cambia a su estado "activo" y el cambio se refleja en tiempo real

### Escenario 2: Desmarcar favorita desde el detalle
- **Dado** que estoy en el detalle de una prenda marcada como favorita
- **Cuando** hago clic en el ícono de favorito activo
- **Entonces** la prenda deja de ser favorita, el ícono vuelve a su estado vacío y el cambio se refleja en tiempo real

### Escenario 3: Marcar/desmarcar desde la grilla
- **Dado** que estoy en el listado del guardarropas
- **Cuando** hago clic en el ícono de favorito visible en la tarjeta de una prenda (sin ir al detalle)
- **Entonces** el estado de favorito cambia en tiempo real sin necesidad de recargar la lista

### Escenario 4: Filtrar favoritas en la grilla
- **Dado** que tengo prendas marcadas como favoritas
- **Cuando** activo el filtro de favoritos en el listado
- **Entonces** la grilla muestra solo las prendas marcadas como favoritas

---

## Notas técnicas

- Campo `is_favorite` (boolean, default `false`) en la tabla `prendas`
- Actualización vía PATCH a la API Route `/api/prendas/[prenda_id]` con solo el campo `is_favorite`
- Implementar optimistic update en el cliente para respuesta inmediata sin esperar la confirmación del servidor
- En caso de error en el servidor, revertir el cambio optimista y mostrar un toast de error
- El ícono de favorito en la tarjeta de la grilla debe ser accesible (área de tap suficiente, mínimo 44x44px) sin interferir con el tap para ir al detalle
- Textos en español con claves i18n

---

## Dependencias

- [PERCHA-008] Listado del guardarropas
- [PERCHA-010] Ver detalle de prenda
