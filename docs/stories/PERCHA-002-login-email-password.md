# [EP-01] Login con email y contraseña

**ID:** PERCHA-002  
**Épica:** EP-01 — Autenticación y gestión de cuenta  
**Prioridad:** Alta  
**Estimación:** 2 puntos  
**Estado:** Completada

---

## Descripción

Como **usuario registrado**, quiero **iniciar sesión con mi email y contraseña** para **acceder a mi guardarropas en Percha**.

---

## Criterios de aceptación

### Escenario 1: Login exitoso
- **Dado** que soy un usuario registrado con email verificado
- **Cuando** ingreso mi email y contraseña correctos
- **Entonces** inicio sesión correctamente y soy redirigido al dashboard principal de la app

### Escenario 2: Credenciales incorrectas
- **Dado** que ingreso un email o contraseña incorrectos
- **Cuando** envío el formulario de login
- **Entonces** veo un mensaje de error genérico ("Email o contraseña incorrectos") sin indicar cuál de los dos falló

### Escenario 3: Email no verificado
- **Dado** que mi email no fue verificado aún
- **Cuando** intento hacer login con mis credenciales correctas
- **Entonces** veo un mensaje indicando que debo verificar mi email, con un botón para reenviar el correo de verificación

### Escenario 4: Sesión persistente
- **Dado** que inicié sesión previamente sin cerrar sesión
- **Cuando** vuelvo a abrir la app
- **Entonces** sigo autenticado y accedo directamente al dashboard sin volver a ingresar mis credenciales

### Escenario 5: Redirección post-login
- **Dado** que intenté acceder a una ruta protegida sin estar autenticado
- **Cuando** inicio sesión exitosamente
- **Entonces** soy redirigido a la ruta que intentaba acceder originalmente

---

## Notas técnicas

- Usar `supabase.auth.signInWithPassword()` desde una API Route de Next.js
- Implementar middleware de Next.js para proteger rutas autenticadas y manejar redirecciones
- La sesión se maneja con cookies HttpOnly mediante `@supabase/ssr`
- No mostrar información diferenciada entre "email no existe" y "contraseña incorrecta" (evitar enumeración de usuarios)
- Implementar protección básica contra fuerza bruta (Supabase tiene rate limiting nativo)
- Textos en español con claves i18n

---

## Dependencias

- [PERCHA-001] Registro con email y contraseña
