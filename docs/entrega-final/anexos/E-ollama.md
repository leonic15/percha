# Anexo E — IA local con Ollama

> Entregable **opcional** de la Parte 2 de la consigna: instalar Ollama, correr un modelo y mostrar una captura de la terminal respondiendo una pregunta relacionada con el proyecto.
>
> **Estado: pendiente de iteración.** Ollama **no está instalado** en el equipo al momento de redactar este informe (`which ollama` → no encontrado). Este anexo deja todo listo para ejecutarlo.

---

## E.1 · Instalación

```bash
brew install ollama
```

Levantar el servicio:

```bash
brew services start ollama
```

Verificar:

```bash
ollama --version
```

---

## E.2 · Modelo elegido

**`llama3.2:3b`** — 3B de parámetros, ~2 GB en cuantización de 4 bits.

**Por qué este y no otro:**

| Alternativa | Descartada porque |
|---|---|
| `llama3.2:1b` | Demasiado chico para razonamiento de composición; en español rinde mal. |
| `phi3:mini` (3.8B) | Buen razonamiento, pero su español es notoriamente peor que el de Llama 3.2 — y el tono en rioplatense es una decisión de producto de Percha. |
| `gemma2:9b` | Mejor calidad, pero ~6 GB de RAM. Sirve para probar en la notebook, no representa el escenario realista de despliegue. |
| `llava-phi3` / `moondream2` | Son los candidatos **reales** para el caso de uso del validador de imagen (visión). Vale correr uno de estos también si se quiere demostrar el reemplazo concreto que propone la Parte 2. |

```bash
ollama pull llama3.2:3b
```

---

## E.3 · La pregunta

La pregunta debe ser **la tarea real que el modelo local reemplazaría** en Percha, no una pregunta genérica. Se le pide exactamente lo que hoy hace el agente estilista: elegir prendas de un inventario cerrado y devolver JSON.

```bash
ollama run llama3.2:3b 'Sos una estilista experta. Armá un look para una cena informal con amigos, 14°C, nublado, para un hombre.

GUARDARROPAS DISPONIBLE:
ID:p1 | Jean azul oscuro (Pantalones, azul)
ID:p2 | Remera blanca lisa (Remeras, blanco)
ID:p3 | Camisa de jean celeste (Camisas, celeste)
ID:p4 | Campera de cuero negra (Abrigos, negro)
ID:p5 | Zapatillas blancas (Calzado, blanco)
ID:p6 | Buzo gris con capucha (Buzos, gris)
ID:p7 | Pantalón de vestir gris (Pantalones, gris)
ID:p8 | Botas marrones (Calzado, marrón)

REGLAS:
1. Elegí entre 2 y 6 prendas de la lista. Usá los IDs exactos.
2. Incluí SIEMPRE una prenda de parte inferior.
3. Si elegís abrigo exterior, incluí también una prenda base debajo.
4. NO incluyas 2 prendas del mismo grupo (no 2 pantalones, no 2 calzados).

Respondé ÚNICAMENTE con JSON válido:
{"nombre_sugerido":"...","descripcion_look":"...","prendas":["id1","id2"]}'
```

---

## E.4 · Captura y resultado

**Captura de terminal:** `docs/entrega-final/capturas/11-ollama.png` — `[PENDIENTE]`

Para capturar también la salida en texto:

```bash
ollama run llama3.2:3b '<el prompt de arriba>' | tee docs/entrega-final/anexos/ollama-salida.txt
```

**Respuesta del modelo:**

```json
[PEGAR AQUÍ — salida cruda, sin editar]
```

**Una línea explicando qué se le preguntó y qué respondió** (requisito literal de la consigna):

> `[PEGAR AQUÍ]` — Ejemplo de la forma esperada: *"Se le pidió a llama3.2:3b, corriendo 100 % local, que armara un look para una cena informal a 14 °C eligiendo de un inventario cerrado de 8 prendas y devolviendo JSON. Respondió con [N] prendas: [detalle]."*

---

## E.5 · Evaluación del resultado

Completar tras la ejecución. Estos son los mismos controles que la Sección 6 aplica sobre Gemini, así que la comparación es directa y no anecdótica.

| Control | Gemini 2.5 Flash-Lite (producción) | llama3.2:3b (local) |
|---|---|---|
| Devolvió JSON parseable sin texto extra | Sí (con extracción por regex como red) | `[ ]` |
| Todos los IDs existen en el inventario | Sí tras la validación por intersección | `[ ]` |
| Incluyó prenda de parte inferior | Sí | `[ ]` |
| Evitó dos prendas del mismo grupo | Sí | `[ ]` |
| Abrigo con prenda base debajo | Sí | `[ ]` |
| Calidad del español (rioplatense vs neutro/traducido) | Rioplatense correcto | `[ ]` |
| Latencia | ~3-6 s (incluye red) | `[ ]` |
| Costo por llamada | Por token | **0** |
| Privacidad | Los datos salen a Google | **No salen del equipo** |

**Conclusión a redactar tras la prueba:** `[PENDIENTE]`

> La hipótesis declarada en la Parte 2 del informe es que un SLM de 3-4B rinde comparable en las tareas **estructuradas** (clasificar, validar, filtrar) y se degrada en **razonamiento estético** y en **calidad del español rioplatense**. Esta prueba sirve para confirmarla o corregirla con evidencia propia — que es exactamente lo que la consigna pide como "criterio propio".

---

## E.6 · Prueba complementaria sugerida (visión)

El reemplazo más concreto que propone la Parte 2 es el **agente validador de imagen**. Para demostrarlo:

```bash
ollama pull moondream
ollama run moondream '¿Esta imagen es una prenda de ropa? Respondé solo "si" o "no" y el motivo en 5 palabras.' --image ./ruta/a/foto-de-prenda.jpg
```

Probar con dos imágenes: una prenda real y algo que no lo sea (una pared, una mascota). Si el modelo local acierta ambas, queda demostrado que esa llamada a Gemini —la más frecuente y la de menor exigencia del sistema— es reemplazable sin pérdida de calidad, que es el argumento central de la respuesta a la pregunta 1 de la Parte 2.
