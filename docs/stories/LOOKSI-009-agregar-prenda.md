# [EP-02] Agregar prenda

**ID:** LOOKSI-009  
**Épica:** EP-02 — Gestión del guardarropas (CRUD de prendas)  
**Prioridad:** Alta  
**Estimación:** 5 puntos  
**Estado:** Completada

---

## Descripción

Como **usuario autenticado**, quiero **fotografiar o seleccionar una imagen de una prenda y completar sus metadatos** para **agregarla a mi guardarropas**.

---

## Criterios de aceptación

### Escenario 1: Agregar prenda con cámara
- **Dado** que estoy en el guardarropas y hago clic en "Agregar prenda"
- **Cuando** elijo la opción "Tomar foto" y capturo la imagen con la cámara del dispositivo
- **Entonces** la imagen capturada aparece en el formulario lista para completar los metadatos

### Escenario 2: Agregar prenda desde galería
- **Dado** que estoy en el guardarropas y hago clic en "Agregar prenda"
- **Cuando** elijo la opción "Elegir de galería" y selecciono una imagen
- **Entonces** la imagen seleccionada aparece en el formulario lista para completar los metadatos

### Escenario 3: Completar metadatos y guardar
- **Dado** que tengo una imagen seleccionada en el formulario
- **Cuando** completo los campos requeridos (nombre y categoría) y hago clic en "Guardar"
- **Entonces** la prenda se guarda en la base de datos, la imagen se sube a Supabase Storage y la prenda aparece en mi guardarropas

### Escenario 4: Campos del formulario
- **Dado** que estoy en el formulario de nueva prenda
- **Cuando** lo visualizo
- **Entonces** veo los siguientes campos:
  - **Nombre** (texto, requerido)
  - **Categoría** (selector, requerido): Tops, Pantalones y Shorts, Vestidos y Faldas, Calzado, Abrigos y Chaquetas, Ropa Interior y Pijamas, Accesorios, Otros
  - **Subcategoría** (selector, requerido, opciones dependientes de la categoría)
  - **Color principal** (selector de color o texto, opcional)
  - **Estación** (multi-selector, opcional): Primavera, Verano, Otoño, Invierno, Todo el año
  - **Estilo** (multi-selector, opcional): Casual, Clásico, Deportivo, Elegante, Bohemio, Urbano
  - **Ocasión** (multi-selector, opcional): Casual, Trabajo, Formal, Deporte, Salida
  - **Estado** (selector, opcional): Nueva, Buena, Desgastada
  - **Notas** (textarea, opcional, máx. 500 caracteres)

### Escenario 5: Guardar sin imagen
- **Dado** que intento guardar la prenda sin haber seleccionado una imagen
- **Cuando** hago clic en "Guardar"
- **Entonces** veo un error de validación indicando que la imagen es requerida

### Escenario 6: Guardar sin nombre o categoría
- **Dado** que intento guardar la prenda sin completar los campos requeridos
- **Cuando** hago clic en "Guardar"
- **Entonces** veo errores de validación inline en los campos faltantes

### Escenario 7: Error al subir imagen
- **Dado** que ocurre un error al subir la imagen a Storage
- **Cuando** el proceso falla
- **Entonces** veo un mensaje de error claro, la prenda no se guarda y puedo reintentar sin perder los metadatos completados

---

## Notas técnicas

- Usar la API de `<input type="file" accept="image/*" capture="environment">` para cámara/galería en PWA
- Comprimir la imagen en el cliente antes de subir (usar `browser-image-compression`, target: 800KB, max 1200px)
- Path en Supabase Storage: `prendas/{user_id}/{prenda_id}.{ext}` (bucket `prendas`)
- RLS en bucket `prendas`: cada usuario solo puede leer/escribir en su propio path
- La subida de imagen y el guardado de metadatos se coordinan desde una API Route: primero se guarda el registro en DB obteniendo el `prenda_id`, luego se sube la imagen con ese ID
- Si la subida de imagen falla después de guardar en DB, reintentar o marcar la prenda como `sin_imagen`
- **Seed data de categorías y subcategorías:**

| Categoría | Subcategorías |
|---|---|
| Tops | Remera, Camisa, Blusa, Buzo, Musculosa, Polo |
| Pantalones y Shorts | Jean, Pantalón de vestir, Chino, Short, Jogging |
| Vestidos y Faldas | Vestido casual, Vestido formal, Falda corta, Falda larga |
| Calzado | Zapatillas, Zapatos, Botas, Sandalias, Mocasines |
| Abrigos y Chaquetas | Campera, Saco, Blazer, Tapado, Chaleco |
| Ropa Interior y Pijamas | Ropa interior, Pijama, Medias |
| Accesorios | Cinturón, Cartera, Mochila, Bufanda, Gorro, Anteojos, Joyería |
| Otros | Otro |

- Categorías y subcategorías almacenadas en tablas `categories` y `subcategories` con seed en migración inicial
- Textos en español con claves i18n

---

## Dependencias

- [LOOKSI-002] Login con email y contraseña (ruta protegida)
- [LOOKSI-007] Infraestructura base (Supabase Storage configurado)
