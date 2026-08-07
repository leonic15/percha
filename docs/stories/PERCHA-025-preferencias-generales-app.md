# [EP-06] Configurar preferencias generales de la app

**ID:** PERCHA-025  
**Épica:** EP-06 — Preferencias y configuración del usuario  
**Prioridad:** Media  
**Estimación:** 3 puntos  
**Estado:** Completada

---

## Descripción

Como **usuario autenticado**, quiero **configurar el idioma, el tema visual y si quiero usar la integración de clima** para **personalizar la experiencia de la app según mis preferencias**.

---

## Criterios de aceptación

### Escenario 1: Cambiar idioma de la interfaz
- **Dado** que estoy en la pantalla de Configuración
- **Cuando** selecciono un idioma diferente al actual (ej: inglés)
- **Entonces** toda la interfaz de la app cambia al idioma seleccionado de forma inmediata, sin recargar la página

### Escenario 2: Idiomas disponibles en el MVP
- **Dado** que abro el selector de idioma
- **Cuando** veo las opciones disponibles
- **Entonces** veo al menos: Español (por defecto) e Inglés

### Escenario 3: Cambiar tema visual
- **Dado** que estoy en Configuración
- **Cuando** selecciono una opción de tema (Claro, Oscuro, Seguir sistema)
- **Entonces** el tema visual de la app cambia inmediatamente y la preferencia se persiste para próximas sesiones

### Escenario 4: Tema "Seguir sistema" por defecto
- **Dado** que soy un usuario nuevo sin preferencia de tema configurada
- **Cuando** uso la app por primera vez
- **Entonces** el tema sigue la preferencia del sistema operativo del dispositivo (light/dark mode)

### Escenario 5: Activar o desactivar integración de clima
- **Dado** que estoy en Configuración
- **Cuando** desactivo el toggle "Usar clima en la generación de looks"
- **Entonces** el bloque de clima no aparece en el formulario de generación de looks y los looks se generan sin datos climáticos

### Escenario 6: Reactivar integración de clima
- **Dado** que desactivé la integración de clima previamente
- **Cuando** vuelvo a activar el toggle en Configuración
- **Entonces** el bloque de clima vuelve a aparecer en el generador de looks con el comportamiento normal de EP-05

### Escenario 7: Preferencias persistidas entre sesiones
- **Dado** que configuré idioma, tema y preferencia de clima
- **Cuando** cierro la app y vuelvo a abrirla
- **Entonces** todas mis preferencias se mantienen exactamente como las dejé

---

## Notas técnicas

- Guardar en `profiles`: `idioma` (string, default `'es'`), `tema` (enum: `'claro'`, `'oscuro'`, `'sistema'`, default `'sistema'`), `clima_habilitado` (boolean, default `true`)
- El idioma se gestiona con `next-intl`: cambiar el locale activo en el cliente y persistirlo en `profiles`
- El tema se aplica vía clase CSS en el `<html>` (ej: `dark`) siguiendo la convención de Tailwind CSS dark mode
- El tema "Seguir sistema" usa `prefers-color-scheme` media query
- Las preferencias se cargan al iniciar sesión y se almacenan en el store del cliente para acceso rápido sin consultas adicionales a la DB
- La pantalla de Configuración también aloja la sección de ciudad manual de clima (PERCHA-023) y las preferencias de estilo (PERCHA-024) en secciones separadas
- Estructura sugerida de la pantalla de Configuración:
  - 🎨 Apariencia (tema visual)
  - 🌐 Idioma
  - 🌤️ Clima (toggle habilitado/deshabilitado + ciudad manual)
  - 👗 Estilo personal (estilos y ocasiones favoritas)
  - 👤 Cuenta (enlace a edición de perfil, cerrar sesión, eliminar cuenta)
- Textos en español con claves i18n

---

## Dependencias

- [PERCHA-005] Edición de perfil básico (comparte tabla `profiles`)
- [PERCHA-022] Obtener y mostrar clima en el generador de looks (toggle de clima)
- [PERCHA-023] Configurar ciudad manualmente (vive en esta pantalla)
- [PERCHA-024] Configurar preferencias de estilo personal (vive en esta pantalla)
