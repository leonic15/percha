# [EP-07] Documentación técnica

**ID:** PERCHA-032  
**Épica:** EP-07 — Infraestructura y arquitectura base  
**Prioridad:** Media  
**Estimación:** 3 puntos  
**Estado:** Completa

---

## Descripción

Como **desarrollador**, quiero **tener documentación técnica completa del proyecto** para **poder mantener y evolucionar la app sin perder contexto de las decisiones tomadas**.

---

## Criterios de aceptación

### Escenario 1: README completo y funcional
- **Dado** que un desarrollador nuevo clona el repositorio
- **Cuando** sigue las instrucciones del README
- **Entonces** puede tener el proyecto corriendo localmente en menos de 15 minutos sin necesitar ayuda adicional

### Escenario 2: Schema de base de datos documentado
- **Dado** que existe un archivo de documentación del schema
- **Cuando** lo reviso
- **Entonces** veo todas las tablas con sus columnas, tipos, relaciones, índices y la justificación de las decisiones de diseño más relevantes (ej: por qué JSONB para ciertos campos)

### Escenario 3: Convenciones de código documentadas
- **Dado** que existe un archivo de convenciones
- **Cuando** lo reviso
- **Entonces** encuentro las reglas definidas para: naming de archivos y carpetas, estructura de componentes, manejo de errores, patrones de llamadas a API y convenciones de i18n

### Escenario 4: Diagrama de arquitectura
- **Dado** que existe un diagrama de arquitectura en la documentación
- **Cuando** lo reviso
- **Entonces** entiendo el flujo completo de la app: cliente → Next.js → Supabase / APIs externas (Gemini, Open-Meteo, Sentry, Posthog), con las capas claramente diferenciadas

### Escenario 5: ADRs documentados
- **Dado** que se tomaron decisiones técnicas importantes durante el diseño del MVP
- **Cuando** reviso la carpeta de ADRs
- **Entonces** encuentro al menos los siguientes registros de decisión:
  - ADR-001: Elección de Next.js App Router
  - ADR-002: Elección de Supabase como backend
  - ADR-003: Elección de Gemini 2.5 Flash-Lite como modelo de IA
  - ADR-004: Uso de JSONB para atributos extendibles de prendas
  - ADR-005: Arquitectura PWA vs. app nativa

---

## Notas técnicas

- **Estructura de documentación:**
```
docs/
├── README.md (en raíz del proyecto)
├── STRUCTURE.md (estructura de carpetas — generado en PERCHA-026)
├── architecture/
│   ├── diagrama-arquitectura.md (diagrama en Mermaid o ASCII)
│   └── adr/
│       ├── ADR-001-nextjs-app-router.md
│       ├── ADR-002-supabase.md
│       ├── ADR-003-gemini-flash-lite.md
│       ├── ADR-004-jsonb-prendas.md
│       └── ADR-005-pwa-vs-nativa.md
├── database/
│   └── schema.md (documentación del schema)
├── conventions.md (convenciones de código)
└── stories/ (historias de usuario — ya existente)
```

- **Contenido mínimo del README:**
  - Descripción del producto
  - Stack tecnológico con links
  - Requisitos previos (Node.js, Supabase CLI, cuentas en servicios externos)
  - Pasos de instalación local paso a paso
  - Variables de entorno (referenciar `.env.example`)
  - Comandos disponibles (`dev`, `build`, `lint`, `typecheck`, `db:reset`, `db:seed`)
  - Links a documentación adicional

- **Formato ADR:** usar la plantilla MADR (Markdown Architectural Decision Records)
- Los diagramas de arquitectura se escriben en Mermaid (renderizable en GitHub)
- La documentación se mantiene en español (mismo idioma que las historias de usuario)

---

## Dependencias

- [PERCHA-026] Setup inicial del proyecto
- [PERCHA-027] Schema de base de datos, migraciones y seeds
- [PERCHA-028] CI/CD con GitHub Actions y deploy en Vercel
- [PERCHA-029] Seguridad
- [PERCHA-030] Observabilidad
- [PERCHA-031] Analytics con Posthog
