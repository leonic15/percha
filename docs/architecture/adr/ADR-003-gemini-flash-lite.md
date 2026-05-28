# ADR-003 — Elección de Gemini 2.5 Flash-Lite como modelo de IA

**Fecha:** 2026-05-01  
**Estado:** Aceptado  
**Historia relacionada:** LOOKSI-009 (Agregar prenda), LOOKSI-017 (Generar look)

---

## Contexto

LookSi usa IA para dos casos de uso:

1. **Análisis de prendas**: recibe una foto y devuelve nombre, categoría, color, temporadas, estilos y una descripción en lenguaje natural.
2. **Generación de looks**: recibe el guardarropa completo del usuario (metadatos, sin imágenes) + contexto (clima, ocasión) y sugiere combinaciones.

Requisitos para el modelo:
- Soporte **multimodal** (texto + imagen) para el análisis de prendas
- **Respuesta rápida** (< 5 segundos por llamada) para no bloquear el flujo de usuario
- **JSON estructurado** en la respuesta para parsear sin fricciones
- **Costo bajo**: el MVP se ejecuta en free tier — minimizar gasto por token
- Disponible vía **REST API** para llamar desde Next.js API Routes sin SDK pesado

Las alternativas consideradas:

1. **Gemini 2.5 Flash-Lite** — modelo multimodal rápido y económico de Google AI
2. **Gemini 2.5 Flash** — versión más potente de Gemini Flash; mayor costo por token
3. **GPT-4o mini** (OpenAI) — multimodal, costo competitivo; requiere cuenta OpenAI y tiene peores cuotas de free tier
4. **Claude Haiku 3.5** (Anthropic) — rápido y económico; multimodal; sin free tier generoso
5. **LLaVA / modelos open-source** — requieren infraestructura propia (GPU) incompatible con Vercel free tier

---

## Decisión

Se eligió **Gemini 2.5 Flash-Lite** con llamadas directas a la REST API de Google AI (sin SDK oficial de Node.js para minimizar el tamaño del bundle).

---

## Justificación

### A favor

- **Free tier generoso de Google AI Studio**: suficiente para el desarrollo y las primeras semanas de producción del MVP.
- **Multimodal**: acepta imagen en base64 con el prompt — el análisis de prendas envía la foto directamente sin necesidad de subir a storage previamente.
- **Velocidad**: Flash-Lite está optimizado para latencia baja. El análisis de prenda completa en < 3 segundos en condiciones normales.
- **Respuesta en JSON**: soporta `response_mime_type: "application/json"` — el output es JSON parseado directamente sin procesamiento adicional.
- **Sin SDK pesado**: llamada REST pura con `fetch()`. El `GEMINI_API_KEY` nunca sale del servidor.
- **Integración con `ai_usage`**: la respuesta incluye `usageMetadata.totalTokenCount` para loggear el costo estimado en la tabla `ai_usage`.

### Consideraciones

- **Calidad vs. Flash**: Flash-Lite puede cometer errores en prendas con colores poco comunes o categorías ambiguas. El flujo de 3 pasos (analizar → revisar → confirmar) permite al usuario corregir antes de guardar.
- **Límites de rate del free tier**: en picos de uso el free tier puede throttlear. Mitigado con el mensaje de error claro en el UI y la posibilidad de reintentar.
- **Modelo en evolución**: Gemini se actualiza frecuentemente. Los prompts están encapsulados en las API Routes (`/api/prendas/analizar` y `/api/looks/generar`) — cambiar el modelo requiere editar solo esos archivos.

---

## Consecuencias

- `GEMINI_API_KEY` solo en variables de entorno del servidor. **Nunca** con prefijo `NEXT_PUBLIC_`.
- Las imágenes se envían como base64 en el prompt (no como URL de Storage) — el modelo no tiene acceso a URLs firmadas de Supabase.
- Cada llamada a Gemini registra en `ai_usage` el tipo, tokens y costo estimado.
- Timeout configurado en 20 segundos para generación de looks (que procesa más texto que el análisis).
- Si Gemini falla, el flujo de agregar prenda lo maneja con un error toast y permite reintentar desde el paso 2.
