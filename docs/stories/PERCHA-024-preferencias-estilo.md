# [EP-06] Configurar preferencias de estilo personal

**ID:** PERCHA-024  
**Épica:** EP-06 — Preferencias y configuración del usuario  
**Prioridad:** Media  
**Estimación:** 2 puntos  
**Estado:** Completada

---

## Descripción

Como **usuario autenticado**, quiero **configurar mis estilos favoritos y las ocasiones más frecuentes en las que me visto** para **que el generador de looks los use como valores por defecto y agilizar la creación de outfits**.

---

## Criterios de aceptación

### Escenario 1: Configurar estilos favoritos
- **Dado** que estoy en la pantalla de Configuración
- **Cuando** accedo a la sección "Estilo personal" y selecciono uno o más estilos favoritos (Casual, Clásico, Deportivo, Elegante, Bohemio, Urbano)
- **Entonces** los estilos seleccionados se guardan en mi perfil y se pre-seleccionan automáticamente en el formulario de generación de looks

### Escenario 2: Configurar ocasiones frecuentes
- **Dado** que estoy en la sección "Estilo personal"
- **Cuando** selecciono una o más ocasiones frecuentes (Casual, Trabajo, Formal, Deporte, Salida)
- **Entonces** las ocasiones seleccionadas se guardan en mi perfil y la primera ocasión frecuente se pre-selecciona por defecto en el formulario de generación de looks

### Escenario 3: Pre-selección en el generador de looks
- **Dado** que configuré estilos y ocasiones favoritas
- **Cuando** abro el formulario de generación de looks
- **Entonces** los campos de estilo y ocasión vienen pre-completados con mis preferencias guardadas, pero puedo modificarlos libremente para cada generación

### Escenario 4: Sin preferencias configuradas
- **Dado** que no configuré ninguna preferencia de estilo
- **Cuando** abro el generador de looks
- **Entonces** los campos de estilo y ocasión aparecen vacíos, igual que antes de esta historia

### Escenario 5: Actualizar preferencias
- **Dado** que ya tengo preferencias guardadas
- **Cuando** las modifico en Configuración y guardo
- **Entonces** los nuevos valores se reflejan inmediatamente en el generador de looks

---

## Notas técnicas

- Guardar en `profiles`: `estilos_favoritos` (array JSONB), `ocasiones_frecuentes` (array JSONB)
- Los valores válidos para estilos y ocasiones son los mismos definidos en EP-02 y EP-04 (consistencia total)
- Actualización vía PATCH al API Route del perfil
- La pre-selección en el generador de looks se hace leyendo `profiles` al cargar el formulario
- Permitir selección múltiple en ambos campos (el usuario puede tener varios estilos y ocasiones favoritas)
- Textos en español con claves i18n

---

## Dependencias

- [PERCHA-005] Edición de perfil básico (comparte tabla `profiles`)
- [PERCHA-017] Generar look desde cero (consume las preferencias guardadas)
