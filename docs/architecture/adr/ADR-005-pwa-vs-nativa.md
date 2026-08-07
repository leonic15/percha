# ADR-005 — Arquitectura PWA vs. app nativa

**Fecha:** 2026-05-01  
**Estado:** Aceptado  
**Historia relacionada:** PERCHA-026 (Setup inicial)

---

## Contexto

Percha es primariamente una app móvil (los usuarios se fotografían la ropa desde el celular). La decisión de arquitectura define toda la experiencia: cómo los usuarios la instalan, la actualizan y la usan offline.

Las alternativas consideradas:

1. **PWA (Progressive Web App)** — web app instalable desde el browser, sin tiendas de apps.
2. **React Native (Expo)** — app nativa cross-platform (iOS + Android) con React. Requiere publicación en App Store y Play Store.
3. **Flutter** — app nativa con su propio rendering engine. Mayor cambio de stack.
4. **Web app sin PWA** — solo acceso vía browser, sin capacidades offline ni instalación.

---

## Decisión

Se eligió **PWA** sobre Next.js con `@ducanh2912/next-pwa` (Workbox).

---

## Justificación

### A favor de PWA

- **Un solo codebase**: web + "app" comparten código al 100%. Sin bifurcaciones de features entre plataformas.
- **Deploy instantáneo**: las actualizaciones llegan en el próximo Service Worker refresh — sin review de App Store (1-7 días de espera).
- **Sin cuentas de desarrollador**: App Store ($99/año) y Play Store ($25 único) requieren cuentas y procesos de aprobación para el MVP.
- **Acceso a cámara y galería**: la PWA usa `<input type="file" accept="image/*" capture="environment">` — funciona en iOS Safari ≥ 14.3 y Android Chrome. Suficiente para el caso de uso de fotografiar prendas.
- **Instalable en iOS y Android**: "Agregar a pantalla de inicio" instala la PWA en modo standalone (sin barra del browser). El `manifest.json` define nombre, colores, iconos y shortcuts.
- **Cacheo offline con Workbox**: las páginas visitadas se cachean. El guardarropa es visible offline (con datos del último fetch); las acciones que requieren red muestran un mensaje claro.
- **Next.js + Vercel**: la app ya corre en Next.js — agregar PWA es un plugin (`withPWA`) sin cambio de framework.

### Consideraciones

- **Limitaciones de iOS**: iOS Safari tiene restricciones en PWA — no soporta push notifications (aún), y el acceso a hardware es más limitado que en app nativa.
- **Experiencia de instalación**: la instalación es menos obvia que "descargar de App Store". Mitigado con un banner de instalación en la bienvenida (feature futura).
- **Performance**: las apps nativas tienen acceso a APIs de sistema de más bajo nivel. Para Percha (guardarropa + fotos) la diferencia no es perceptible.
- **Distribución**: sin tienda de apps, la adquisición de usuarios es 100% web (SEO, links directos). Puede ser una limitación si se quiere presencia en las tiendas.

### Por qué no React Native / Expo ahora

- **Tiempo de desarrollo**: React Native requiere aprender el paradigma nativo (StyleSheet, componentes nativos, Expo SDK). El equipo ya conoce Next.js.
- **Proceso de publicación**: la App Store review puede demorar el MVP en días o semanas.
- **Costo**: App Store ($99/año) es un gasto no justificado para un MVP sin usuarios.

> Si la app escala y necesita capacidades nativas (notificaciones push, acceso a contactos, widgets), se puede evaluar React Native / Expo con la lógica de negocio extraída a una librería compartida.

---

## Consecuencias

- El `manifest.json` en `/public/manifest.json` define la identidad PWA: nombre, tema, iconos y shortcuts.
- `next-pwa` está deshabilitado en development (`disable: process.env.NODE_ENV === "development"`) para evitar caché de Service Worker durante el desarrollo.
- El CSP en `next.config.ts` incluye `worker-src 'self' blob:'` para los Web Workers de Workbox y `@imgly/background-removal`.
- Las funcionalidades que requieren la cámara usan `<input capture="environment">` — compatible con los browsers objetivo.
- Los iconos PWA (192px, 512px, maskable, shortcuts) están en `/public/icons/`.
