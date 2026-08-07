# [EP-07] Setup inicial del proyecto

**ID:** PERCHA-026  
**Épica:** EP-07 — Infraestructura y arquitectura base  
**Prioridad:** Alta  
**Estimación:** 5 puntos  
**Estado:** Completada

---

## Descripción

Como **desarrollador**, quiero **tener el proyecto Next.js configurado con Supabase, PWA, i18n y una estructura de carpetas bien definida** para **poder empezar a desarrollar features sobre una base sólida y consistente**.

---

## Criterios de aceptación

### Escenario 1: Proyecto Next.js inicializado
- **Dado** que clono el repositorio
- **Cuando** ejecuto `npm install && npm run dev`
- **Entonces** la app corre localmente sin errores en `http://localhost:3000`

### Escenario 2: Supabase conectado
- **Dado** que el proyecto está corriendo localmente
- **Cuando** la app inicia
- **Entonces** el cliente de Supabase se inicializa correctamente usando las variables de entorno y la conexión a la base de datos es exitosa

### Escenario 3: PWA configurada
- **Dado** que la app está deployada en Vercel
- **Cuando** accedo desde un dispositivo móvil
- **Entonces** el navegador ofrece la opción de instalar la app en la pantalla de inicio, hay un `manifest.json` válido con nombre, íconos y colores de Percha, y un service worker activo para funcionamiento offline básico

### Escenario 4: i18n configurado
- **Dado** que el proyecto está configurado con `next-intl`
- **Cuando** la app carga
- **Entonces** el idioma por defecto es español, hay archivos de traducción en `/messages/es.json` e `/messages/en.json` con todas las claves de la app, y cambiar el idioma (PERCHA-025) refleja los cambios en toda la UI

### Escenario 5: Estructura de carpetas definida y documentada
- **Dado** que el proyecto está inicializado
- **Cuando** reviso la estructura del repositorio
- **Entonces** sigue la convención documentada (ver Notas técnicas) y hay un archivo `STRUCTURE.md` que la explica

---

## Notas técnicas

- **Stack de dependencias iniciales:**
  - `next` (App Router)
  - `@supabase/supabase-js` + `@supabase/ssr`
  - `next-pwa`
  - `next-intl`
  - `tailwindcss`
  - `typescript`
  - `zod` (validación de schemas)
  - `browser-image-compression`

- **Estructura de carpetas:**
```
/
├── app/                        # App Router de Next.js
│   ├── [locale]/               # Rutas internacionalizadas
│   │   ├── (auth)/             # Rutas de autenticación (login, registro)
│   │   ├── (app)/              # Rutas protegidas de la app
│   │   │   ├── guardarropas/
│   │   │   ├── looks/
│   │   │   └── configuracion/
│   │   └── layout.tsx
│   └── api/                    # API Routes
│       ├── auth/
│       ├── prendas/
│       ├── looks/
│       └── clima/
├── components/                 # Componentes reutilizables
│   ├── ui/                     # Componentes base (botones, inputs, modales)
│   └── features/               # Componentes de features específicas
├── lib/                        # Utilidades, clientes y helpers
│   ├── supabase/               # Clientes de Supabase (server y client)
│   └── utils/
├── messages/                   # Archivos de traducción
│   ├── es.json
│   └── en.json
├── public/                     # Assets estáticos + íconos PWA
├── docs/                       # Documentación del proyecto
│   └── stories/                # Historias de usuario
└── supabase/                   # Configuración local de Supabase
    ├── migrations/
    └── seed.sql
```

- Configurar `next.config.js` con `next-pwa` y headers de seguridad (ver PERCHA-029)
- Configurar `middleware.ts` de Next.js para protección de rutas y manejo de locales con `next-intl`
- Usar Supabase CLI para desarrollo local con `supabase start`
- Textos en español con claves i18n

---

## Dependencias

- Ninguna — esta historia es el punto de partida de todo el proyecto
