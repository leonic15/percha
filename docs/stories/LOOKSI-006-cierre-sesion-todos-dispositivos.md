# [EP-01] Cierre de sesión en todos los dispositivos

**ID:** LOOKSI-006  
**Épica:** EP-01 — Autenticación y gestión de cuenta  
**Prioridad:** Media  
**Estimación:** 2 puntos  
**Estado:** Completada

---

## Descripción

Como **usuario autenticado**, quiero **cerrar sesión en todos mis dispositivos activos** para **asegurarme de que nadie más tenga acceso a mi cuenta**.

---

## Criterios de aceptación

### Escenario 1: Cierre de sesión local (dispositivo actual)
- **Dado** que estoy autenticado en la app
- **Cuando** hago clic en "Cerrar sesión" en el menú de perfil
- **Entonces** mi sesión actual se cierra, las cookies de sesión se eliminan y soy redirigido a la pantalla de login

### Escenario 2: Cierre de sesión en todos los dispositivos
- **Dado** que estoy en la pantalla de configuración de cuenta
- **Cuando** hago clic en "Cerrar sesión en todos los dispositivos" y confirmo la acción en el diálogo de confirmación
- **Entonces** todas las sesiones activas (en cualquier dispositivo) quedan invalidadas, incluyendo la actual, y soy redirigido a la pantalla de login

### Escenario 3: Confirmación antes de cerrar todas las sesiones
- **Dado** que hago clic en "Cerrar sesión en todos los dispositivos"
- **Cuando** aparece el diálogo de confirmación
- **Entonces** veo un mensaje claro advirtiendo que se cerrarán todas las sesiones activas, con botones "Confirmar" y "Cancelar"

### Escenario 4: Sesión invalidada en otro dispositivo
- **Dado** que cerré sesión en todos los dispositivos desde un dispositivo A
- **Cuando** el dispositivo B (con sesión previamente activa) intenta hacer cualquier acción autenticada
- **Entonces** el dispositivo B es redirigido automáticamente a la pantalla de login

---

## Notas técnicas

- Cierre de sesión local: `supabase.auth.signOut({ scope: 'local' })` + limpiar cookies
- Cierre de sesión global: `supabase.auth.signOut({ scope: 'global' })` — invalida todos los refresh tokens del usuario en Supabase
- El middleware de Next.js detecta la sesión inválida en el siguiente request y redirige a login
- Limpiar cualquier estado de cliente (cache de React Query, Zustand store, etc.) al cerrar sesión
- El botón de "Cerrar sesión en todos los dispositivos" se ubica en la pantalla de configuración de cuenta (no en el menú principal)
- Textos en español con claves i18n

---

## Dependencias

- [LOOKSI-002] Login con email y contraseña (comparte middleware de rutas protegidas)
