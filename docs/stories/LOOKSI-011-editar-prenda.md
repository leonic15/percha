# [EP-02] Editar prenda

**ID:** LOOKSI-011  
**Épica:** EP-02 — Gestión del guardarropas (CRUD de prendas)  
**Prioridad:** Alta  
**Estimación:** 3 puntos  
**Estado:** Completada

---

## Descripción

Como **usuario autenticado**, quiero **editar los metadatos o la imagen de una prenda existente** para **mantener mi guardarropas actualizado y correcto**.

---

## Criterios de aceptación

### Escenario 1: Acceder a la edición
- **Dado** que estoy en el detalle de una prenda
- **Cuando** hago clic en "Editar"
- **Entonces** accedo al formulario de edición con todos los campos pre-completados con los valores actuales de la prenda

### Escenario 2: Editar metadatos exitosamente
- **Dado** que estoy en el formulario de edición
- **Cuando** modifico uno o más campos y hago clic en "Guardar cambios"
- **Entonces** los cambios se guardan en la base de datos y soy redirigido al detalle de la prenda con los nuevos datos reflejados

### Escenario 3: Reemplazar imagen
- **Dado** que estoy en el formulario de edición
- **Cuando** hago clic en la imagen actual y selecciono una nueva foto (cámara o galería)
- **Entonces** la nueva imagen reemplaza a la anterior en Supabase Storage y veo la preview de la nueva imagen en el formulario antes de guardar

### Escenario 4: Guardar sin cambios
- **Dado** que abro el formulario de edición sin modificar nada
- **Cuando** hago clic en "Guardar cambios"
- **Entonces** no se realiza ninguna llamada a la API y soy redirigido al detalle sin cambios

### Escenario 5: Cancelar edición
- **Dado** que modifiqué campos en el formulario de edición
- **Cuando** hago clic en "Cancelar"
- **Entonces** los cambios se descartan, no se realiza ninguna llamada a la API y regreso al detalle de la prenda con los datos originales

### Escenario 6: Error al guardar
- **Dado** que intento guardar los cambios
- **Cuando** ocurre un error en el servidor
- **Entonces** veo un mensaje de error claro, los cambios no se aplican y puedo reintentar

---

## Notas técnicas

- Ruta: `/guardarropas/[prenda_id]/editar`
- Verificar que la prenda pertenezca al usuario autenticado antes de permitir la edición
- Al reemplazar imagen: subir la nueva imagen a Storage antes de actualizar el registro en DB; eliminar la imagen anterior de Storage una vez confirmado el guardado exitoso
- Usar PATCH en la API Route (no PUT) para actualizar solo los campos modificados
- Detectar si hubo cambios reales antes de enviar la petición (comparar estado inicial vs. actual del formulario)
- Reutilizar el mismo componente de formulario de LOOKSI-009 en modo edición
- Textos en español con claves i18n

---

## Dependencias

- [LOOKSI-009] Agregar prenda (reutiliza componente de formulario)
- [LOOKSI-010] Ver detalle de prenda (punto de entrada a la edición)
