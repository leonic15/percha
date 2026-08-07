# Checklist de entrega — Percha

> Qué falta para que la entrega esté completa. Ordenado por **riesgo de desaprobar**, no por esfuerzo.

---

## 🔴 Bloqueantes — sin esto no aprueba

La consigna es explícita: *"Sin links válidos y funcionales al momento de la corrección, la entrega no se aprueba"* y *"Una presentación que dice 'nuestra app hace X' pero no muestra X funcionando no aprueba la Parte 1"*.

| # | Ítem | Peso en la nota | Estado |
|---|---|---|---|
| 1 | **Repositorio público en GitHub** con el renombrado a `percha` completo | Evaluación directa del docente | ⬜ |
| 2 | **App desplegada en Vercel y funcionando** el día de la corrección | 30 % (App funcionando) | ⬜ |
| 3 | **Las 10 capturas de pantalla** en `capturas/` | 30 % (evidencia obligatoria) | ⬜ |
| 4 | **Log de sesión real** completado — Anexo C | 30 % (evidencia obligatoria) | ⬜ |
| 5 | **Tabla de links** de la primera página del informe completa y probada | Bloqueante declarado | ⬜ |

### 1 · Repositorio

- [ ] Confirmar que el renombrado a `percha` terminó (repo, remote, README, referencias internas)
- [ ] **Hacerlo público** — la consigna dice que un repo privado no aprueba
- [ ] Verificar que el `README` explique el proyecto con claridad (ya está — revisar que no quedaron menciones al nombre anterior del proyecto)
- [ ] Verificar que `.env.local` **no** esté versionado
- [ ] Actualizar la URL en la tabla de links del informe

> ✅ La **historia de commits ya cumple**: 41 commits entre el 22/05 y el 06/08, con 7 pull requests. La consigna advierte específicamente contra "un solo commit el día de la entrega".

### 2 · Deploy en producción

- [ ] Conectar el repo en Vercel
- [ ] Cargar **todas** las variables de entorno de `.env.example` en Vercel
- [ ] Configurar `NEXT_PUBLIC_APP_URL` con el dominio real de Vercel
- [ ] En Supabase → Authentication → URL Configuration: agregar `https://<dominio>/auth/callback` como Redirect URL
- [ ] Configurar Google OAuth para producción (Client ID/Secret en Supabase)
- [ ] Agregar `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` para los source maps
- [ ] **Probar el flujo completo en el dominio de producción**: registro → agregar prenda → generar look → guardar
- [ ] Verificar que la PWA se instale desde el dominio real

> ⚠️ **Es el ítem de mayor riesgo.** Vale 30 % de la nota y depende de configuración externa (Supabase, Google Cloud) que puede fallar el día antes. Hacerlo primero, no último.

### 3 · Capturas

Ver la tabla de la Sección 4.1 del informe. Guardar en `docs/entrega-final/capturas/` con los nombres ya referenciados.

- [ ] `01-guardarropas.png` · `02-agregar-captura.png` · `03-agregar-analizando.png` · `04-agregar-formulario.png`
- [ ] `05-generador-config.png` · `06-generador-resultado.png` · `07-detalle-prenda.png`
- [ ] `08-vestir-look.png` · `09-viaje.png` · `10-uso-ia.png`

Requisitos: **guardarropas real** (≥ 15 prendas), tomadas del **dominio de producción**, en celular, sin datos personales visibles.

### 4 · Log de sesión real

- [ ] Seguir el protocolo del [Anexo C](anexos/C-log-sesion-real.md) §C.0
- [ ] Completar los bloques `[PEGAR AQUÍ]`
- [ ] Anonimizar el `user_id` (hash SHA-256, primeros 8 caracteres)
- [ ] **Quitar el `logger.debug` del prompt antes de re-desplegar** — expone el inventario del usuario

---

## 🟡 Suma nota — recomendado

| # | Ítem | Peso |
|---|---|---|
| 6 | **Video demo** de 3 min | "Opcional pero suma mucho" |
| 7 | **Evidencia de Ollama** | Entregable opcional de la Parte 2 |

### 6 · Video

- [ ] Grabar según el [Anexo D](anexos/D-guion-video.md)
- [ ] Subir a YouTube (no listado) o Drive con link público
- [ ] **Probar el link en incógnito**
- [ ] Cargar la URL en la tabla de links del informe

### 7 · Ollama

- [ ] `brew install ollama && brew services start ollama`
- [ ] `ollama pull llama3.2:3b`
- [ ] Correr el prompt del [Anexo E](anexos/E-ollama.md) §E.3
- [ ] Captura → `capturas/11-ollama.png`
- [ ] Completar la tabla comparativa §E.5 y la conclusión
- [ ] Opcional: la prueba de visión con `moondream` (§E.6) — es la que demuestra el reemplazo concreto que argumenta la Parte 2

---

## 🟢 Cierre del documento

- [ ] Reemplazar `_[COMPLETAR]_` en la fecha de entrega
- [ ] Verificar que **todos** los links internos del informe funcionen en GitHub
- [ ] Verificar que los diagramas Mermaid **rendericen** en GitHub (abrirlos en el navegador)
- [ ] Exportar el informe principal a **PDF de 10 a 20 páginas**
- [ ] Verificar la extensión del PDF: si pasa de 20 páginas, mover contenido a anexos
- [ ] Los anexos van aparte (docx o PDF, sin límite de páginas)

---

## Modalidad de exposición

**10 minutos de exposición oral + 5 de preguntas.** Sugerencia de reparto:

| Tiempo | Contenido |
|---|---|
| 0:00 – 1:00 | Problema y público objetivo |
| 1:00 – 4:00 | **Demo en vivo** de la app funcionando — es lo que más pesa |
| 4:00 – 6:00 | Arquitectura: los 6 agentes, la memoria persistente, el ciclo de retroalimentación |
| 6:00 – 7:30 | Decisiones de stack: por qué Gemini Flash-Lite, por qué código propio y no LangChain |
| 7:30 – 9:00 | Seguridad: la auditoría, los 3 hallazgos críticos, y **cómo se defiende la inyección de prompt validando la salida, no la entrada** |
| 9:00 – 10:00 | Parte 2: la arquitectura híbrida local/nube y el criterio de asignación |

**Preguntas probables y dónde está la respuesta:**

| Pregunta | Respuesta |
|---|---|
| "¿Cómo evitás que la IA invente prendas?" | Intersección de los IDs devueltos contra el inventario real. Informe §6, riesgo 1. |
| "¿Qué pasa si el modelo se cae?" | Timeouts con `AbortController`, fail-open en el validador, error boundaries por ruta. Anexo B, heurística 9. |
| "¿Por qué no usaste LangChain?" | Los agentes son de un solo paso; lo que sí hacía falta (rate limit, timeouts, validación) ningún framework lo resuelve. Informe §3. |
| "¿Dónde está la memoria persistente?" | PostgreSQL con RLS — 5 memorias distintas. Informe §2.1 y Anexo A.1. |
| "¿Cuál es el ciclo agéntico?" | Diagrama de ciclo del informe §2.2: el lazo 7 → 3 (historial que penaliza repetición) y el 8 → 3 (control de costos). |
| "¿Cuánto te costó en IA?" | Tabla del Anexo C §C.4, con datos reales de `ai_usage`. |
