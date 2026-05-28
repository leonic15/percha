# [EP-01] Registro con email y contraseña

**ID:** LOOKSI-001  
**Épica:** EP-01 — Autenticación y gestión de cuenta  
**Prioridad:** Alta  
**Estimación:** 3 puntos  
**Estado:** Completada

---

## Descripción

Como **usuario nuevo**, quiero **registrarme con mi email y una contraseña** para **crear mi cuenta en LookSi y comenzar a gestionar mi guardarropas**.

---

## Criterios de aceptación

### Escenario 1: Registro exitoso
- **Dado** que soy un usuario nuevo sin cuenta
- **Cuando** ingreso un email válido, una contraseña que cumpla los requisitos y confirmo la contraseña
- **Entonces** se crea mi cuenta en Supabase Auth, recibo un email de verificación y soy redirigido a una pantalla que me indica que verifique mi correo

### Escenario 2: Email ya registrado
- **Dado** que intento registrarme con un email que ya existe en el sistema
- **Cuando** envío el formulario de registro
- **Entonces** veo un mensaje de error claro indicando que ese email ya está en uso, sin revelar información sensible

### Escenario 3: Contraseña débil
- **Dado** que ingreso una contraseña que no cumple los requisitos mínimos (menos de 8 caracteres)
- **Cuando** intento enviar el formulario
- **Entonces** veo un mensaje de validación inline indicando los requisitos de contraseña, sin que el formulario se envíe

### Escenario 4: Contraseñas no coinciden
- **Dado** que el campo "confirmar contraseña" no coincide con el campo "contraseña"
- **Cuando** intento enviar el formulario
- **Entonces** veo un error inline indicando que las contraseñas no coinciden

### Escenario 5: Email no verificado intenta ingresar
- **Dado** que me registré pero no verifiqué mi email
- **Cuando** intento hacer login
- **Entonces** veo un mensaje que me indica que debo verificar mi email, con opción de reenviar el correo de verificación

---

## Notas técnicas

- Usar `supabase.auth.signUp()` desde una API Route de Next.js, nunca desde el cliente directamente
- Contraseña mínima: 8 caracteres (configurable en Supabase Auth settings)
- Activar confirmación de email en Supabase Auth (email confirmation habilitado)
- Crear registro en tabla `profiles` mediante trigger en PostgreSQL al crearse el usuario en `auth.users`
- El formulario debe tener protección básica contra envíos múltiples (deshabilitar botón mientras procesa)
- Textos del formulario y mensajes de error en español, con claves i18n desde el día 1

---

## Dependencias

- [LOOKSI-007] Infraestructura base de Supabase y proyecto Next.js inicializado (EP-07)
