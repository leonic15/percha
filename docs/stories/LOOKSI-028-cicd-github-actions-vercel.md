# [EP-07] CI/CD con GitHub Actions y deploy en Vercel

**ID:** LOOKSI-028  
**Épica:** EP-07 — Infraestructura y arquitectura base  
**Prioridad:** Alta  
**Estimación:** 3 puntos  
**Estado:** Completada

---

## Descripción

Como **desarrollador**, quiero **tener un pipeline de CI/CD automatizado que valide el código y desplegue la app en Vercel** para **asegurar que cada cambio en `main` se deploya correctamente y que no se mergea código roto**.

---

## Criterios de aceptación

### Escenario 1: CI se ejecuta en cada Pull Request
- **Dado** que abro o actualizo un Pull Request hacia `main`
- **Cuando** el pipeline de CI se dispara
- **Entonces** se ejecutan typecheck, lint y build de Next.js, y el PR no puede mergearse si alguno falla

### Escenario 2: Deploy automático a producción en merge a `main`
- **Dado** que un PR se mergea a la rama `main`
- **Cuando** el pipeline de CD se dispara
- **Entonces** Vercel hace el deploy automático de la nueva versión a producción

### Escenario 3: Preview deployments en PRs
- **Dado** que abro un Pull Request
- **Cuando** Vercel procesa el PR
- **Entonces** se genera automáticamente una URL de preview única para ese PR donde puedo revisar los cambios antes de mergear

### Escenario 4: Variables de entorno configuradas en Vercel
- **Dado** que la app se deploya en Vercel
- **Cuando** la app inicia en producción
- **Entonces** todas las variables de entorno necesarias están configuradas en Vercel (production y preview) y la app funciona correctamente

### Escenario 5: Secrets de GitHub configurados para CI
- **Dado** que el pipeline de CI necesita acceder a variables sensibles
- **Cuando** el workflow se ejecuta
- **Entonces** las variables sensibles se leen desde GitHub Secrets, nunca hardcodeadas en el código

---

## Notas técnicas

- **Workflow de CI** (`.github/workflows/ci.yml`):
  ```yaml
  on: [pull_request]
  jobs:
    ci:
      steps:
        - checkout
        - setup node
        - npm ci
        - npm run typecheck
        - npm run lint
        - npm run build
  ```
- **Variables de entorno requeridas** (documentadas en `.env.example`):
  ```
  NEXT_PUBLIC_SUPABASE_URL=
  NEXT_PUBLIC_SUPABASE_ANON_KEY=
  SUPABASE_SERVICE_ROLE_KEY=
  GEMINI_API_KEY=
  SENTRY_DSN=
  NEXT_PUBLIC_POSTHOG_KEY=
  NEXT_PUBLIC_POSTHOG_HOST=
  ```
- Integración nativa de Vercel con GitHub: conectar el repo en el dashboard de Vercel para habilitar preview deployments automáticos
- Branch de producción: `main`; no hay entorno de staging en el MVP (el preview deployment de Vercel cumple ese rol)
- Configurar `vercel.json` con las reglas necesarias si aplica (timeouts de funciones, regiones, etc.)
- El `.env.example` debe estar commiteado pero nunca el `.env.local` (en `.gitignore`)

---

## Dependencias

- [LOOKSI-026] Setup inicial del proyecto
