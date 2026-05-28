# Diagrama de arquitectura — LookSi

> Renderizable en GitHub, GitLab, y cualquier visor de Mermaid.

---

## Visión general

```mermaid
graph TB
    subgraph Cliente["🌐 Cliente (Browser / PWA)"]
        direction TB
        UI["React 19 + Tailwind CSS v4<br/>Client Components"]
        SW["Service Worker<br/>(next-pwa / Workbox)"]
        PH_C["PostHog SDK<br/>(analytics)"]
        SE_C["Sentry SDK<br/>(errores cliente)"]
    end

    subgraph NextJS["▲ Next.js 16 (Vercel Edge + Node.js)"]
        direction TB
        PROXY["proxy.ts<br/>Auth guard + i18n routing"]
        SC["Server Components<br/>(fetch inicial de datos)"]
        API["API Routes<br/>/api/*"]
        INST["instrumentation.ts<br/>(Sentry server init)"]
    end

    subgraph Supabase["🟩 Supabase"]
        direction TB
        SB_AUTH["Auth<br/>(email + Google OAuth)"]
        SB_DB["PostgreSQL<br/>(RLS habilitado)"]
        SB_ST["Storage<br/>(bucket: prendas, avatars)"]
    end

    subgraph Externos["APIs externas"]
        GEMINI["Google Gemini 2.5 Flash-Lite<br/>(análisis de prendas + generación de looks)"]
        OPENMETEO["Open-Meteo<br/>(clima, sin API key)"]
        SENTRY_SRV["Sentry<br/>(errores servidor)"]
        PH_SRV["PostHog Node<br/>(eventos servidor)"]
    end

    %% Flujo cliente → Next.js
    UI -->|"requests HTTP/fetch"| PROXY
    UI -->|"llamadas fetch /api/*"| API
    SW -.->|"caché offline"| UI

    %% Next.js interno
    PROXY -->|"sesión validada"| SC
    SC -->|"datos iniciales"| UI
    API -->|"JWT cookie"| SB_AUTH
    API -->|"queries con RLS"| SB_DB
    API -->|"signed URLs"| SB_ST
    API -->|"prompt + prendas"| GEMINI
    API -->|"lat/lon"| OPENMETEO

    %% Observabilidad
    SE_C -->|"errores browser"| SENTRY_SRV
    INST -->|"errores Node.js"| SENTRY_SRV
    PH_C -->|"eventos UI"| PH_SRV

    %% Estilos de nodos
    style Cliente fill:#f0f4ff,stroke:#6366f1
    style NextJS fill:#f7f5ef,stroke:#6b7563
    style Supabase fill:#f0fff4,stroke:#22c55e
    style Externos fill:#fff7ed,stroke:#f97316
```

---

## Flujo: agregar prenda con análisis IA

```mermaid
sequenceDiagram
    actor Usuario
    participant Browser as Browser (PWA)
    participant API_ANALIZAR as POST /api/prendas/analizar
    participant API_GARMENTS as POST /api/garments
    participant Gemini as Google Gemini 2.5 Flash-Lite
    participant Storage as Supabase Storage
    participant DB as Supabase DB

    Usuario->>Browser: Sube foto de prenda (paso 1)
    Browser->>Browser: Comprime imagen (browser-image-compression)
    Browser->>Browser: Guarda base64 en sessionStorage

    Browser->>API_ANALIZAR: POST imagen base64
    API_ANALIZAR->>Gemini: Prompt + imagen (base64)
    Gemini-->>API_ANALIZAR: JSON {nombre, categoría, color, estaciones, ...}
    API_ANALIZAR-->>Browser: Análisis IA

    Browser->>Browser: Pre-llena formulario con resultado IA (paso 3)
    Usuario->>Browser: Ajusta campos y confirma

    Browser->>API_GARMENTS: POST {form data + imagen base64}
    API_GARMENTS->>Storage: Upload imagen → prendas/{user_id}/{id}.webp
    API_GARMENTS->>DB: INSERT INTO prendas (con ia_analizada=true)
    API_GARMENTS->>DB: INSERT INTO ai_usage (tokens, costo)
    API_GARMENTS-->>Browser: { prenda_id }

    Browser->>Browser: Limpia sessionStorage
    Browser->>Usuario: Redirige a /guardarropas
```

---

## Flujo: generación de look con IA

```mermaid
sequenceDiagram
    actor Usuario
    participant Browser as Browser (PWA)
    participant API_CLIMA as GET /api/clima
    participant API_GENERAR as POST /api/looks/generar
    participant OpenMeteo as Open-Meteo
    participant Gemini as Google Gemini 2.5 Flash-Lite
    participant DB as Supabase DB

    Usuario->>Browser: Abre /generador
    Browser->>API_CLIMA: GET ?lat=&lon= (geolocalización)
    API_CLIMA->>OpenMeteo: GET forecast
    OpenMeteo-->>API_CLIMA: Temperatura, condición
    API_CLIMA-->>Browser: { temp, condition } (cache 30min)

    Usuario->>Browser: Selecciona ocasión + escribe contexto
    Browser->>API_GENERAR: POST { ocasion, contexto, clima, prenda_base_id? }
    API_GENERAR->>DB: SELECT prendas (guardarropa del usuario)
    API_GENERAR->>Gemini: Prompt con metadatos de prendas + parámetros
    Gemini-->>API_GENERAR: JSON { nombre_look, descripcion, prendas_ids[], prendas_faltantes[] }
    API_GENERAR->>DB: SELECT signed URLs de prendas seleccionadas
    API_GENERAR->>DB: INSERT INTO ai_usage
    API_GENERAR-->>Browser: { look, prendas con URLs }

    Browser->>Browser: Guarda en sessionStorage (looksi_generar_result)
    Browser->>Usuario: Muestra /generador/resultado
```

---

## Flujo: autenticación (OAuth Google)

```mermaid
sequenceDiagram
    actor Usuario
    participant Browser as Browser
    participant Proxy as proxy.ts (middleware)
    participant Callback as /auth/callback
    participant Supabase as Supabase Auth
    participant Google as Google OAuth

    Usuario->>Browser: Clic "Continuar con Google"
    Browser->>Supabase: signInWithOAuth({ provider: "google" })
    Supabase-->>Browser: Redirect a Google OAuth
    Browser->>Google: Autorización de cuenta
    Google-->>Browser: Redirect a /auth/callback?code=...
    Browser->>Callback: GET /auth/callback?code=...
    Callback->>Supabase: exchangeCodeForSession(code)
    Supabase-->>Callback: Session (JWT en cookie)
    Callback-->>Browser: Redirect a /guardarropas

    Note over Proxy: En cada request siguiente,<br/>proxy.ts refresca la sesión<br/>y protege rutas privadas
```

---

## Capas y responsabilidades

| Capa | Archivos | Responsabilidad |
|---|---|---|
| **Middleware** | `proxy.ts` | Auth guard + redirección i18n. Corre en Edge Runtime. |
| **Server Components** | `app/[locale]/(app)/*/page.tsx` | Fetch inicial de datos autenticados. Sin lógica de UI. |
| **Client Components** | `components/features/*/` | Estado, interacciones, llamadas a API. |
| **API Routes** | `app/api/*/route.ts` | Lógica de negocio server-side. Nunca exponen secrets. |
| **DB / Storage** | `supabase/migrations/` | PostgreSQL con RLS + Storage con políticas de bucket. |
| **Servicios externos** | `lib/`, `app/api/` | Gemini y Open-Meteo solo llamados desde API Routes. |
