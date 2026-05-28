# [EP-02 / EP-06] Validación de imagen con IA al subir foto

**ID:** LOOKSI-036  
**Épica:** EP-02 — Gestión del guardarropas / EP-06 — Preferencias y configuración del usuario  
**Prioridad:** Alta  
**Estimación:** 3 puntos  
**Estado:** Completada

---

## Descripción

Como **usuario autenticado**, quiero que la app **valide automáticamente que la imagen que subí es adecuada** (una prenda cuando agrego ropa, o una foto de cuerpo completo cuando configuro mi perfil) para **evitar errores en el análisis de IA y la generación de looks**, y recibir una guía clara para retomar la foto correctamente si no cumple los requisitos.

---

## Criterios de aceptación

### Contexto A — Validación de imagen de prenda (LOOKSI-009)

#### Escenario 1: Imagen válida de prenda
- **Dado** que estoy en el Paso 1 de "Agregar prenda" y selecciono o fotografío una imagen
- **Cuando** la imagen muestra claramente una prenda de ropa (camiseta, pantalón, calzado, accesorio, etc.), aunque sea sobre una persona, en percha o sobre fondo neutro
- **Entonces** el flujo continúa normalmente al Paso 2 (análisis de IA)

#### Escenario 2: Imagen que no es una prenda — rechazada
- **Dado** que selecciono una imagen que no contiene ninguna prenda identificable (un paisaje, comida, persona sin ropa visible, texto, etc.)
- **Cuando** la validación de IA analiza la imagen
- **Entonces** el flujo se detiene en el Paso 1, veo un bottom sheet o banner de error con:
  - Mensaje: *"Esta imagen no parece mostrar una prenda de ropa."*
  - Guía breve: *"Asegurate de fotografiar la prenda sola, en percha o puesta, sobre un fondo claro."*
  - Botones: **Volver a tomar foto** / **Elegir de galería**
  - La imagen rechazada no se guarda ni se envía al paso siguiente

#### Escenario 3: Imagen dudosa (baja confianza)
- **Dado** que la IA no puede determinar con certeza si hay una prenda (confianza < umbral definido)
- **Cuando** se procesa la imagen
- **Entonces** se muestra una advertencia suave (no error bloqueante): *"¿Seguro que esta imagen muestra una prenda? Si es así, podés continuar."* con botones **Continuar de todas formas** / **Cambiar imagen**

#### Escenario 4: Error de red o fallo del servicio de validación
- **Dado** que el servicio de validación de IA falla o tarda más de 5 s
- **Cuando** ocurre el error
- **Entonces** se muestra un aviso breve y el flujo continúa sin bloquear al usuario (fail-open)

---

### Contexto B — Validación de foto corporal de perfil (LOOKSI-034)

#### Escenario 5: Foto válida — cuerpo completo de frente
- **Dado** que estoy en Configuración / Perfil, sección "Foto de referencia", y selecciono o fotografío una imagen
- **Cuando** la imagen cumple los requisitos: muestra una persona de cuerpo completo (cabeza a pies), de frente, con fondo claro o neutro, sin objetos que obstruyan la silueta
- **Entonces** la foto se acepta, se previsualiza y se sube a Supabase Storage

#### Escenario 6: Foto que no muestra una persona — rechazada
- **Dado** que selecciono una imagen que no muestra ninguna persona (objeto, paisaje, mascota, etc.)
- **Cuando** la validación de IA analiza la imagen
- **Entonces** el flujo se detiene, veo un error con:
  - Mensaje: *"Esta imagen no parece mostrar una persona."*
  - Guía: *"Usá una foto de cuerpo entero, de frente, para que podamos generar looks que te queden bien."*
  - Botones: **Volver a tomar foto** / **Elegir de galería**

#### Escenario 7: Foto sin cuerpo completo visible
- **Dado** que la foto muestra solo el rostro, torso u otra parte del cuerpo (no cuerpo completo de pies a cabeza)
- **Cuando** la IA detecta que la silueta está incompleta
- **Entonces** se muestra un error descriptivo:
  - Mensaje: *"La foto debe mostrar tu cuerpo completo, de la cabeza a los pies."*
  - Guía visual: checklist de requisitos (✓ Cuerpo completo, ✓ Fondo claro, ✓ De frente, ✓ Sin objetos que obstruyan)
  - Botones: **Retomar foto** / **Elegir otra**

#### Escenario 8: Foto con fondo muy cargado u objetos que obstruyen
- **Dado** que la foto tiene un fondo complejo (multitud, habitación desordenada) o la silueta está parcialmente obstruida
- **Cuando** la IA lo detecta
- **Entonces** se muestra una advertencia no bloqueante: *"Tu foto tiene un fondo complejo. Podés continuar, pero los resultados de 'Vestir mi look' podrían ser menos precisos."* con opción de **Cambiar foto** o **Continuar de todas formas**

#### Escenario 9: Error de red o fallo del servicio de validación (foto corporal)
- **Dado** que el servicio de validación falla
- **Cuando** ocurre el error
- **Entonces** se muestra una advertencia y el flujo continúa (fail-open), igual que el Escenario 4

---

## Notas técnicas

### Endpoint de validación compartido

- Crear `POST /api/validar-imagen` que recibe:
  ```json
  { "tipo": "prenda" | "foto_corporal", "imagen": "<base64 o URL firmada>" }
  ```
- Responde:
  ```json
  {
    "valida": true | false,
    "confianza": 0.0–1.0,
    "motivo": "sin_prenda" | "sin_persona" | "cuerpo_parcial" | "fondo_complejo" | "ok",
    "mensaje": "Texto descriptivo para mostrar al usuario"
  }
  ```

### Prompt para validación de prenda (Gemini 2.5 Flash-Lite)

```
Analiza esta imagen y determina si muestra una prenda de ropa o accesorio de moda (incluyendo ropa puesta en una persona, en percha, doblada o sobre fondo neutro).

Responde con un JSON estricto:
{
  "es_prenda": boolean,
  "confianza": number (0.0–1.0),
  "motivo": "prenda_visible" | "sin_prenda" | "imagen_ambigua"
}

No incluyas texto fuera del JSON.
```

### Prompt para validación de foto corporal (Gemini 2.5 Flash-Lite)

```
Analiza esta imagen y determina si muestra una persona de cuerpo completo (de la cabeza hasta los pies) de frente, apta para generar imágenes de moda virtual.

Evalúa:
1. ¿Aparece al menos una persona? (true/false)
2. ¿Se ve el cuerpo completo de pies a cabeza? (true/false)
3. ¿La pose es aproximadamente de frente? (true/false)
4. ¿El fondo es claro/neutro o hay elementos que obstruyen la silueta? ("limpio" | "cargado")

Responde con un JSON estricto:
{
  "hay_persona": boolean,
  "cuerpo_completo": boolean,
  "de_frente": boolean,
  "fondo": "limpio" | "cargado",
  "confianza": number (0.0–1.0)
}

No incluyas texto fuera del JSON.
```

### Lógica de decisión

| Tipo | Condición | Resultado |
|---|---|---|
| `prenda` | `es_prenda: true` + confianza ≥ 0.7 | ✅ Válida |
| `prenda` | `es_prenda: true` + confianza 0.4–0.69 | ⚠️ Advertencia no bloqueante |
| `prenda` | `es_prenda: false` o confianza < 0.4 | ❌ Error bloqueante |
| `foto_corporal` | `hay_persona: true` + `cuerpo_completo: true` + `de_frente: true` | ✅ Válida |
| `foto_corporal` | `hay_persona: true` + `cuerpo_completo: true` + `fondo: "cargado"` | ⚠️ Advertencia no bloqueante |
| `foto_corporal` | `hay_persona: false` | ❌ "No se detectó una persona" |
| `foto_corporal` | `hay_persona: true` + `cuerpo_completo: false` | ❌ "Foto debe mostrar cuerpo completo" |
| Cualquiera | Timeout > 5 s o error de red | ⚠️ Fail-open, continúa sin bloquear |

### Integración en el flujo existente

**Para prendas (LOOKSI-009):**
- La validación ocurre al salir del Paso 1 (antes de redirigir a `/guardarropas/nueva/analizar`)
- La imagen ya está en `sessionStorage` como `looksi_nueva_imagen` (base64) — se reutiliza esa misma clave para el request a `/api/validar-imagen`
- Si la validación falla, la imagen se descarta de `sessionStorage` y el usuario permanece en el Paso 1

**Para foto corporal (LOOKSI-034):**
- La validación ocurre al seleccionar o capturar la imagen, antes de subirla a Supabase Storage
- Se usa la imagen en base64 antes de la compresión final

### Rendimiento

- Gemini 2.5 Flash-Lite tiene latencia baja; la validación debería resolverse en < 3 s
- Mostrar un estado de carga ("Verificando imagen…") con el spinner del Paso 1/2 durante la validación
- No guardar la imagen en Storage si la validación falla

### Seguridad

- `GEMINI_API_KEY` solo en la API Route, nunca en el cliente
- Las imágenes se envían en base64 en el body del request a la API Route; no se expone la clave de Gemini al cliente
- No loguear las imágenes en Sentry ni en PostHog; solo loguear el resultado (`motivo`, `confianza`) sin PII

---

## Dependencias

- [LOOKSI-009] Agregar prenda — integración en Paso 1 del flujo
- [LOOKSI-034] Foto de cuerpo completo en perfil — integración al seleccionar la foto
- [LOOKSI-014] Análisis IA automático (comparte el patrón de prompt + API Route de Gemini)
- [LOOKSI-035] Vestir mi look (se beneficia de la calidad de la foto corporal validada)
