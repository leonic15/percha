# [EP-05] Configurar ciudad manualmente como fallback

**ID:** PERCHA-023  
**Épica:** EP-05 — Integración de clima  
**Prioridad:** Media  
**Estimación:** 2 puntos  
**Estado:** Completada

---

## Descripción

Como **usuario autenticado**, quiero **configurar mi ciudad manualmente** para **que la app pueda obtener el clima correcto cuando no quiero o no puedo usar la geolocalización**.

---

## Criterios de aceptación

### Escenario 1: Configurar ciudad desde ajustes
- **Dado** que estoy en la pantalla de preferencias/configuración de la app
- **Cuando** accedo a la sección de clima e ingreso el nombre de mi ciudad
- **Entonces** la ciudad se guarda en mi perfil y se usa como ubicación por defecto para las consultas de clima cuando no hay geolocalización disponible

### Escenario 2: Búsqueda y selección de ciudad
- **Dado** que estoy ingresando mi ciudad en el campo de configuración
- **Cuando** escribo al menos 3 caracteres
- **Entonces** veo una lista de sugerencias de ciudades que coinciden con lo escrito, y al seleccionar una queda guardada con sus coordenadas exactas

### Escenario 3: Ciudad configurada tiene prioridad sobre geolocalización puntual
- **Dado** que tengo una ciudad configurada manualmente Y el navegador tiene permiso de geolocalización
- **Cuando** abro el generador de looks
- **Entonces** se usa la geolocalización en tiempo real (más precisa), pero se muestra un indicador de la ciudad configurada con opción de "Usar ciudad guardada" para alternar

### Escenario 4: Eliminar ciudad configurada
- **Dado** que tengo una ciudad configurada y quiero volver a usar solo geolocalización
- **Cuando** borro la ciudad desde la configuración
- **Entonces** la ciudad se elimina del perfil y la app vuelve a usar geolocalización exclusivamente

### Escenario 5: Ciudad no encontrada
- **Dado** que ingreso un nombre de ciudad que no existe en la base de datos de Open-Meteo
- **Cuando** busco
- **Entonces** veo un mensaje indicando que no se encontró la ciudad y sugiriendo intentar con otro nombre o nombre en inglés

---

## Notas técnicas

- Usar la API de geocoding de Open-Meteo (`https://geocoding-api.open-meteo.com/v1/search`) para buscar ciudades por nombre — gratuita y sin API key
- Guardar en `profiles`: `ciudad_nombre` (string), `ciudad_latitud` (float), `ciudad_longitud` (float)
- La búsqueda de ciudades se hace desde una API Route (`GET /api/clima/ciudades?q=`) para no exponer la llamada directa desde el cliente
- Debounce de 300ms en el campo de búsqueda para no saturar la API
- Guardar también el país de la ciudad en `profiles.ciudad_pais` para mostrar contexto (ej: "Buenos Aires, AR") cuando hay varias ciudades con el mismo nombre
- Textos en español con claves i18n

---

## Dependencias

- [PERCHA-022] Obtener y mostrar clima en el generador de looks
- [PERCHA-006] Preferencias y configuración del usuario — EP-06 (la configuración de ciudad vive en esa pantalla)
