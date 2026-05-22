# Prompt para Claude Code — LookSi (Sesión de Historias de Usuario)

## Rol y contexto

Sos un arquitecto de software y product manager experto. Vas a ayudarme a definir y documentar las **historias de usuario del MVP** de **LookSi**, una PWA de gestión de guardarropas con IA.

---

## Descripción del producto

**LookSi** es una Progressive Web App (PWA) que permite a los usuarios:
- Fotografiar y registrar prendas de su guardarropas
- Obtener descripciones automáticas de cada prenda mediante IA (Gemini 2.5 Flash-Lite con visión nativa)
- Enriquecer manualmente esas descripciones con metadatos (estación, estilo, ocasión, estado, etc.)
- Recibir sugerencias de looks completos o parciales basadas en prendas iniciales, estilo, ocasión y clima actual

La app está pensada inicialmente para uso personal/familiar (1–2 usuarios) con arquitectura que soporte escalar a múltiples usuarios sin migraciones de datos ni rediseño estructural.

---

## Stack y arquitectura definidos (no negociables)

Al generar historias técnicas o de arquitectura, tené en cuenta estos lineamientos:

### Stack
| Capa | Tecnología |
|---|---|
| Frontend | **Next.js** (App Router) — PWA con `next-pwa` |
| Backend / API | **Next.js API Routes** o **Supabase Edge Functions** |
| Base de datos | **Supabase** (PostgreSQL gestionado) |
| Storage de imágenes | **Supabase Storage** |
| Autenticación | **Supabase Auth** |
| IA (descripción y looks) | **Gemini 2.5 Flash-Lite con visión nativa** (o modelo compatible OpenAI-API barato) — llamado siempre desde backend, nunca desde cliente |
| Clima | API pública gratuita (ej: Open-Meteo) — llamado desde backend |
| Deploy | **Vercel** (frontend + API routes) — free tier |
| i18n | `next-intl` — español por defecto, arquitectura multiidioma desde el día 1 |
| CI/CD | GitHub Actions → Vercel |

### Principios de arquitectura
- **Costo nulo o casi nulo** en etapa inicial (Vercel free + Supabase free tier)
- **Escalable**: estructura lista para agregar usuarios pagos, planes, features sin migración de datos
- **Sin secretos en cliente**: todas las llamadas a APIs externas (IA, clima) pasan por el backend
- **Schema flexible**: usar JSONB en PostgreSQL para atributos extendibles de prendas y preferencias de usuario, evitando migraciones ante nuevos campos
- **Backups**: Supabase incluye backups automáticos en su plan gratuito; documentar estrategia de backup desde el inicio
- **Mantenibilidad**: convenciones de código, estructura de carpetas y naming bien definidos desde el inicio

---

## Cómo trabajaremos

1. Me vas a hacer **preguntas una por una** para clarificar cada épica o historia antes de escribirla
2. Una vez que tengamos suficiente información, generás la historia en formato Markdown
3. Las historias se guardan como archivos `.md` en la carpeta `/docs/stories/` del proyecto
4. Al final de la sesión, creamos todas las épicas e historias también en **Jira** usando el MCP de Jira conectado a mi cuenta

---

## Formato de historias de usuario

Cada historia debe seguir este formato exacto en Markdown:

```markdown
# [ÉPICA-XX] Título de la Historia

**ID:** LOOKSI-XXX  
**Épica:** [Nombre de la épica]  
**Prioridad:** Alta / Media / Baja  
**Estimación:** X puntos  
**Estado:** Pendiente

---

## Descripción

Como **[rol]**, quiero **[acción]** para **[beneficio]**.

---

## Criterios de aceptación

### Escenario 1: [Nombre del escenario]
- **Dado** que [precondición]
- **Cuando** [acción del usuario]
- **Entonces** [resultado esperado]

### Escenario 2: [Nombre del escenario]
- **Dado** que [precondición]
- **Cuando** [acción del usuario]
- **Entonces** [resultado esperado]

_(Repetir para todos los escenarios relevantes)_

---

## Notas técnicas

- [Consideraciones de implementación relevantes]
- [Restricciones de arquitectura que apliquen]
- [Referencias a otros componentes o historias relacionadas]

---

## Dependencias

- [LOOKSI-XXX] Nombre de historia dependiente (si aplica)
```

---

## Épicas del MVP (punto de partida)

Estas son las épicas tentativas. Podés sugerirme agregar, dividir o renombrar alguna durante la sesión:

| ID | Épica |
|---|---|
| EP-01 | Autenticación y gestión de cuenta |
| EP-02 | Gestión del guardarropas (CRUD de prendas) |
| EP-03 | Análisis de prendas con IA |
| EP-04 | Generación de looks con IA |
| EP-05 | Integración de clima |
| EP-06 | Preferencias y configuración del usuario |
| EP-07 | Infraestructura y arquitectura base |

---

## Reglas generales

- **Nunca** generes historias que asuman lógica de IA en el frontend
- Cada historia debe ser **independiente y testeable** por sí sola
- Si una historia es muy grande, proponé dividirla antes de escribirla
- Las historias técnicas (infraestructura, setup) también siguen el mismo formato
- El idioma de la app es **español** pero toda la arquitectura debe soportar i18n desde el inicio
- Pensá siempre en el escenario de **1–2 usuarios iniciales escalando a N usuarios** sin rediseño

---

## Inicio de sesión

Empezá presentándote brevemente, confirmá que entendiste el contexto de LookSi y la forma de trabajo, y luego **preguntame por la primera épica (EP-01: Autenticación)** para arrancar.
