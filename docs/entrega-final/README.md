# Entrega final — Percha

**Inteligencia Artificial Aplicada a Organizaciones** · UTN FRBA
Autor: Leonardo Blanco

---

## Documentos

| Documento | Contenido |
|---|---|
| **[Informe principal](informe-principal.md)** | El entregable. Parte 1 (secciones 1 a 7) + Parte 2 (IA local). Se exporta a PDF de 10-20 páginas. |
| [Checklist de entrega](CHECKLIST-ENTREGA.md) | Qué falta publicar antes de entregar, ordenado por riesgo |

## Anexos

| Anexo | Contenido |
|---|---|
| [A — Diagramas completos](anexos/A-diagramas.md) | Modelo de datos (ER), secuencias de ingesta / OAuth / generación de imagen, capas, mapa de los 33 endpoints |
| [B — Heurísticas de Nielsen](anexos/B-heuristicas-nielsen.md) | Las 10 heurísticas con evidencia de código y plan de remediación |
| [C — Log de sesión real](anexos/C-log-sesion-real.md) | Protocolo de captura + traza completa de una generación de look |
| [D — Guion del video](anexos/D-guion-video.md) | Guion de 3 minutos con tiempos y checklist de grabación |
| [E — IA local con Ollama](anexos/E-ollama.md) | Instalación, modelo, prompt y tabla comparativa contra Gemini |

## Documentación del repositorio referenciada

| Documento | Contenido |
|---|---|
| [Auditoría de seguridad y performance](../auditoria-seguridad-performance.md) | 17 hallazgos (3 críticos, 7 medios, 7 bajos), todos remediados |
| [Diagrama de arquitectura](../architecture/diagrama-arquitectura.md) | Arquitectura general y flujos en Mermaid |
| [Schema de base de datos](../database/schema.md) | Tablas, columnas, RLS e índices |
| [Historias de usuario](../stories/) | PERCHA-001 a PERCHA-036 |

---

## Cobertura de la consigna

| Requisito | Dónde está | Estado |
|---|---|---|
| Links obligatorios (primera página) | Informe § encabezado | ⬜ Pendiente publicar |
| 1 · Equipo, proyecto, problema, público | Informe §1 | ✅ |
| 2 · Diagrama de arquitectura | Informe §2.1 | ✅ |
| 2 · Diagrama de flujo de agentes | Informe §2.2 | ✅ |
| 2 · UML (secuencia + casos de uso + clases) | Informe §2.3, §2.4 · Anexo A.1 | ✅ Los tres |
| 3 · Tabla de stack con justificación | Informe §3 | ✅ |
| 4 · Capturas (mín. 3) | Informe §4.1 · `capturas/` | ⬜ Pendiente capturar |
| 4 · Video demo (opcional) | Anexo D | ⬜ Pendiente grabar |
| 4 · Log de sesión real | Informe §4.3 · Anexo C | ⬜ Pendiente capturar |
| 5.1 · Heurísticas de Nielsen (mín. 5) | Informe §5.1 · Anexo B | ✅ Las 10 |
| 5.2 · Evaluación por público objetivo | Informe §5.2 | ✅ Con feedback de usuario real |
| 6 · Log de ciberseguridad (mín. 4 riesgos) | Informe §6 | ✅ 16 riesgos |
| 7 · IAs usadas en el co-work + reflexión | Informe §7 | ✅ |
| Parte 2 · Las 4 preguntas | Informe Parte 2 | ✅ |
| Parte 2 · Evidencia Ollama (opcional) | Anexo E | ⬜ Pendiente iterar |

**Criterios de evaluación cubiertos:** 70 % completo (arquitectura 20 %, UX/UI 20 %, ciberseguridad 10 %, Parte 2 20 %). El 30 % restante —app funcionando y demostrable— depende de publicar el deploy y capturar la evidencia. Ver el [checklist](CHECKLIST-ENTREGA.md).
