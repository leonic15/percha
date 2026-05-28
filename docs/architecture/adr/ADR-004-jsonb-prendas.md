# ADR-004 — Uso de JSONB para atributos extendibles de prendas

**Fecha:** 2026-05-01  
**Estado:** Aceptado  
**Historia relacionada:** LOOKSI-027 (Schema DB), LOOKSI-009 (Agregar prenda)

---

## Contexto

La tabla `prendas` necesita almacenar atributos multivalor: una prenda puede pertenecer a varias temporadas, varios estilos y varias ocasiones de uso simultáneamente. Ejemplo real:

- Una campera de jean puede ser: temporadas `["primavera", "otoño"]`, estilos `["casual", "urbano"]`, ocasiones `["casual", "salida"]`.

Las alternativas para modelar esto:

1. **Columnas booleanas individuales** — `es_primavera BOOLEAN`, `es_casual BOOLEAN`, etc. Simple pero rígido: agregar un nuevo valor requiere alterar el schema.
2. **Tablas de join** (`prenda_temporadas`, `prenda_estilos`, `prenda_ocasiones`) — normalización total. Requiere 3 tablas adicionales, 3 JOINs en cada query, y migraciones para agregar nuevos valores.
3. **JSONB arrays** — `estaciones JSONB DEFAULT '[]'`, etc. Almacena directamente el array. Flexible, sin JOINs, indexable con operadores GIN.
4. **`text[]` (PostgreSQL array)** — alternativa nativa. Menos flexible que JSONB para consultas complejas y peor soporte en Supabase JS.

---

## Decisión

Se eligió **JSONB con arrays de strings** para `estaciones`, `estilos`, `ocasiones` y `etiquetas`.

---

## Justificación

### A favor

- **Sin JOINs en el caso de uso principal**: el guardarropa se lista con `SELECT * FROM prendas WHERE user_id = $1` — sin JOINs adicionales para obtener los atributos multivalor. Menos complejidad en las queries del MVP.
- **Flexibilidad**: agregar una nueva temporada o estilo (ej: "resort") requiere solo actualizar la app — sin migración de schema.
- **Retorno directo en la respuesta JSON**: el array llega tal cual a la API Route y al cliente. Sin serialización/deserialización de tablas de join.
- **Indexable con GIN**: si en el futuro se necesita filtrar `WHERE estaciones @> '["verano"]'`, se puede agregar un índice GIN sobre la columna JSONB.
- **Compatible con la respuesta de Gemini**: el modelo devuelve directamente arrays JSON — se almacenan sin transformación.
- **Suficiente para el MVP**: los valores son strings de un set controlado (la app define los valores válidos). No hay consultas analíticas complejas sobre estos campos en el MVP.

### Consideraciones

- **Sin integridad referencial**: un valor como `"primaveraa"` (typo) se almacenaría sin error. Mitigado validando con Zod en la API Route antes de insertar.
- **Consultas complejas más difíciles**: una query como "todas las prendas que son de verano O casual" requiere operadores JSONB (`@>`, `?|`). Aceptable para el MVP.
- **Tamaño**: JSONB tiene overhead vs. columnas nativas. Negligible para arrays pequeños (3-5 elementos).

---

## Consecuencias

- Los campos `estaciones`, `estilos` y `ocasiones` en `prendas` son arrays de strings con valores controlados.
- La validación de valores permitidos ocurre en la API Route (Zod) — la DB no enforcea el set de valores.
- Si en el futuro se necesitan analytics sobre estos atributos (ej: "temporada más popular del guardarropa"), se puede agregar un índice GIN. La query cambiaría a usar `@>` en lugar de `=`.
- El mismo patrón se aplica a `parametros_generacion` en `looks` y a `estilos_favoritos` / `ocasiones_frecuentes` en `profiles`.
