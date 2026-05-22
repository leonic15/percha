# [EP-05] Obtener y mostrar clima en el generador de looks

**ID:** LOOKSI-022  
**Épica:** EP-05 — Integración de clima  
**Prioridad:** Media  
**Estimación:** 3 puntos  
**Estado:** Pendiente

---

## Descripción

Como **usuario autenticado**, quiero **ver las condiciones climáticas actuales y el pronóstico del día en el formulario de generación de looks** para **que la IA tenga en cuenta el clima al sugerirme un outfit**.

---

## Criterios de aceptación

### Escenario 1: Clima cargado automáticamente por geolocalización
- **Dado** que abro el formulario de generación de looks y el navegador tiene permiso de geolocalización
- **Cuando** el formulario carga
- **Entonces** veo automáticamente el clima actual de mi ubicación: temperatura, sensación térmica, condición (ícono + texto), y el pronóstico del día dividido en mañana / tarde / noche

### Escenario 2: Usuario niega permiso de geolocalización
- **Dado** que el navegador no tiene permiso de geolocalización o el usuario lo deniega
- **Cuando** el formulario carga
- **Entonces** se muestra el clima de la ciudad configurada manualmente (LOOKSI-023); si no hay ciudad configurada, se muestra un mensaje invitando a configurarla con link directo a la configuración

### Escenario 3: API de clima no disponible
- **Dado** que la API de Open-Meteo falla o no responde en el tiempo límite (5 segundos)
- **Cuando** el formulario carga
- **Entonces** se muestra un aviso no intrusivo ("No se pudo obtener el clima. El look se generará sin datos climáticos") y el formulario queda habilitado para generar igual

### Escenario 4: Datos climáticos incluidos en la generación del look
- **Dado** que los datos de clima están disponibles en el formulario
- **Cuando** el usuario genera un look
- **Entonces** los datos climáticos (temperatura actual, sensación térmica, condición, franja del día) se envían al endpoint de generación de looks y la IA los utiliza para adaptar la sugerencia

### Escenario 5: Refrescar datos de clima
- **Dado** que los datos de clima se cargaron hace más de 30 minutos
- **Cuando** el usuario vuelve al formulario de generación
- **Entonces** los datos se actualizan automáticamente con una nueva consulta a la API

---

## Notas técnicas

- La consulta a Open-Meteo se realiza **siempre desde una API Route de Next.js** (`GET /api/clima`), nunca desde el cliente directamente
- Open-Meteo no requiere API key — es gratuito y sin autenticación
- Parámetros solicitados a Open-Meteo: `temperature_2m`, `apparent_temperature`, `weathercode`, `hourly` (para franjas del día)
- Franjas del día: mañana (6-12h), tarde (12-18h), noche (18-24h) — promediar temperaturas por franja
- Cachear la respuesta de clima en el servidor por 30 minutos (usando headers de cache de Next.js o una variable en memoria) para evitar llamadas excesivas
- La geolocalización se obtiene en el cliente con `navigator.geolocation.getCurrentPosition()` y las coordenadas se envían al API Route para consultar Open-Meteo
- Timeout de la consulta a Open-Meteo: 5 segundos
- Mapear los `weathercode` de Open-Meteo a textos en español e íconos de la app (soleado, parcialmente nublado, nublado, lluvia, tormenta, nieve)
- Textos en español con claves i18n

---

## Dependencias

- [LOOKSI-017] Generar look desde cero (consume los datos de clima)
- [LOOKSI-023] Configurar ciudad manualmente (fallback de geolocalización)
