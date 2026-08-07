# [EP-07] Analytics de producto con Posthog

**ID:** PERCHA-031  
**Épica:** EP-07 — Infraestructura y arquitectura base  
**Prioridad:** Media  
**Estimación:** 3 puntos  
**Estado:** Completada

---

## Descripción

Como **dueño del producto**, quiero **tener métricas de uso detalladas de Percha en un dashboard de Posthog** para **entender cómo se usa la app, qué features se usan más y cuánto cuesta la IA, sin exponer esta información a los usuarios finales**.

---

## Criterios de aceptación

### Escenario 1: Eventos de uso de features principales trackeados
- **Dado** que la app está en producción con Posthog integrado
- **Cuando** un usuario realiza acciones clave
- **Entonces** los siguientes eventos se registran en Posthog con sus propiedades correspondientes:
  - `prenda_agregada` (categoría, subcategoría, con_ia: bool)
  - `prenda_editada`
  - `prenda_eliminada`
  - `ia_analisis_iniciado`
  - `ia_analisis_completado` (duración_ms, tokens_usados)
  - `ia_analisis_fallido` (motivo)
  - `look_generado` (modo: 'desde_cero' | 'desde_prenda_base', con_clima: bool)
  - `look_guardado`
  - `look_usado`
  - `look_regenerado`

### Escenario 2: Métricas de costos de IA visibles
- **Dado** que los eventos de IA incluyen `tokens_usados` y `costo_estimado`
- **Cuando** reviso el dashboard de Posthog
- **Entonces** puedo ver un gráfico de costo acumulado de IA por día/semana y el promedio de costo por análisis y por generación de look

### Escenario 3: Funnels de onboarding
- **Dado** que Posthog registra los eventos del flujo de onboarding
- **Cuando** reviso el funnel en el dashboard
- **Entonces** puedo ver la tasa de conversión en cada paso: registro → primera prenda agregada → primer análisis de IA → primer look generado → look guardado

### Escenario 4: Identificación de usuarios en Posthog
- **Dado** que un usuario se loguea en la app
- **Cuando** Posthog recibe el evento
- **Entonces** el usuario queda identificado en Posthog con un ID anónimo (no el email ni el UUID de Supabase directamente) para poder trazar su journey sin exponer PII

### Escenario 5: Dashboard de Posthog no accesible por usuarios finales
- **Dado** que Posthog tiene un dashboard con datos de uso
- **Cuando** cualquier usuario de Percha intenta acceder
- **Entonces** el dashboard de Posthog solo es accesible con las credenciales del dueño del proyecto (no hay ruta `/admin` en la app)

---

## Notas técnicas

- Usar `posthog-js` en el cliente y `posthog-node` en las API Routes para eventos server-side
- Posthog free tier: 1 millón de eventos/mes — más que suficiente para el MVP
- Inicializar Posthog en un Provider de React (`/components/providers/PosthogProvider.tsx`) wrapeando el layout principal
- **PII en Posthog:** nunca enviar email, nombre ni UUID real; identificar usuarios con un hash de su `user_id`
- Los eventos de costo de IA se envían desde las API Routes (server-side) donde tenemos los datos de tokens y costo
- Configurar en Posthog:
  - Funnel: Registro → Primera prenda → Primer análisis IA → Primer look → Look guardado
  - Dashboard principal con: DAU/WAU/MAU, eventos por feature, costos de IA, prendas promedio por usuario
  - Retention chart: usuarios que vuelven a la app después del día 1, 7 y 30
- Respetar `Do Not Track` del navegador: si el usuario tiene DNT habilitado, no trackear
- La variable `NEXT_PUBLIC_POSTHOG_KEY` es pública (va al cliente) pero no es un secret crítico — es el Project API Key de Posthog, no el Personal API Key

---

## Dependencias

- [PERCHA-026] Setup inicial del proyecto
- [PERCHA-028] CI/CD con GitHub Actions y deploy en Vercel
