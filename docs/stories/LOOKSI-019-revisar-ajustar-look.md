# [EP-04] Revisar y ajustar look generado

**ID:** LOOKSI-019  
**Épica:** EP-04 — Generación de looks con IA  
**Prioridad:** Alta  
**Estimación:** 4 puntos  
**Estado:** Pendiente

---

## Descripción

Como **usuario autenticado**, quiero **poder regenerar el look completo o reemplazar una prenda específica sin perder el resto** para **ajustar la sugerencia de la IA hasta obtener el outfit que realmente quiero usar**.

---

## Criterios de aceptación

### Escenario 1: Regenerar el look completo
- **Dado** que veo un look generado que no me convence en general
- **Cuando** hago clic en "Regenerar look"
- **Entonces** la IA genera un nuevo look diferente con los mismos parámetros originales, reemplazando el anterior en pantalla

### Escenario 2: Cambiar una prenda específica
- **Dado** que veo un look generado y quiero cambiar solo una prenda puntual
- **Cuando** hago clic en "Cambiar esta prenda" sobre una prenda del look
- **Entonces** la IA sugiere una prenda alternativa de mi guardarropas que sea compatible con el resto del look, reemplazando solo esa prenda

### Escenario 3: No hay alternativas para reemplazar una prenda
- **Dado** que quiero cambiar una prenda pero no hay otras opciones compatibles en mi guardarropas
- **Cuando** solicito el cambio
- **Entonces** veo un mensaje indicando que no hay alternativas disponibles y sugiriendo agregar más prendas al guardarropas

### Escenario 4: Mantener historial de versiones del look en sesión
- **Dado** que regeneré el look una o más veces
- **Cuando** estoy viendo el look actual
- **Entonces** puedo navegar a las versiones anteriores generadas en la misma sesión con botones "anterior / siguiente" para comparar y elegir la que más me gusta

### Escenario 5: Confirmar look para guardar o usar
- **Dado** que estoy satisfecho con el look (original o ajustado)
- **Cuando** hago clic en "Guardar look" o "Usar hoy"
- **Entonces** el look pasa al flujo de guardado de LOOKSI-020

---

## Notas técnicas

- "Cambiar una prenda": endpoint `POST /api/looks/cambiar-prenda` — recibe el ID del look en sesión, el ID de la prenda a reemplazar y los IDs del resto de las prendas; la IA elige la mejor alternativa
- El historial de versiones del look vive solo en estado de cliente (no se persiste en DB hasta que el usuario guarda) — usar un array de versiones en el store del cliente (React state o Zustand)
- Limitar el historial de versiones en sesión a 5 versiones para no sobrecargar memoria del cliente
- Cada regeneración o cambio de prenda registra una entrada en `ai_usage`
- El botón "Cambiar esta prenda" aparece en hover/tap sobre cada prenda del look (no permanentemente visible para no saturar la UI)
- Textos en español con claves i18n

---

## Dependencias

- [LOOKSI-017] Generar look desde cero
- [LOOKSI-018] Generar look desde prenda base
- [LOOKSI-020] Guardar look con nombre y fecha de uso (siguiente paso)
