# Anexo B — Heurísticas de Nielsen extendidas

> Versión extendida de la Sección 5.1 del [informe principal](../informe-principal.md), con la evidencia de código de cada evaluación.
> **Resultado global: 7 cumplidas · 3 parciales · 0 incumplidas.**

---

## 1. Visibilidad del estado del sistema — ✅ Cumple

**Principio:** el sistema debe mantener al usuario informado sobre lo que está pasando, con retroalimentación apropiada y en tiempo razonable.

**Por qué es crítico en este producto:** todas las operaciones de valor de Percha son llamadas a un modelo de IA que tardan entre 3 y 45 segundos. Sin feedback de estado, el usuario asume que la app se colgó y la cierra.

| Evidencia | Ubicación |
|---|---|
| Overlay de escaneo animado con pasos de progreso reales durante el análisis de prenda | `app/[locale]/(app)/guardarropas/nueva/analizar/page.tsx` |
| Overlay dedicado con dots animados para la generación de imagen | `components/features/generator/VestirGeneratingOverlay` |
| Spinner con mensajes rotativos durante la generación de look | `components/features/generator/GeneratorConfigClient.tsx` |
| Toggle de favorito **optimista con revert visible** si el servidor rechaza | `components/features/wardrobe/GarmentDetailClient.tsx` |
| Dashboard de consumo de IA: barras de uso contra el límite diario, por tipo de operación | `/perfil` → `GET /api/perfil/uso-ia` |
| Sistema de toasts global (`success` / `error` / `warning` / `info`) | `components/ui/Toast.tsx` |
| Pantalla de carga con wordmark durante la navegación | `app/[locale]/loading.tsx` |
| Widget de clima que muestra el dato real de la ubicación del usuario, no un placeholder | `components/features/generator/GeneratorConfigClient.tsx` |

**Observación:** el dashboard de consumo de IA es el caso más interesante. No es un patrón habitual mostrarle al usuario final su cuota de uso de IA, pero en un producto donde el límite existe, ocultarlo hasta el momento del rechazo sería una falla de esta heurística **y** de la n.º 5.

---

## 2. Coincidencia entre el sistema y el mundo real — ✅ Cumple

**Principio:** el sistema debe hablar el lenguaje del usuario, con palabras y conceptos que le sean familiares.

| Evidencia | Detalle |
|---|---|
| Vocabulario del dominio, no del software | "guardarropas", "prendas", "looks", "ocasión", "temporada", "estilo". **Nunca** aparece "modelo", "prompt", "token", "inferencia", "endpoint" ni "API". |
| Adaptación de género en el lenguaje de la IA | El prompt del estilista recibe el género del perfil con instrucción explícita: terminología masculina ("remera, pantalón, campera") o femenina ("blusa, vestido, saco"), o neutra si no está declarado. — `app/api/looks/generar/route.ts` |
| Español rioplatense por defecto | Voseo consistente en toda la interfaz: "Probá de nuevo", "Volvé mañana", "No tenés prendas en tu guardarropas". |
| Metadatos en formato humano | Fechas como `DD·MMM·YY`, temperatura en °C, "Agregada" / "Último uso" en lugar de `created_at` / `last_used`. |
| La IA escribe como estilista, no como sistema | El prompt pide explícitamente "2-3 oraciones en español, estilo estilista, explicando por qué estas prendas funcionan juntas". |
| Metáfora física consistente | El nombre del producto (Percha), la organización por categorías de ropa real, la disposición del look como un outfit y no como una lista. |

---

## 3. Control y libertad del usuario — ✅ Cumple

**Principio:** los usuarios necesitan una "salida de emergencia" claramente marcada, con deshacer y rehacer.

**Por qué es crítico en este producto:** cuando una IA toma una decisión por el usuario, la libertad de rechazarla es lo que separa una herramienta de una imposición.

| Evidencia | Detalle |
|---|---|
| **Rechazar el look completo** | Botón "Otro" que regenera. Las prendas descartadas viajan en `prendas_excluidas` para que el siguiente intento no las repita. |
| **Rechazar una sola pieza** | `POST /api/looks/cambiar-prenda` reemplaza una prenda **sin tocar el resto del look**. El usuario no paga la corrección con la pérdida de lo que sí le gustaba. |
| **Corregir a la IA antes de persistir** | Todos los atributos propuestos por el analista son editables en el paso 3. Nada se guarda sin confirmación humana. |
| **Eliminación no destructiva** | Soft delete vía `deleted_at`. La prenda desaparece del guardarropas pero el historial de looks queda íntegro. |
| **Commit / descarte explícito en filtros** | El bottom sheet de filtros usa estado pendiente: los cambios no se aplican hasta confirmar, y se descartan al cerrar. — `WardrobeClient.tsx` |
| **Confirmación de acciones destructivas** | Bottom sheet de confirmación antes de eliminar una prenda. |
| **Navegación siempre disponible** | Barra flotante con "atrás" en el detalle de prenda; bottom nav y sidebar presentes en toda la aplicación. |
| **Optar por no dar datos** | El clima es opcional (`clima_habilitado` en el perfil) y se puede configurar la ciudad manualmente en lugar de dar geolocalización. La foto corporal es opcional: sin ella, "vestir mi look" queda deshabilitado con explicación, pero el resto de la app funciona igual. |

---

## 4. Consistencia y estándares — ✅ Cumple

**Principio:** los usuarios no deberían tener que preguntarse si palabras, situaciones o acciones diferentes significan lo mismo.

| Evidencia | Detalle |
|---|---|
| **Design system con fuente única de verdad** | Tokens declarados en `@theme {}` de `app/globals.css`. No hay `tailwind.config.js`. Una sola escala tipográfica (`--text-sm: 12px`, `--text-base: 14px`), un radio de botón (`--radius-button: 9999px`, pill), una sombra de card, un color de acento (`--color-accent: #6b7563`). |
| **Diseño derivado de un prototipo autoritativo** | Las 16 pantallas se especificaron en `docs/design/Handoff.html` **antes** de escribir componentes, lo que evitó divergencias entre pantallas construidas en momentos distintos. |
| **Animaciones consistentes** | Todos los bottom sheets entran con slide-up de 280 ms. |
| **Navegación consistente por plataforma** | Bottom nav fija en mobile, sidebar de 240 px en desktop, en todas las pantallas autenticadas. |
| **Patrones de plataforma respetados** | Bottom sheets en lugar de modales centrados en mobile; FAB en la posición canónica de Material (abajo a la derecha); PWA instalable con manifest e íconos. |
| **Consistencia de la marca de IA** | El componente `AIBadge` es el mismo en el detalle de prenda, en el formulario de alta y en el resultado del generador. La IA se señaliza siempre igual. |
| **Consistencia de las respuestas de error** | Todas las rutas devuelven `{error: "codigo", message: "texto humano"}` con el mismo esquema. |

---

## 5. Prevención de errores — ✅ Cumple

**Principio:** mejor que un buen mensaje de error es un diseño que impide que el error ocurra.

**Es el área donde más se invirtió**, porque en un producto con IA los errores son de dos clases: los del usuario y los del modelo. Se previenen ambas.

### Prevención de errores del usuario

| Evidencia | Detalle |
|---|---|
| **Agente validador de imagen** (`PERCHA-036`) | Antes de gastar la llamada cara de análisis, un agente verifica que la foto sea realmente una prenda (o una persona de cuerpo entero, según el caso). **Bloquea** los casos claros y **advierte sin bloquear** los dudosos. Surgió directamente de una prueba con usuario real. — `app/api/validar-imagen/route.ts` |
| **Compresión y validación de tamaño previas a la subida** | `browser-image-compression` en el cliente; validación de tamaño server-side antes de bufferizar (hallazgos H-06 y H-07). |
| **Validación de extensión y contenido real del archivo** | No se confía solo en el MIME declarado por el cliente (hallazgo H-17). |
| **Confirmación de acciones destructivas** | Bottom sheet antes de eliminar. |
| **Límites comunicados por adelantado** | El dashboard de consumo de IA muestra cuánto queda **antes** de chocar contra el límite. |
| **Estados deshabilitados con explicación** | "Vestir mi look" aparece deshabilitado con el motivo cuando falta la foto corporal, en lugar de fallar al intentarlo. |
| **Validación de payloads con Zod** | En el borde de cada API Route. |

### Prevención de errores del modelo

| Evidencia | Detalle |
|---|---|
| **Reglas de composición explícitas en el prompt** | Parte inferior obligatoria; abrigo exterior siempre con prenda base debajo; prohibición de dos prendas del mismo grupo (no dos pantalones, no dos calzados). Surgieron de fallas reales observadas. |
| **Shuffle Fisher-Yates del inventario** | Neutraliza el sesgo posicional del LLM, que tendía a elegir siempre las primeras prendas de la lista. |
| **Sección de prendas usadas recientemente** | El prompt instruye a no repetir las prendas de los últimos 5 looks. |
| **Validación por intersección de IDs** | Todo ID de prenda devuelto por el modelo se contrasta contra el inventario real; los inventados se descartan. |
| **Timeouts con `AbortController`** | 5 s validación · 15 s cambio de prenda · 20 s generación de look · 45 s planificación de viaje. |
| **Rate limiting previo a la llamada** | `checkAiRateLimit()` corre **antes** de gastar el presupuesto. |

---

## 6. Reconocimiento antes que recuerdo — ✅ Cumple

**Principio:** minimizar la carga de memoria del usuario haciendo visibles los objetos, acciones y opciones.

| Evidencia | Detalle |
|---|---|
| **Ocasiones y categorías como chips visibles** | El usuario elige de una lista, no escribe ni recuerda las opciones válidas. |
| **Paleta de 12 colores como muestras** | En lugar de un campo de texto o un selector hexadecimal. |
| **Picker de prenda base como grilla de fotos con búsqueda** | El usuario reconoce su prenda visualmente; no necesita recordar cómo la nombró. |
| **Formulario pre-llenado tras el análisis** | El usuario reconoce y corrige, no completa desde cero. |
| **Metadatos de contexto en el detalle** | "Agregada" y "Último uso" evitan que el usuario tenga que recordar cuándo la sumó o la usó. |
| **Filtros activos visibles** | La sub-barra del guardarropas muestra qué filtros están aplicados; el usuario no necesita abrir el sheet para saberlo. |
| **Bloque "Usado en looks" en el detalle de prenda** | Muestra el historial de esa prenda sin exigir memoria. |
| **Prendas faltantes explicitadas** | Cuando el look está incompleto, el sistema dice qué falta ("Calzado marrón o negro") en lugar de dejar al usuario deducirlo. |

---

## 7. Flexibilidad y eficiencia de uso — ⚠️ Parcial

**Principio:** aceleradores invisibles para el usuario novato pueden agilizar la interacción del experto. El sistema debe servir a ambos.

### A favor

| Evidencia | Detalle |
|---|---|
| Dos modos de generación | "Desde cero" (la IA elige todo) y "Con base" (el usuario fija una prenda). |
| Toggle grilla / lista en el guardarropas | Dos densidades de información según preferencia. |
| Grilla responsive de 2 a 5 columnas | Aprovecha el espacio disponible en cada dispositivo. |
| PWA instalable con caché de imágenes | `StaleWhileRevalidate` sobre las fotos de prendas: en visitas repetidas el guardarropas se ve al instante. |
| Búsqueda con índice trigram | Búsqueda por nombre eficiente sobre el inventario. |
| Dos idiomas | `es` (default) / `en` vía `next-intl`. |
| Regeneración con parámetros persistidos | `parametros_generacion` permite volver a generar sin reconfigurar. |

### En contra — brechas identificadas

| Brecha | Impacto |
|---|---|
| **No hay combinaciones de filtros guardables** | Un usuario que siempre filtra "trabajo + invierno" tiene que reconstruir el filtro cada vez. |
| **No se puede repetir un look pasado con un toque** | El historial existe pero es de consulta; no hay "usar este look de nuevo". |
| **No hay carga masiva de prendas** | La carga inicial es prenda por prenda. **Es la fricción más alta del producto**: digitalizar un guardarropas de 80 prendas son 80 ciclos completos de foto → validación → análisis → revisión. |
| **No hay atajos de teclado en desktop** | La experiencia desktop es la mobile ensanchada, sin aceleradores propios. |

**Diagnóstico:** el producto está optimizado para el primer uso, no para el uso recurrente. Es una consecuencia razonable de haber priorizado tener el ciclo completo funcionando, pero la carga masiva de prendas es el ítem que más limita la adopción real, porque el valor del sistema es proporcional a cuántas prendas conoce.

---

## 8. Diseño estético y minimalista — ✅ Cumple

**Principio:** los diálogos no deben contener información irrelevante o raramente necesaria; cada unidad extra compite con las relevantes.

| Evidencia | Detalle |
|---|---|
| **Una acción primaria por pantalla** | CTA sticky de acento; el resto de acciones son secundarias y visualmente subordinadas. |
| **Jerarquía tipográfica marcada** | H1 de 32-36 px contra cuerpo de 14 px. La diferencia de escala hace innecesarios los separadores. |
| **Paleta reducida** | Crema de fondo (`#f7f5ef`), verde oliva de acento (`#6b7563`) y neutros. Sin color decorativo. |
| **La foto domina** | En el detalle de prenda, hero full-width en aspecto 1:1.15; el texto es soporte. |
| **Barra superior flotante en glass** | 38 px con blur de 8 px: la navegación no le roba espacio a la imagen. |
| **Los badges de IA desaparecen al editar** | La marca de origen se retira cuando deja de ser cierta, en vez de acumularse como ruido permanente. |
| **Chips de solo lectura en el detalle** | Muestran temporada, ocasión y estilo sin sugerir interacción que no existe. |
| **Estados vacíos con una sola acción** | El guardarropas vacío ofrece exactamente una cosa que hacer. |

---

## 9. Ayuda a reconocer, diagnosticar y recuperarse de errores — ⚠️ Parcial

**Principio:** los mensajes de error deben expresarse en lenguaje llano, indicar el problema con precisión y sugerir una solución.

### A favor

| Evidencia | Detalle |
|---|---|
| **Rate limit en lenguaje humano y accionable** | `"Alcanzaste el límite de 3 imágenes por día. Volvé mañana."` — dice qué pasó, por qué y qué hacer. No expone el 429. |
| **Ningún código de error llega a la interfaz** | Los códigos internos (`ai_timeout`, `no_garments`, `ai_quota`, `no_alternatives`) se traducen a texto antes de mostrarse. |
| **El validador explica el rechazo** | No dice "imagen inválida": dice por qué no parece una prenda. |
| **Estado vacío como diagnóstico** | `"No tenés prendas en tu guardarropas"` con la acción para resolverlo. |
| **Sin alternativas para el swap** | Devuelve 422 con explicación en lugar de un cambio sin sentido. |
| **Reintento explícito en fallos de IA** | `PERCHA-016` — reintentar análisis. |
| **Error boundaries por ruta** | `error.tsx` en generador, guardarropas, locale y `global-error.tsx`. Ninguna falla deja la pantalla en blanco. |
| **Fail-open en el validador** | Si la validación falla por infraestructura, el usuario **no** queda bloqueado por un error que no es suyo. |
| **`Retry-After` en las respuestas 429** | El cliente sabe cuándo puede volver a intentar. |

### En contra — brechas identificadas

| Brecha | Impacto |
|---|---|
| **Algunos errores de red se resuelven con un toast genérico** | El toast informa pero no ofrece reintentar en el lugar; el usuario tiene que rehacer la acción manualmente. |
| **No hay recuperación de formulario ante fallo de conexión** | Si se cae la red durante el alta de una prenda, el trabajo de revisión se pierde. La imagen está en `sessionStorage`, pero las correcciones del formulario no. |
| **Los errores no distinguen "reintentable" de "definitivo"** | Un timeout de IA (reintentar sirve) y un error de configuración (reintentar no sirve) se presentan igual. |

---

## 10. Ayuda y documentación — ⚠️ Parcial

**Principio:** aunque es mejor que el sistema se use sin documentación, puede ser necesario proveer ayuda: fácil de buscar, enfocada en la tarea, concreta.

### A favor

| Evidencia | Detalle |
|---|---|
| **Interfaz autoexplicativa por diseño** | El flujo de tres pasos para agregar una prenda es guiado y numerado ("PASO 1/2"); no requiere instrucciones. |
| **Estados vacíos como onboarding contextual** | El guardarropas vacío enseña qué hacer en el momento en que hace falta. |
| **Placeholders orientativos** | El campo de contexto libre sugiere qué escribir. |
| **Documentación de desarrollador completa** | `README` con instalación paso a paso, variables de entorno documentadas, `docs/STRUCTURE.md`, `docs/conventions.md`, `docs/database/schema.md`, ADRs y 36 historias de usuario. |

### En contra — brecha principal

| Brecha | Impacto |
|---|---|
| **No hay onboarding de primera vez** | Un usuario nuevo llega al guardarropas vacío sin haber visto qué puede hacer la app. El valor del producto (generar looks) requiere primero cargar prendas, y esa relación no se explica. |
| **No hay ayuda in-app ni FAQ** | No existe una sección de ayuda accesible desde la aplicación. |
| **No se explica al usuario qué hace la IA con sus fotos** | En un producto que sube fotos de ropa **y una foto corporal de cuerpo entero**, la ausencia de una explicación accesible sobre qué se procesa, dónde se guarda y quién lo ve es la brecha más seria de esta evaluación. La decisión técnica es sólida (buckets privados, sin datos personales a analytics, hash del `user_id`) pero **el usuario no tiene forma de saberlo**. |
| **No hay política de privacidad enlazada** | Consecuencia del punto anterior. |

**Diagnóstico:** es la heurística más débil del sistema, y la brecha de privacidad es la prioritaria. Es también la de menor costo de remediación: una pantalla de ayuda estática y un onboarding de tres pasos resolverían la mayor parte.

---

## Resumen y plan de remediación

| # | Heurística | Estado |
|---|---|---|
| 1 | Visibilidad del estado del sistema | ✅ Cumple |
| 2 | Coincidencia con el mundo real | ✅ Cumple |
| 3 | Control y libertad del usuario | ✅ Cumple |
| 4 | Consistencia y estándares | ✅ Cumple |
| 5 | Prevención de errores | ✅ Cumple |
| 6 | Reconocimiento sobre recuerdo | ✅ Cumple |
| 7 | Flexibilidad y eficiencia | ⚠️ Parcial |
| 8 | Diseño estético y minimalista | ✅ Cumple |
| 9 | Recuperación de errores | ⚠️ Parcial |
| 10 | Ayuda y documentación | ⚠️ Parcial |

**Prioridades para la próxima iteración, por relación impacto/costo:**

1. **Pantalla de privacidad y ayuda in-app** (heurística 10) — resuelve la brecha más seria, costo bajo.
2. **Onboarding de primera vez** (heurística 10) — conecta "cargar prendas" con "generar looks", que hoy el usuario tiene que deducir.
3. **Carga masiva de prendas** (heurística 7) — es la fricción que más limita la adopción real.
4. **Reintento en el lugar y persistencia del formulario** (heurística 9) — costo bajo, evita pérdida de trabajo.
5. **Repetir un look pasado y filtros guardables** (heurística 7) — aceleradores para el usuario recurrente.
