# [EP-07] Observabilidad: Sentry, logs estructurados y error boundaries

**ID:** PERCHA-030  
**Épica:** EP-07 — Infraestructura y arquitectura base  
**Prioridad:** Media  
**Estimación:** 3 puntos  
**Estado:** Completada

---

## Descripción

Como **dueño del producto**, quiero **que los errores de la app se capturen automáticamente en Sentry y que el backend tenga logs estructurados** para **detectar y diagnosticar problemas en producción sin depender solo de los logs de Vercel**.

---

## Criterios de aceptación

### Escenario 1: Errores de frontend capturados en Sentry
- **Dado** que ocurre un error inesperado en el cliente (excepción no manejada, error de React)
- **Cuando** el error se produce en producción
- **Entonces** el error aparece en el dashboard de Sentry con stack trace, información del dispositivo/navegador y contexto del usuario (sin datos personales sensibles)

### Escenario 2: Errores de backend capturados en Sentry
- **Dado** que ocurre un error en una API Route de Next.js
- **Cuando** el error se produce en producción
- **Entonces** el error aparece en Sentry con stack trace, endpoint afectado, método HTTP y request ID, sin incluir body de requests que puedan contener datos sensibles

### Escenario 3: Error boundaries en el frontend
- **Dado** que un componente de React lanza un error inesperado
- **Cuando** el error boundary lo captura
- **Entonces** el usuario ve una pantalla de error amigable con opción de recargar, sin que toda la app se rompa; el error se reporta a Sentry automáticamente

### Escenario 4: Logs estructurados en API Routes
- **Dado** que una API Route procesa una request
- **Cuando** logueo información relevante
- **Entonces** los logs tienen formato JSON estructurado con campos: `timestamp`, `level`, `message`, `requestId`, `userId` (hasheado, no el UUID real), `endpoint`, `duration_ms`

### Escenario 5: Alertas de errores críticos
- **Dado** que Sentry detecta un error con frecuencia alta (más de 5 ocurrencias en 1 hora)
- **Cuando** se supera el umbral
- **Entonces** recibo una notificación por email (configurado en Sentry)

---

## Notas técnicas

- Usar `@sentry/nextjs` con el wizard de configuración (`npx @sentry/wizard@latest -i nextjs`)
- Sentry free tier: 5.000 errores/mes — más que suficiente para el MVP
- Configurar `sentry.client.config.ts` y `sentry.server.config.ts`
- **PII (datos personales):** configurar Sentry para scrubear automáticamente emails, nombres y tokens de las trazas; usar `beforeSend` hook para filtrar datos sensibles
- `userId` en logs: hashear con SHA-256 para correlacionar errores sin exponer el UUID real
- Error boundary global: wrappear el layout principal de Next.js con un Sentry Error Boundary
- Error boundaries locales en secciones críticas: generador de looks, carga de prendas, edición de perfil
- Logger utilitario en `/lib/utils/logger.ts` que wrappea `console.log/error` con formato JSON estructurado en producción y formato legible en desarrollo
- `SENTRY_DSN` en variables de entorno del servidor; `NEXT_PUBLIC_SENTRY_DSN` para el cliente (son el mismo DSN pero con distintos prefijos)
- Ignorar errores de red conocidos y errores de extensiones de browser en la config de Sentry

---

## Dependencias

- [PERCHA-026] Setup inicial del proyecto
- [PERCHA-028] CI/CD con GitHub Actions y deploy en Vercel
