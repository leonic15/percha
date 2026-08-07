# Anexo D — Guion del video de demostración

> Requisito: máximo 3 minutos, mostrando el **ciclo completo de uso real**.
> **Estado: pendiente de grabación.**

---

## Reglas de grabación

| Ítem | Decisión |
|---|---|
| Dispositivo | **Celular real con la PWA instalada**, grabación de pantalla nativa. Percha es mobile-first; grabarlo en desktop desdibuja el producto. |
| Datos | **Guardarropas real, mínimo 15 prendas.** Nada de seed ni datos de prueba — la consigna evalúa evidencia real. |
| Audio | Voz en off grabada aparte y montada. Narrar en vivo mientras se opera sale mal. |
| Cortes | Permitidos en los tiempos de espera de IA, pero **dejar ver que la IA tarda**: 2-3 segundos de overlay visible en cada llamada. Cortar toda la espera hace parecer que está simulado. |
| Lo que NO se muestra | Login (aburrido y expone datos), pantallas de configuración, código. |
| Entrega | YouTube **no listado** o Drive con link público de lectura. Verificar que abra en incógnito antes de entregar. |

---

## Guion — 3:00

### 0:00 – 0:15 · Qué es y qué problema resuelve

> "Percha es un guardarropas inteligente. Digitalizás tu ropa una vez, y la IA te arma looks con lo que **realmente tenés**, según el clima y la ocasión."

**En pantalla:** app abierta en el guardarropas, scroll lento por la grilla de prendas reales. Se ve el contador de prendas.

---

### 0:15 – 1:00 · Ciclo de ingesta — sumar una prenda

> "Sumar una prenda es sacarle una foto. Antes de gastar una llamada cara, un primer agente valida que sea realmente una prenda."

**En pantalla:** FAB → cámara → foto de una prenda real.

> "Después la IA la analiza y clasifica sola: categoría, color, temporadas, ocasiones, estilo y una descripción."

**En pantalla:** overlay de escaneo con los pasos de progreso. **Dejar correr 2-3 segundos.**

> "El formulario llega pre-llenado. Los campos que propuso la IA están marcados — y la marca desaparece apenas los edito. Yo tengo la última palabra."

**En pantalla:** formulario con badges de IA. **Editar un campo** para que se vea desaparecer el badge. Guardar.

> **Momento clave del video.** Es donde se ve IA + control humano + diseño, todo junto.

---

### 1:00 – 2:00 · Ciclo de decisión — generar un look

> "Ahora el generador. Toma el clima real de mi ubicación, elijo la ocasión y escribo el contexto en lenguaje natural."

**En pantalla:** `/generador`, widget de clima con temperatura real. Elegir ocasión. **Tipear un contexto real** (ej: "cena con amigos, hace fresco a la noche").

> "El agente estilista recibe mi inventario completo, mi perfil y los últimos looks que usé, y arma un outfit solo con prendas que tengo."

**En pantalla:** spinner. **Dejar correr.** Aparece el resultado: nombre del look, descripción del estilista, prendas.

> "Y me explica por qué esas prendas funcionan juntas."

**En pantalla:** zoom sobre la descripción generada.

> "Si algo no me convence, cambio esa sola pieza sin perder el resto del look."

**En pantalla:** swap de una prenda. Se ve el resultado nuevo.

> "También detecta lo que me falta para completarlo."

**En pantalla:** bloque de prendas faltantes, si aparece.

---

### 2:00 – 2:30 · Cierre del ciclo — vestir y guardar

> "Puedo ver cómo me queda puesto: a partir de mi foto de perfil, genera la imagen del look."

**En pantalla:** "Vestir mi look" → escenario → overlay → imagen generada.

> "Guardo el look, y cuando lo uso lo marco. Ese historial vuelve al generador: la próxima vez evita repetirme las mismas prendas."

**En pantalla:** guardar → `/looks` → marcar como usado.

> **Es el punto que cierra el argumento del ciclo cíclico.** No omitirlo.

---

### 2:30 – 3:00 · Control de costos y cierre

> "Cada operación de IA queda registrada. Acá veo mi consumo real contra el límite diario — el mismo dato que el sistema usa para frenar el abuso antes de gastar."

**En pantalla:** `/perfil` → dashboard de consumo de IA con las barras.

> "Y si viajo, el planificador me arma todos los looks del viaje de una sola vez."

**En pantalla:** flash rápido del planificador de viajes con looks generados.

> "Percha. Seis agentes de IA, memoria persistente en Postgres, y una capa determinista que valida todo lo que el modelo devuelve."

**En pantalla:** volver al guardarropas. Fin.

---

## Checklist antes de subir

- [ ] Duración ≤ 3:00
- [ ] Grabado en celular con la PWA instalada
- [ ] Guardarropas con prendas reales (≥ 15)
- [ ] Se ve la IA trabajando en los 3 flujos (análisis, generación, imagen)
- [ ] Se ve el output de IA legible (descripción del look)
- [ ] Se ve el control humano (editar un campo pre-llenado por IA)
- [ ] Se ve el ciclo cerrado (marcar como usado)
- [ ] Se ve el dashboard de consumo
- [ ] Sin datos personales visibles (email, nombre real, ubicación exacta)
- [ ] Link probado en ventana de incógnito
