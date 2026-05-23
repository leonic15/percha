# LookSi — Especificaciones de implementación

> Stack objetivo: **Next.js 16 + Tailwind v4 + TypeScript**.
> Tokens en `app/globals.css` dentro de `@theme {}` — no hay `tailwind.config.js`.
> Mobile-first (390×844 ref). Desktop break en `md` (768px).
> Idioma: **es-AR**. Touch target mínimo: **44px**.

---

## 01 · Bienvenida (Welcome)
**Ruta:** `/` (cuando no hay sesión)

**Layout mobile:**
- **Top:** eyebrow `BETA · v0.4 · BUENOS AIRES` (80px desde el top, padding lateral 28px).
- **Medio:** H1 display de 72px en 3 líneas — "Tu / guardarropa, / digital." con la palabra `guardarropa,` en `--color-accent`. Subtítulo Inter 14px a 280px máx de ancho.
- **Decorativo:** dos `<GarmentImage />` rotados ( `+6°` y `-8°`) absolutos sobre el lado derecho, opacidad 0.85 / 1.
- **Bottom:** stack vertical de 2 botones — `<Button kind="primary" size="lg" full>Crear cuenta</Button>` + `<Button kind="ghost" size="lg" full>Ya tengo cuenta</Button>` + nota legal 11px centrada.
- **Componentes:** `<Button />`, `<GarmentImage />` (placeholder de prenda con franjas).
- **Comportamiento:** no hay scroll. La pantalla siempre cabe en viewport.

**Layout desktop:**
- Centrar la card mobile en viewport (`max-w-[420px] mx-auto`), o partir en dos columnas: hero textual a la izquierda, mosaico de prendas decorativas full-bleed a la derecha (`grid-cols-[1fr_1.2fr]`).

**Estados:**
- **Vacío:** N/A — es siempre el primer pintado.
- **Carga:** mostrar wordmark + spinner pequeño centrado mientras se chequea sesión.
- **Error:** si falla el check de sesión, ir directo a la pantalla (no bloquear).

**Notas de detalle:**
- H1: `var(--font-display)` 72px / line-height 0.88 / `letter-spacing: -0.01em` / uppercase.
- Las decoraciones absolutas (`right: -20px` y `right: 80px`) deben quedar **debajo** del contenido textual en z-index — usar `z-0` y los textos `z-10`.
- Tap en CTAs: `transform: scale(0.985)` 120ms.

---

## 02 · Login
**Ruta:** `/login`

**Layout mobile:**
- **Top bar:** back button + wordmark centrado + spacer (24px → 70px de top).
- **Hero text:** H1 42px display "Bienvenida / de vuelta." + subtítulo 13px.
- **Form:** stack `gap: 24px` — `<Input label="Email" />` + `<Input label="Contraseña" type="password" suffix={<EyeIcon/>} />`.
- **Link** "Olvidé mi contraseña" alineado a la derecha, subrayado a `text-underline-offset: 3px`.
- **CTA primario:** `<Button kind="primary" size="lg" full>Ingresar</Button>`.
- **Divider:** "O" con líneas a 1px `--color-line` a cada lado.
- **OAuth:** botón rounded-full 54px con icono Google.
- **Footer:** "¿No tenés cuenta? **Registrate**" pegado al bottom.
- **Componentes:** `<Input />`, `<Button />`, `<Icon name="back|eye|google" />`.

**Layout desktop:**
- Form centrado en card `max-w-[420px]`. El footer link puede ir afuera del card.
- Opcional: split-screen con imagen full-bleed a la izquierda.

**Estados:**
- **Vacío:** los inputs muestran `placeholder` con `--color-ink-3`.
- **Carga:** botón "Ingresar" → texto a "Ingresando…" + spinner inline 14px, disabled.
- **Error:** debajo del input afectado, texto 12px `--color-danger`. Si es error 401: toast `error` "Email o contraseña incorrectos".

**Notas de detalle:**
- Espaciado vertical: hero → form `mb-9 (36px)`, form → CTA `mb-7 (28px)`, CTA → divider `my-6 (24px)`.
- El input es **underline-style** (border-bottom 1px), nunca outlined.

---

## 03 · Registro (Signup)
**Ruta:** `/signup`

**Layout mobile:**
- **Top bar:** back + eyebrow `PASO 1 / 1` (left-aligned hint que es un solo paso) + spacer.
- **Hero:** H1 42px "Empecemos." + sub.
- **Form:** 3 inputs underline — Nombre, Email, Contraseña. El de contraseña con `hint` y `suffix` (eyeOff).
- **CTA:** primary lg full "Crear cuenta".
- **Legal:** texto 11px 2 líneas centrado, `--color-ink-3`.
- **Footer:** "¿Ya tenés cuenta? **Iniciar sesión**".

**Layout desktop:**
- Idem login, en card `max-w-[420px]` centrada.

**Estados:**
- **Vacío:** N/A (los inputs ya muestran placeholder).
- **Carga:** CTA disabled + texto "Creando cuenta…".
- **Error:** validación inline por campo (email mal formado, password < 8 chars). Si el email ya existe → toast `error` + foco en input.

**Notas de detalle:**
- `<Input hint="Usá mayúsculas, números y un símbolo." />` debajo de contraseña, 11px `--color-ink-3`.
- Después del submit exitoso: redirect a `/guardarropas` con onboarding overlay.

---

## 04 · Recuperar contraseña (Forgot)
**Ruta:** `/recuperar`

**Layout mobile:**
- **Top:** solo back button.
- **Hero:** H1 42px "Recuperar / acceso." + sub 13px sobre el flujo.
- **Form:** 1 input email.
- **CTA:** primary lg full "Enviar link".
- **Info box:** padding 14px con `border: 1px dashed var(--color-line)` — eyebrow "NOTA" + texto sobre spam folder.

**Layout desktop:**
- Card centrada `max-w-[420px]`.

**Estados:**
- **Vacío:** N/A.
- **Carga:** CTA → "Enviando…".
- **Éxito:** reemplazar contenido por confirmación grande + ícono check + texto "Revisá tu casilla". Mantener back para volver.
- **Error:** si el email no existe — **no revelar**, mostrar siempre éxito (anti-enumeración).

**Notas de detalle:**
- Caja de nota usa dashed border, **no** background — para diferenciar de cards reales.

---

## 05 · Guardarropa (grilla principal)
**Ruta:** `/guardarropas`

**Layout mobile:**
- **Header (sticky top, 56–96px):**
  - Row 1: wordmark izquierda + íconos search/bell derecha.
  - Row 2: H1 36px "Guardarropa" + contador `47 / prendas` derecha (mono).
- **Chips de filtro:** scroll horizontal sin scrollbar visible (`overflow-x: auto`), 6 chips size-sm, primero es "Todas" active.
- **Sub-bar (44px):** ícono filter + texto "3 filtros · otoño · casual" izquierda; toggle grid/list derecha.
- **Grilla:** `grid-cols-2 gap-[10px] px-5`. Cada celda es `<GarmentCard />` con imagen `aspect-[4/5]`.
- **FAB:** botón círculo 56px `--color-accent` en `right: 20px; bottom: 108px` (sobre el bottom nav, con `shadow-fab`).
- **Bottom nav:** sticky bottom, 4 items, `active="guardarropas"`.
- **Componentes:** `<Wordmark />`, `<Icon />`, `<Chip />`, `<GarmentCard />`, `<BottomNav />`.

**Layout desktop:**
- `<Sidebar />` 240px fija a la izquierda; el contenido pasa a `<main>` con padding-left 240px.
- Header pierde la row de íconos (search va en sidebar) y H1 se alinea a 56px.
- Grilla: `md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`.
- FAB se reemplaza por el CTA "+ Agregar prenda" del sidebar (no se duplica).
- Bottom nav oculto en `md+`.

**Estados:**
- **Vacío:** redirigir / renderizar `ScreenWardrobeEmpty` (siguiente sección).
- **Carga:** `<GarmentGridSkeleton count={8} />` reemplaza la grilla; chips y header siguen visibles.
- **Error:** banner inline arriba de la grilla: borde dashed `--color-danger`, texto 12px + botón "Reintentar" ghost size-sm.

**Notas de detalle:**
- Los chips de filtro **mantienen su scroll position** al volver de un detalle (usar `sessionStorage` por categoría).
- FAB no oculta filas: la última fila de la grilla tiene `padding-bottom: 80px`.
- Tap en card → push `/prenda/[id]` con view transition (Next 16 nativo).

---

## 06 · Guardarropa vacío (Empty state)
**Ruta:** `/guardarropas` (cuando `garments.length === 0`)

**Layout mobile:**
- **Header:** mismo que main pero **sin** chips ni sub-bar (47 prendas → omitir contador).
- **Centro:** ilustración compuesta de 3 `<GarmentImage />` apiladas/rotadas en un cuadrado 200×200 centrado.
- **Title:** H2 32px display "Tu armario / está esperando." centrado.
- **Body:** texto 14px 280px max-width centrado.
- **CTA:** `<Button kind="accent" size="lg" icon="plus">Agregar primera prenda</Button>` centrado.
- **Tip footer:** texto 11px centrado con líneas de 16px a cada lado — "tip · 8 prendas mínimo para generar looks".

**Layout desktop:**
- Mismo layout centrado dentro del `<main>` con sidebar visible. La CTA puede ser más ancha (`max-w-[360px]`).

**Estados:**
- **Vacío:** es el propio empty state — no hay sub-estado.
- **Carga (primera vez):** mismo skeleton que main, transiciona a empty si confirma 0 prendas.
- **Error:** banner inline arriba del centro de la pantalla.

**Notas de detalle:**
- Las 3 imágenes decorativas usan posiciones absolutas relativas al wrapper 200×200: `{left: 0, top: 20, rotate: -8°}`, `{right: 0, top: 0, rotate: 6°}`, `{left: 55, top: 65, rotate: -2°}`.
- Después de agregar la primera prenda, transicionar **suave** al grid (fade 200ms).

---

## 07 · Filtros (bottom sheet)
**Ruta:** `/guardarropas?filters=open` (o estado local — preferir state, no route).

**Layout mobile:**
- **Backdrop:** `rgba(0,0,0,0.4)` cubre toda la pantalla, tap-out cierra.
- **Sheet:** `position: absolute bottom: 0`, `border-radius: 20px 20px 0 0`, padding 16/22/28px, `max-height: 78vh`, scroll interno, `shadow-modal`.
- **Drag handle:** pill 36×4 `--color-line` centrada arriba.
- **Header:** H2 24px "Filtros" + link "Limpiar todo" en accent.
- **Secciones** (cada una con eyebrow + grupo de chips wrap):
  - Categoría (7 chips, multi-select)
  - Temporada (4 chips)
  - Ocasión (5 chips)
- **Toggle row:** "Solo favoritos" + iOS-style toggle 38×22.
- **CTA bottom:** primary lg full **con contador dinámico** "Aplicar · 14 prendas".
- **Componentes:** `<BottomSheet />`, `<Chip multi />`, `<Toggle />`, `<Button />`.

**Layout desktop:**
- No es bottom sheet — se convierte en **drawer derecho** (`right-0`, 380px ancho, altura full). O en popover bajo el chip "Filtros" del header.

**Estados:**
- **Vacío:** N/A.
- **Carga:** las opciones se cargan client-side desde tu lista de prendas — no skeleton.
- **Error:** N/A (no hay fetch).

**Notas de detalle:**
- El contador "14 prendas" debe **recalcularse en cliente** mientras tocan chips (sin debounce — feedback instantáneo).
- Al cerrar sin "Aplicar", **revertir** cambios (estado local pendiente, no commit hasta tap).
- Animación: sheet `translateY(100%) → 0` en 280ms, `cubic-bezier(0.32, 0.72, 0, 1)`.

---

## 08 · Agregar prenda — Captura
**Ruta:** `/agregar` (paso 1)

**Layout mobile:**
- **Top bar:** close (×) + eyebrow `PASO 1 / 2` + spacer.
- **Hero:** H1 36px "Agregar / prenda." + sub 13px.
- **Drop zone:** aspect-ratio 1/1.1, border dashed 1.5px `--color-line`, fondo `--color-surface-2`. Cuatro corner-brackets absolutos (`<CornerBracket />` o inline). Ícono cámara 36px centrado + label 12px uppercase.
- **CTAs (stack):** primary lg "Usar cámara" + ghost lg "Elegir de galería".
- **Tip:** 11px centrado al pie.
- **Componentes:** `<Button icon="camera|gallery" />`, `<Icon />`.

**Layout desktop:**
- Card central `max-w-[480px]`. La drop zone también acepta **drag & drop** desktop (highlight border en hover).

**Estados:**
- **Vacío:** es el estado por defecto.
- **Carga:** después de seleccionar imagen, pasar inmediatamente a `/agregar/analizar` (siguiente pantalla).
- **Error:** si el archivo > 10MB o no es imagen — toast `error`.

**Notas de detalle:**
- Los corner-brackets: 20×20px con bordes 1.5px solo en 2 lados (L-shape).
- `<input type="file" accept="image/*" capture="environment">` para que "Usar cámara" abra la trasera en iOS Safari.

---

## 09 · Agregar prenda — Analizando IA
**Ruta:** `/agregar/analizar`

**Layout mobile:**
- **Top bar:** close (gris suave, indica que cancelar interrumpe) + eyebrow `PASO 2 / 2 · ANALIZANDO`.
- **Foto:** aspect 1/1.1 con la foto subida.
- **Overlay de scan:**
  - Línea horizontal 2px accent con `box-shadow: 0 0 18px var(--color-accent)` animada de top a bottom (loop 2.5s).
  - 4 puntos SVG accent en posiciones fijas (anclas IA fake).
  - Pill arriba a la derecha: fondo `rgba(0,0,0,0.7)` + dot pulse accent + texto "✦ Analizando con IA".
- **Block info:**
  - H2 28px "Identificando / tu prenda…"
  - Sub 12px.
  - **Lista de pasos** (4 ítems, gap 14px):
    - Cada paso: círculo 18px (estados: done=relleno accent + check, active=ring spinner, pending=outline) + label 13px.
- **No CTAs:** la pantalla auto-avanza a `/agregar/form` cuando termina.

**Layout desktop:**
- Card centrada `max-w-[480px]`. Igual al mobile.

**Estados:**
- **Vacío:** N/A.
- **Carga:** **es** el estado de carga (toda la pantalla).
- **Error:** si la IA falla, los pasos pendientes marcan ⚠️ rojo y aparece CTA "Reintentar / Completar manualmente" abajo. **No** auto-redirigir.

**Notas de detalle:**
- Animaciones CSS:
  - `@keyframes spin { to { transform: rotate(360deg); } }`
  - `@keyframes pulse { 50% { opacity: 0.3; } }`
  - `@keyframes scan { from { top: 0; } to { top: 100%; } }`
- Los pasos no son fake — atárlos a los eventos reales del backend de IA (WebSocket o polling). Mínimo 2s por estética aunque el backend responda antes.
- Si la API tarda >15s → mostrar botón "Continuar sin IA".

---

## 10 · Agregar prenda — Formulario (revisar)
**Ruta:** `/agregar/form`

**Layout mobile:**
- **Top bar:** back + eyebrow "REVISAR · GUARDAR" + link "Saltar" accent (a la derecha).
- **Preview row:** thumb 110px de la prenda izquierda + H2 22px "Análisis / completo." + sub + link underline "Reintentar análisis" 11px.
- **Form (stack gap-22px):**
  - `<Input label="Nombre" ai value="Blusa de lino color crema" />` — el badge `✦ IA` aparece junto al label.
  - Categoría: eyebrow + AIBadge + grupo `<Chip />` (single-select).
  - Color: eyebrow + AIBadge + swatch 22px + nombre color + link "Cambiar →".
  - Temporada: chips multi-select.
  - Ocasión: chips multi-select.
  - Estilo: chips multi-select.
  - Notas: textarea inline (border 1px, minHeight 64px).
- **Sticky bottom:** `<Button kind="primary" size="lg" full>Guardar prenda</Button>` con `border-top: 1px solid var(--color-line-2)` y bg `--color-bg`.
- **Componentes:** `<Input ai />`, `<AIBadge />`, `<Chip />`, `<Textarea />`.

**Layout desktop:**
- Two-column: izquierda preview 320px sticky, derecha form. Bottom CTA pierde el sticky y va al fin del form.

**Estados:**
- **Vacío:** los campos vienen pre-llenos por IA. Si la IA no detectó algo, el campo queda vacío con placeholder (sin badge IA).
- **Carga:** al tocar "Guardar", CTA disabled + "Guardando…". Luego toast `success` y push a `/prenda/[id]` o back a `/guardarropas`.
- **Error:** validación inline. Si el nombre queda vacío al guardar — bordear el input rojo + focus.

**Notas de detalle:**
- El badge IA en los inputs/secciones señala campos auto-completados — **debe desaparecer** apenas el usuario edita el valor (señalando que ya no es IA, es manual).
- "Saltar" guarda con los valores actuales (incluso si están pre-llenos), no descarta.
- El swatch de color al tocar abre un mini-popover con paleta de 12 colores.

---

## 11 · Detalle de prenda
**Ruta:** `/prenda/[id]`

**Layout mobile:**
- **Hero photo:** full-width aspect 1/1.15, sin padding lateral.
- **Top bar flotante sobre la foto** (`position: absolute, top: 56px`):
  - back en círculo glassmorphic 38×38 (`background: rgba(255,255,255,0.85), backdrop-filter: blur(8px)`).
  - Derecha: heart (filled, `--color-danger`) + edit, ambos en círculos glass.
- **Dots de paginación:** 3 dots en el bottom de la foto (carrusel multi-foto).
- **Content (px-22):**
  - Eyebrow "ABRIGOS · CAMEL".
  - H1 32px "Abrigo camel / oversize."
  - **Descripción IA:** caja `--color-accent-tint` padding 14px con AIBadge size-lg en la esquina sup-derecha + texto italic 13px entre comillas.
  - Atributos: Temporada / Ocasión / Estilo (chips active, read-only).
  - **Looks relacionados:** divider top + H3 "Usado en 7 looks" + link "Ver todos →" + scroll horizontal de 4 thumbs 80px.
  - **Meta row:** 2 columnas — "Agregada / 14·MAR·25" + "Último uso / 21·MAY·26" (números en mono).
  - **Danger CTA:** botón outlined `--color-danger`, full-width — "Eliminar prenda".
- **Componentes:** `<Heart filled />`, `<GarmentImage />`, `<Chip />`, `<AIBadge />`.

**Layout desktop:**
- Two-column: foto izquierda 50% sticky a `top: 24px`, content derecha scroll. La pagination dots se mueven al pie de la foto.
- Top bar deja de ser flotante y se incrusta arriba del content como breadcrumb.

**Estados:**
- **Vacío:** N/A (sin prenda → 404).
- **Carga:** skeleton del hero + 3 líneas de texto + chips skeleton. Mantener back funcional siempre.
- **Error:** si 404 — pantalla full con "Prenda no encontrada / Volver al guardarropa".
- **Eliminando:** confirm dialog modal (centro): "¿Eliminar esta prenda? / Cancelar / Eliminar" — Eliminar en danger.

**Notas de detalle:**
- Heart toggle es **optimistic**: cambiar el ícono antes de la confirmación del backend; revertir si falla con toast.
- El AIBadge en la descripción es decorativo — la descripción se genera al crear la prenda y se cachea.
- Tap en thumb de look → push a `/looks/[id]`.

---

## 12 · Generador — Configurar
**Ruta:** `/generador`

**Layout mobile:**
- **Header:** wordmark izquierda + eyebrow "PASO 1 / 2" derecha.
- **Hero:** H1 36px "Armemos / tu look." + sub.
- **Weather widget:** card surface con shadow-card, padding 14/16px:
  - Ícono cloud accent 22px en círculo 44px accent-tint.
  - 18° (mono, 24px) + min/max sub.
  - "Parcialmente nublado · Buenos Aires" 11px.
  - Toggle 38×22 a la derecha (incluir clima sí/no).
- **Sección Ocasión:** eyebrow + 6 chips wrap (single-select).
- **Sección Contexto (opcional):** eyebrow + textarea 70px min-height, placeholder o ejemplo en gris.
- **Sección Empezar desde:** eyebrow + 2 tiles (`grid-cols-2 gap-2`):
  - "Desde cero" (active: bg ink, text bg) con ✦ sparkles + label uppercase + sub.
  - "Con base" (default: border line) con hanger icon.
- **Sticky CTA (sobre bottom nav):** `<Button kind="accent" size="lg" icon="sparkles" full>Generar look</Button>` con gradient-mask sobre el bg.
- **Bottom nav:** active="generador".
- **Componentes:** `<WeatherCard />`, `<Chip />`, `<Textarea />`, `<OptionTile />`, `<BottomNav />`.

**Layout desktop:**
- Form en columna central `max-w-[640px]`. Sidebar en lugar de bottom nav.
- Las dos tiles "Desde cero / Con base" pueden quedar en `grid-cols-2` igual.

**Estados:**
- **Vacío:** weather defaults a "—°" hasta tener geolocalización; chips sin selección obligatoria.
- **Carga (clima):** widget muestra spinner inline donde va el "18°".
- **Carga (al generar):** CTA → "Generando…" + spinner; push a `/generador/resultado` al terminar.
- **Error (clima):** widget colapsa a "Clima no disponible" sin romper layout.

**Notas de detalle:**
- Si tap "Con base" → abre bottom sheet de selección de prenda (variante del filtro). Cuando seleccionan, la tile muestra mini-thumb de la prenda elegida.
- El gradient-mask del sticky CTA evita el corte hard: `background: linear-gradient(0deg, var(--color-bg) 60%, transparent)`.

---

## 13 · Generador — Resultado
**Ruta:** `/generador/resultado`

**Layout mobile:**
- **Top bar:** back + eyebrow "LOOK · v3 / 5" (versión / total) + refresh.
- **Title block:**
  - AIBadge size-lg + meta "· trabajo · 18° · 4 piezas".
  - H1 32px "Sastre & / camel."
  - Sub 13px italic entre comillas — la justificación de la IA.
- **Version stepper:** prev arrow + 5 bars (active = ink, inactive = line) + next arrow. Tap en una bar salta a esa versión.
- **Grid de piezas:** `grid-cols-2 gap-2 px-5`. Cada celda:
  - Foto aspect 4/5.
  - Botón swap 30×30 absolute top-right, círculo glass.
  - Footer 8/10px: eyebrow categoría + nombre display 12px (truncate).
- **Hint strip:** card surface 12px padding — ícono sparkles + texto "Tocá [swap icon] en cualquier prenda para ver alternativas."
- **Sticky bottom actions:** ghost "Otro" (flex 1, icon refresh) + primary "Guardar look" (flex 1.4).
- **Bottom nav:** active="generador".

**Layout desktop:**
- Grid: `md:grid-cols-4` (todos visibles en una fila), proporción de tile sube.
- Bottom actions dejan de ser sticky.

**Estados:**
- **Vacío:** N/A (si no hay base, redirigir al `config`).
- **Carga (al pedir otra versión):** el grid hace fade-out → spinner overlay → fade-in con nuevo look. Stepper actualizado.
- **Error:** card con "No pudimos generar este look. Reintentar" reemplazando el grid.
- **Swap loading:** al tocar swap, la tile específica hace skeleton mientras carga alternativa.

**Notas de detalle:**
- Las versiones son **cachadas** en cliente — el stepper navega entre ellas sin refetch.
- `"Otro"` genera una versión nueva (consume cuota IA); `swap` por pieza no consume cuota nueva.
- Tap en una pieza → push detalle de prenda con back que vuelve acá manteniendo la versión.

---

## 14 · Guardar look (bottom sheet)
**Ruta:** `/generador/resultado?save=open` (preferir estado local).

**Layout mobile:**
- **Backdrop:** `rgba(0,0,0,0.45)` cubre.
- **Sheet:** mismo patrón que filtros — bordes redondeados arriba 20px, padding 16/22/28, shadow-modal, drag handle pill.
- **Header:** H2 24px "Guardar look" + close (×).
- **Collage:** 4 thumbs side-by-side (aspect 3/4 cada uno), gap 6px.
- **Input:** "Nombre del look" pre-lleno (la IA propone el nombre).
- **Fecha de uso:** eyebrow + row con ícono calendar + fecha mono `22 · MAY · 2026` + sub "Hoy". Tap abre date picker nativo.
- **CTA:** primary lg full "Confirmar".

**Layout desktop:**
- Dialog centrado `max-w-[440px]`, no es bottom sheet.

**Estados:**
- **Vacío:** N/A — los valores vienen pre-llenos.
- **Carga:** CTA → "Guardando…"; al terminar, toast `success` "Look guardado" + cierra sheet + queda en el resultado.
- **Error:** inline error en el campo nombre si está vacío. Toast `error` para fallas de red.

**Notas de detalle:**
- Si la fecha es **futura**, el look queda como "planificado" — el contador de usos no se incrementa hasta esa fecha.
- Después de guardar, **no** redirigir automáticamente al historial — quedarse en el resultado para que pueda seguir explorando.

---

## 15 · Historial de looks
**Ruta:** `/looks`

**Layout mobile:**
- **Header:** wordmark + ícono search; row 2 con H1 36px "Looks" + contador `23 / guardados` mono.
- **Filter row:** 3 chips size-sm — "Recientes" (active) / "Más usados" / "Por ocasión".
- **Lista (scroll vertical):** cada `<LookCard variant="row" />`:
  - Collage 2×2 88×88 izquierda (4 thumbs cuadrados).
  - Centro: H3 17px nombre del look uppercase + meta `ÚLTIMO USO · 20·MAY·26` 11px mono + chip "3 usos".
  - Derecha: chevron forward.
  - Divider 1px `--color-line-2` entre rows (no en la primera).
- **Bottom nav:** active="looks".
- **Componentes:** `<LookCard variant="row" />`, `<Chip />`, `<BottomNav />`.

**Layout desktop:**
- `<LookCard variant="tile" />` en grid `md:grid-cols-3 lg:grid-cols-4`. Collage más grande, meta debajo.
- Sidebar reemplaza bottom nav.

**Estados:**
- **Vacío:** "Todavía no guardaste looks. / Generá tu primer look →" con ilustración de 4 prendas y CTA al generador.
- **Carga:** `<LookListSkeleton count={5} />` — rows con collage y texto pulsantes.
- **Error:** banner inline arriba de la lista con "Reintentar".

**Notas de detalle:**
- El collage 2×2 usa `grid-template-columns: 1fr 1fr` + `gap: 1px` y `background: var(--color-surface-2)` para que se vea la línea entre fotos.
- Si un look tiene > 4 prendas, mostrar las 4 primeras; si tiene < 4, completar con celdas vacías en `--color-surface-2`.
- Pull-to-refresh en mobile.

---

## 16 · Configuración / Perfil
**Ruta:** `/perfil`

**Layout mobile:**
- **Header:** solo wordmark, sin H1 (la página tiene el bloque perfil grande como hero).
- **Perfil head:** avatar circular 68px con iniciales en accent + bloque texto:
  - H2 24px "Sofía Marini".
  - Email 12px ink-3.
  - Stats row: `47 / prendas` + `23 / looks` (números mono 15px).
- **Sections (cada una con eyebrow padding-lateral + lista):**
  - **UBICACIÓN:** row Ciudad → "Buenos Aires, AR" + chevron.
  - **ESTILO:** chips wrap de estilos favoritos (multi-select).
  - **APP:** Tema (value "Claro" + chevron), Clima en generador (toggle on), Notificaciones (toggle off).
  - **CUENTA:** Cerrar sesión (no chevron), Eliminar cuenta (danger, no chevron).
- **Footer:** texto eyebrow 10px centrado "LookSi · v0.4.2 · BETA".
- **Bottom nav:** active="perfil".
- **Componentes:** `<SettingsSection />`, `<SettingsRow icon label value? toggle? danger? />`, `<Chip />`, `<BottomNav />`.

**Layout desktop:**
- Sidebar persistente. El bloque perfil-head se centra en card top-left; las sections quedan en una sola columna `max-w-[680px]`.
- Toggle "Tema" puede pasar a un segmented control inline (Claro / Oscuro / Sistema) en desktop, porque hay más ancho.

**Estados:**
- **Vacío:** N/A (siempre hay usuario logueado).
- **Carga:** skeleton del avatar + 2 líneas + 4 rows.
- **Error:** los toggles individuales hacen optimistic update; si falla, revertir + toast `error`.

**Notas de detalle:**
- "Eliminar cuenta" abre dialog full con confirmación tipeando el email — destrucción irreversible.
- Tap en Tema abre un mini-action-sheet con 3 opciones (Claro / Oscuro / Auto del sistema).
- El avatar usa **iniciales** si no hay foto subida; si hay foto, reemplaza.

---

## Sistema · Reglas globales

**Espaciados base** (escala 4px):
- Padding pantalla mobile: `px-5` (20px) general; `px-[22px]` o `px-6` para contenido editorial.
- Padding pantalla desktop: `px-10` general, `max-w-[1180px]` para shells.
- Gap vertical entre secciones: `mb-5 (20px)` a `mb-7 (28px)`.

**Interacciones globales:**
- **Tap feedback:** todos los botones e ítems clickeables `active:scale-[0.985]` con `transition-transform 120ms`.
- **Hover** (desktop only): bg shift sutil (`hover:bg-[--color-line-2]`) en list rows.
- **Focus:** outline 2px `--color-accent` offset 2px en todos los elementos foco-ables (a11y).
- **View transitions:** Next 16 nativo entre pantallas — el FAB → form crece desde el botón hasta full screen.

**Animaciones recurrentes:**
- Bottom sheets: `translateY(100%) → 0` en 280ms `cubic-bezier(0.32, 0.72, 0, 1)`.
- Backdrops: opacity 0 → target en 200ms.
- Toast: slide-up desde bottom + fade, autodismiss 3.5s.

**A11y mínimo:**
- Touch targets ≥ 44px.
- Contraste AA en todos los pares texto/fondo (ya garantizado por tokens).
- Todos los íconos clickeables con `aria-label`.
- `prefers-reduced-motion: reduce` desactiva todas las transiciones excepto opacity.
