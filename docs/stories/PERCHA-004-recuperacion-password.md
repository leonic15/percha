# [EP-01] Recuperación de contraseña

**ID:** PERCHA-004  
**Épica:** EP-01 — Autenticación y gestión de cuenta  
**Prioridad:** Alta  
**Estimación:** 2 puntos  
**Estado:** Completada

---

## Descripción

Como **usuario registrado que olvidó su contraseña**, quiero **recibir un email para restablecer mi contraseña** para **recuperar el acceso a mi cuenta**.

---

## Criterios de aceptación

### Escenario 1: Solicitud de recuperación exitosa
- **Dado** que olvidé mi contraseña y estoy en la pantalla de login
- **Cuando** hago clic en "Olvidé mi contraseña", ingreso mi email registrado y envío el formulario
- **Entonces** recibo un email con un link de recuperación y veo un mensaje de confirmación en pantalla ("Si ese email existe, recibirás un link en breve")

### Escenario 2: Email no registrado
- **Dado** que ingreso un email que no existe en el sistema
- **Cuando** envío el formulario de recuperación
- **Entonces** veo el mismo mensaje de confirmación genérico (sin revelar si el email existe o no, por seguridad)

### Escenario 3: Restablecimiento exitoso de contraseña
- **Dado** que hice clic en el link de recuperación recibido por email (link válido y no expirado)
- **Cuando** ingreso una nueva contraseña válida y la confirmo
- **Entonces** mi contraseña se actualiza, soy autenticado automáticamente y redirigido al dashboard

### Escenario 4: Link de recuperación expirado o inválido
- **Dado** que hago clic en un link de recuperación expirado (>1 hora) o ya utilizado
- **Cuando** intento acceder a la pantalla de nueva contraseña
- **Entonces** veo un mensaje de error claro ("El link expiró o ya fue utilizado") con opción de solicitar uno nuevo

### Escenario 5: Nueva contraseña no cumple requisitos
- **Dado** que estoy en la pantalla de nueva contraseña con un link válido
- **Cuando** ingreso una contraseña que no cumple los requisitos mínimos
- **Entonces** veo un error inline y el formulario no se envía

---

## Notas técnicas

- Usar `supabase.auth.resetPasswordForEmail()` para enviar el email de recuperación
- Usar `supabase.auth.updateUser()` para actualizar la contraseña en la pantalla de restablecimiento
- El link de recuperación redirige a `/auth/reset-password` con los tokens en la URL (manejado por Supabase Auth)
- Expiración del link: 1 hora (configurable en Supabase Auth settings)
- No aplica a cuentas creadas exclusivamente con Google (no tienen contraseña); mostrar mensaje apropiado si el email está asociado solo a OAuth
- Usar el template de email de Supabase personalizado con branding de Percha y texto en español
- Textos en español con claves i18n

---

## Dependencias

- [PERCHA-001] Registro con email y contraseña
- [PERCHA-002] Login con email y contraseña
