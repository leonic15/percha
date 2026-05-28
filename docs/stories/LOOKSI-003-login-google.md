# [EP-01] Login con Google

**ID:** LOOKSI-003  
**Épica:** EP-01 — Autenticación y gestión de cuenta  
**Prioridad:** Alta  
**Estimación:** 3 puntos  
**Estado:** Completada

---

## Descripción

Como **usuario nuevo o existente**, quiero **iniciar sesión con mi cuenta de Google** para **acceder a LookSi sin necesidad de recordar una contraseña**.

---

## Criterios de aceptación

### Escenario 1: Login con Google exitoso — usuario nuevo
- **Dado** que soy un usuario nuevo sin cuenta en LookSi
- **Cuando** hago clic en "Continuar con Google" y autorizo el acceso en el popup de Google
- **Entonces** se crea mi cuenta automáticamente usando mi email de Google, se crea mi perfil en la tabla `profiles` y soy redirigido al dashboard

### Escenario 2: Login con Google exitoso — usuario existente
- **Dado** que ya tengo cuenta en LookSi (ya sea por email/contraseña o Google previo)
- **Cuando** hago clic en "Continuar con Google" y autorizo el acceso
- **Entonces** inicio sesión con mi cuenta existente y soy redirigido al dashboard

### Escenario 3: Usuario cancela el popup de Google
- **Dado** que hago clic en "Continuar con Google"
- **Cuando** cierro el popup de Google sin autorizar
- **Entonces** vuelvo a la pantalla de login sin ningún error visible, solo el formulario original

### Escenario 4: Error de OAuth
- **Dado** que ocurre un error durante el flujo OAuth (timeout, error de red, etc.)
- **Cuando** se completa o falla el callback
- **Entonces** veo un mensaje de error claro con opción de reintentar

---

## Notas técnicas

- Usar `supabase.auth.signInWithOAuth({ provider: 'google' })` con flujo PKCE
- Configurar OAuth App en Google Cloud Console con los redirect URIs correctos (local + producción)
- Configurar proveedor Google en Supabase Auth dashboard
- El callback de OAuth se maneja en `/auth/callback` como ruta de Next.js
- Crear registro en `profiles` via trigger de PostgreSQL igual que en registro por email (el trigger debe ser genérico para ambos métodos)
- Solicitar solo scopes mínimos necesarios: `email` y `profile`
- Textos del botón en español con claves i18n ("Continuar con Google" es estándar y no requiere traducción según guías de Google)

---

## Dependencias

- [LOOKSI-001] Registro con email y contraseña (comparte trigger de creación de perfil)
- [LOOKSI-002] Login con email y contraseña (comparte middleware de rutas protegidas)
