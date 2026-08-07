# ADR-002 — Elección de Supabase como backend

**Fecha:** 2026-05-01  
**Estado:** Aceptado  
**Historia relacionada:** PERCHA-026 (Setup inicial), PERCHA-027 (Schema DB)

---

## Contexto

Percha necesitaba un backend que cubriera: autenticación (email/password + OAuth Google), base de datos relacional, almacenamiento de imágenes y Row Level Security para aislar datos por usuario. Todo dentro del presupuesto de un free tier para el MVP.

Las alternativas consideradas:

1. **Supabase** — BaaS con PostgreSQL, Auth, Storage y RLS. Free tier generoso (500 MB DB, 1 GB Storage, 50 MB/día de transferencia).
2. **Firebase** — BaaS de Google con Firestore (NoSQL), Auth y Storage. Modelo de datos no relacional requeriría más trabajo para las consultas complejas del guardarropa.
3. **PlanetScale + Clerk + S3** — Stack modular: DB separada, auth separada, storage separado. Mayor complejidad operacional y costos combinados más altos.
4. **Backend propio (Node.js + PostgreSQL)** — Control total pero requiere infraestructura, mantenimiento y tiempo de desarrollo no disponible para un MVP.

---

## Decisión

Se eligió **Supabase** como backend único para auth, DB y storage.

---

## Justificación

### A favor

- **PostgreSQL real**: esquema relacional con FKs, índices, triggers y funciones PL/pgSQL. Permite RLS a nivel de fila — cada usuario solo ve sus datos sin lógica adicional en el servidor.
- **Auth integrada con Google OAuth**: configuración en minutos vs. días. El trigger `handle_new_user` crea automáticamente el perfil con los datos de Google.
- **`@supabase/ssr`**: integración de primera clase con Next.js App Router. Las cookies de sesión se gestionan transparentemente en middleware, Server Components y Client Components.
- **Storage con políticas**: bucket `prendas` privado con políticas RLS — las imágenes solo son accesibles por el dueño via signed URLs. Signed URLs con TTL configurable (1h en producción).
- **Free tier suficiente para el MVP**: 500 MB DB (>100.000 prendas), 1 GB Storage (~5.000 fotos a 200 KB promedio).
- **Supabase CLI**: migraciones versionadas en SQL puro, sin ORM. El schema está en `supabase/migrations/` y es reproducible con `supabase db reset`.
- **Dashboard Supabase Studio**: interfaz visual para consultar datos, ver logs de Auth y gestionar storage — útil durante el desarrollo.

### Consideraciones

- **Vendor lock-in**: el schema de Auth (`auth.users`, `auth.sessions`) es propietario de Supabase. Migrar a otro proveedor requeriría adaptar los triggers y la gestión de sesiones.
- **Free tier: pause automático a los 7 días**: proyectos sin actividad se pausan. En producción se puede evitar con un ping periódico o upgradeando al plan Pro.
- **RLS en tablas de unión** (`look_prendas`, `look_usos`): las políticas requieren subqueries a `looks` para verificar el `user_id` — impacto menor de performance, cubierto por índices.

---

## Consecuencias

- `SUPABASE_SERVICE_ROLE_KEY` solo en API Routes. Esta key bypasea RLS; su uso está restringido a operaciones que el usuario no debe poder hacer directamente (ej: `ai_usage`).
- Las migraciones son SQL puro — sin Prisma ni otro ORM. Los tipos TypeScript se generan con `supabase gen types` y se guardan en `lib/database.types.ts`.
- El schema evoluciona con archivos de migración numerados (`20260523000000_nombre.sql`). Nunca modificar migraciones ya aplicadas; siempre agregar una nueva.
