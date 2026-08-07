# [EP-06] Datos corporales en perfil (género, altura, peso)

**ID:** PERCHA-033  
**Épica:** EP-06 — Preferencias y configuración del usuario  
**Prioridad:** Alta  
**Estimación:** 2 puntos  
**Estado:** Completada

---

## Descripción

Como **usuario autenticado**, quiero **indicar mi género, altura y peso en mi perfil** para **que el generador de looks tenga en cuenta mis características físicas y genere outfits adecuados a mi identidad y complexión**.

---

## Criterios de aceptación

### Escenario 1: Completar datos corporales desde Configuración
- **Dado** que estoy en la sección Configuración / Perfil
- **Cuando** accedo a la sub-sección "Datos personales"
- **Entonces** veo tres campos editables: Género, Altura (cm) y Peso (kg)

### Escenario 2: Guardar género
- **Dado** que estoy editando mi perfil
- **Cuando** selecciono una opción de género (Hombre / Mujer / Prefiero no decirlo) y guardo
- **Entonces** el valor se persiste en `profiles.genero` y se incluye en el prompt del generador de looks desde ese momento

### Escenario 3: Guardar altura y peso
- **Dado** que ingreso mi altura (ej: 170) y peso (ej: 65)
- **Cuando** guardo los cambios
- **Entonces** los valores se persisten en `profiles.altura_cm` y `profiles.peso_kg` como enteros positivos

### Escenario 4: Validación de rango
- **Dado** que ingreso un valor fuera de rango (altura < 50 o > 250 cm; peso < 20 o > 300 kg)
- **Cuando** intento guardar
- **Entonces** veo un mensaje de error de validación y el valor no se guarda

### Escenario 5: Campos opcionales — sin bloquear el generador
- **Dado** que no completé los datos corporales
- **Cuando** uso el generador de looks
- **Entonces** el generador funciona normalmente, pero el botón "Vestir mi look" (PERCHA-035) aparece deshabilitado con tooltip "Completá tu perfil para usar esta función"

### Escenario 6: Género incluido en la generación de looks
- **Dado** que tengo `genero = "Hombre"` guardado
- **Cuando** el generador arma un look
- **Entonces** el prompt enviado a Gemini incluye el género para que la IA no sugiera prendas ni combinaciones incompatibles con la identidad del usuario

### Escenario 7: Actualizar datos
- **Dado** que ya tengo datos guardados
- **Cuando** los edito y guardo
- **Entonces** los nuevos valores se reflejan inmediatamente en los próximos looks generados

---

## Notas técnicas

- Agregar columnas a la tabla `profiles`:
  - `genero` — `text` CHECK (`genero` IN ('hombre', 'mujer', 'prefiero_no_decirlo')), nullable
  - `altura_cm` — `smallint` CHECK (altura_cm BETWEEN 50 AND 250), nullable
  - `peso_kg` — `smallint` CHECK (peso_kg BETWEEN 20 AND 300), nullable
- Migración: `supabase/migrations/20260527000001_profiles_datos_corporales.sql`
- RLS: el usuario solo puede leer y escribir su propio registro en `profiles`
- El campo `genero` se agrega al contexto del prompt en `POST /api/looks/generar` y `POST /api/looks/generar-imagen`
- Los campos `altura_cm` y `peso_kg` se usan en PERCHA-035 para generar proporciones realistas
- Actualización vía `PATCH /api/perfil` con validación Zod en el servidor
- Los tres campos son opcionales: valor `null` = no informado
- Textos en español con claves i18n; la opción "Prefiero no decirlo" se envía a la IA como contexto neutro (sin asumir género)

---

## Dependencias

- [PERCHA-005] Edición de perfil básico (comparte tabla `profiles` y la pantalla de configuración)
- [PERCHA-017] Generar look desde cero (consume `genero` en el prompt)
- [PERCHA-035] Vestir mi look (consume `altura_cm`, `peso_kg` y `genero` para la imagen)
