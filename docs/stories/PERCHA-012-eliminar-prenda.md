# [EP-02] Eliminar prenda

**ID:** PERCHA-012  
**Épica:** EP-02 — Gestión del guardarropas (CRUD de prendas)  
**Prioridad:** Alta  
**Estimación:** 2 puntos  
**Estado:** Completada

---

## Descripción

Como **usuario autenticado**, quiero **eliminar una prenda de mi guardarropas** para **mantener mi colección ordenada y sin prendas que ya no poseo**.

---

## Criterios de aceptación

### Escenario 1: Eliminar prenda con confirmación
- **Dado** que estoy en el detalle de una prenda
- **Cuando** hago clic en "Eliminar" y confirmo en el diálogo de confirmación
- **Entonces** la prenda se elimina de la base de datos, su imagen se elimina de Supabase Storage y soy redirigido al listado del guardarropas

### Escenario 2: Diálogo de confirmación
- **Dado** que hago clic en "Eliminar" desde el detalle de la prenda
- **Cuando** aparece el diálogo de confirmación
- **Entonces** veo el nombre de la prenda a eliminar, un aviso de que la acción es irreversible y botones "Eliminar" y "Cancelar"

### Escenario 3: Cancelar eliminación
- **Dado** que aparece el diálogo de confirmación
- **Cuando** hago clic en "Cancelar"
- **Entonces** el diálogo se cierra y la prenda no se elimina

### Escenario 4: Error al eliminar
- **Dado** que confirmo la eliminación
- **Cuando** ocurre un error en el servidor
- **Entonces** veo un mensaje de error claro, la prenda no se elimina y puedo reintentar

### Escenario 5: Prenda incluida en looks guardados
- **Dado** que la prenda a eliminar forma parte de uno o más looks guardados (EP-04)
- **Cuando** confirmo la eliminación
- **Entonces** la prenda se elimina y los looks que la referenciaban muestran una indicación de "prenda eliminada" en lugar de romper

---

## Notas técnicas

- La eliminación se ejecuta desde una API Route con service role o RLS adecuado
- Orden de eliminación:
  1. Imagen en Supabase Storage (`prendas/{user_id}/{prenda_id}.*`)
  2. Registro en tabla `prendas`
- Si falla la eliminación de la imagen en Storage, igual eliminar el registro en DB (la imagen huérfana se puede limpiar con un job periódico)
- Verificar que la prenda pertenezca al usuario autenticado antes de proceder
- Para el escenario de looks: usar `ON DELETE SET NULL` o una columna `deleted` en la relación prenda-look (definir en EP-04)
- Textos en español con claves i18n

---

## Dependencias

- [PERCHA-010] Ver detalle de prenda (punto de entrada a la eliminación)
