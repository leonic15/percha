# [EP-01] Eliminación de cuenta y datos

**ID:** LOOKSI-007  
**Épica:** EP-01 — Autenticación y gestión de cuenta  
**Prioridad:** Media  
**Estimación:** 3 puntos  
**Estado:** Completada

---

## Descripción

Como **usuario autenticado**, quiero **eliminar permanentemente mi cuenta y todos mis datos** para **tener control total sobre mi información personal**.

---

## Criterios de aceptación

### Escenario 1: Eliminación exitosa de cuenta
- **Dado** que estoy en la pantalla de configuración de cuenta
- **Cuando** hago clic en "Eliminar cuenta", confirmo escribiendo mi email en el campo de confirmación y hago clic en "Eliminar definitivamente"
- **Entonces** se eliminan todos mis datos (prendas, imágenes en Storage, looks guardados, perfil) y mi cuenta de Supabase Auth, y soy redirigido a la pantalla de inicio con un mensaje de confirmación

### Escenario 2: Confirmación requerida antes de eliminar
- **Dado** que hago clic en "Eliminar cuenta"
- **Cuando** aparece el diálogo de confirmación
- **Entonces** veo un aviso claro de que la acción es irreversible y se perderán todos los datos, y debo escribir mi email para confirmar (el botón de eliminar está deshabilitado hasta que el email coincida)

### Escenario 3: Email de confirmación no coincide
- **Dado** que estoy en el diálogo de eliminación de cuenta
- **Cuando** escribo un email que no coincide con el de mi cuenta
- **Entonces** el botón "Eliminar definitivamente" permanece deshabilitado y veo un indicador visual de que el email no coincide

### Escenario 4: Error durante la eliminación
- **Dado** que confirmo la eliminación de cuenta
- **Cuando** ocurre un error en el servidor durante el proceso
- **Entonces** veo un mensaje de error claro, mi cuenta no es eliminada y puedo reintentar

---

## Notas técnicas

- El proceso de eliminación debe ejecutarse en una API Route de Next.js con el service role key de Supabase (nunca desde el cliente)
- Orden de eliminación para respetar FK constraints:
  1. Imágenes en Supabase Storage (bucket `prendas` y `avatars`)
  2. Registros en tablas de la app (looks, prendas, preferencias, perfil)
  3. Usuario en `auth.users` via `supabase.auth.admin.deleteUser(userId)`
- Usar una transacción o función RPC de PostgreSQL para asegurar que la eliminación de datos sea atómica
- Considerar soft-delete en una iteración futura (para soporte al cliente), pero en MVP es hard-delete
- Cerrar la sesión activa antes de completar la eliminación
- La pantalla de confirmación debe ser un modal/drawer, no una página separada
- Textos en español con claves i18n; el campo de confirmación debe pedir exactamente el email tal como está registrado (case-insensitive)

---

## Dependencias

- [LOOKSI-001] Registro con email y contraseña (estructura de datos a eliminar)
- [LOOKSI-002] Login con email y contraseña
- [LOOKSI-005] Edición de perfil básico (imágenes en Storage a eliminar)
