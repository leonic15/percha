"use client";

/**
 * AddFormClient — Paso 3: Form de revisión con datos de IA.
 * Spec 10 · /guardarropas/nueva/formulario
 *
 * Lee imagen + análisis IA de sessionStorage.
 * Muestra formulario prefillado; los badges "✦ IA" desaparecen al editar.
 * Al guardar llama a POST /api/garments y redirige al guardarropas.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Input, Textarea, Chip, Badge, useToast } from "@/components/ui";
import type { Category } from "@/lib/database.types";
import type { GarmentAnalysis } from "@/app/api/prendas/analizar/route";
import { cn } from "@/lib/cn";

// ── Constantes ─────────────────────────────────────────────────────────────────

const SS_IMAGE_KEY = "looksi_nueva_imagen";
const SS_TYPE_KEY  = "looksi_nueva_tipo";
const SS_IA_KEY    = "looksi_nueva_ia";
const SS_NOBG_KEY  = "looksi_nueva_imagen_nobg"; // PNG sin fondo generado en el paso 2

const SEASONS = [
  { value: "primavera",   label: "Primavera"   },
  { value: "verano",      label: "Verano"      },
  { value: "otoño",       label: "Otoño"       },
  { value: "invierno",    label: "Invierno"    },
  { value: "todo_el_año", label: "Todo el año" },
] as const;

const OCCASIONS = [
  { value: "casual",  label: "Casual"  },
  { value: "trabajo", label: "Trabajo" },
  { value: "formal",  label: "Formal"  },
  { value: "deporte", label: "Deporte" },
  { value: "salida",  label: "Salida"  },
] as const;

const STYLES = [
  { value: "casual",    label: "Casual"    },
  { value: "clasico",   label: "Clásico"   },
  { value: "deportivo", label: "Deportivo" },
  { value: "elegante",  label: "Elegante"  },
  { value: "bohemio",   label: "Bohemio"   },
  { value: "urbano",    label: "Urbano"    },
] as const;

/**
 * Categorías hardcodeadas — coinciden EXACTAMENTE con el seed.sql.
 * Se usan como fallback si el server no devuelve categorías (DB no seeded todavía).
 * Se trabaja SIEMPRE con el slug; el server resuelve slug → id.
 */
const FALLBACK_CATEGORIES: Category[] = [
  { id: 1, nombre: "Tops",                    slug: "tops"                    },
  { id: 2, nombre: "Pantalones y Shorts",     slug: "pantalones-y-shorts"     },
  { id: 3, nombre: "Vestidos y Faldas",       slug: "vestidos-y-faldas"       },
  { id: 4, nombre: "Calzado",                 slug: "calzado"                 },
  { id: 5, nombre: "Abrigos y Chaquetas",     slug: "abrigos-y-chaquetas"     },
  { id: 6, nombre: "Ropa Interior y Pijamas", slug: "ropa-interior-y-pijamas" },
  { id: 7, nombre: "Accesorios",              slug: "accesorios"              },
  { id: 8, nombre: "Otros",                   slug: "otros"                   },
];

// Paleta de colores para el mini-picker (12 colores)
const COLORS = [
  { nombre: "Blanco",       hex: "#f3efe5" },
  { nombre: "Crudo",        hex: "#ece3d2" },
  { nombre: "Arena",        hex: "#d6c5a8" },
  { nombre: "Camel",        hex: "#c2a079" },
  { nombre: "Negro",        hex: "#262522" },
  { nombre: "Gris",         hex: "#8a8273" },
  { nombre: "Terracota",    hex: "#b56b4a" },
  { nombre: "Rosa",         hex: "#e6cfc9" },
  { nombre: "Azul jean",    hex: "#8a9aa8" },
  { nombre: "Azul marino",  hex: "#3d4858" },
  { nombre: "Verde oliva",  hex: "#6b7563" },
  { nombre: "Chocolate",    hex: "#5e4a39" },
] as const;

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface AddFormClientProps {
  categories: Category[];
}

// ── Componente ─────────────────────────────────────────────────────────────────

export function AddFormClient({ categories: serverCategories }: AddFormClientProps) {
  const router = useRouter();
  const { toast } = useToast();

  // Usar categorías del server; si están vacías (DB sin seed), usar fallback
  const categories = serverCategories.length > 0 ? serverCategories : FALLBACK_CATEGORIES;

  // ── Datos de sessionStorage ─────────────────────────────────────────────
  const [imageURL,   setImageURL]   = useState<string | null>(null);
  const [nobgURL,    setNobgURL]    = useState<string | null>(null); // PNG sin fondo
  const [analysis,   setAnalysis]   = useState<GarmentAnalysis | null>(null);
  const [ready,      setReady]      = useState(false);

  useEffect(() => {
    const dataURL = sessionStorage.getItem(SS_IMAGE_KEY);
    if (!dataURL) {
      router.replace("/guardarropas/nueva");
      return;
    }
    const nobg  = sessionStorage.getItem(SS_NOBG_KEY);
    if (nobg)  setNobgURL(nobg);
    const iaRaw = sessionStorage.getItem(SS_IA_KEY);
    const ia: GarmentAnalysis | null = iaRaw && iaRaw !== "null"
      ? JSON.parse(iaRaw)
      : null;

    setImageURL(dataURL);
    setAnalysis(ia);

    // Pre-fill form with AI data
    if (ia) {
      setNombre(ia.nombre ?? "");
      setColorNombre(ia.color_nombre ?? "");
      setColorHex(ia.color_hex ?? "");
      setEstaciones(ia.estaciones ?? []);
      setOcasiones(ia.ocasiones ?? []);
      setEstilos(ia.estilos ?? []);
      // Usar slug directamente — no hace falta resolver a ID todavía
      if (ia.categoria_slug) setCategorySlug(ia.categoria_slug);
      // Marcar todos los campos como "fuente IA"
      setAiFields({
        nombre:     Boolean(ia.nombre),
        categoria:  Boolean(ia.categoria_slug),
        color:      Boolean(ia.color_nombre),
        estaciones: Boolean(ia.estaciones?.length),
        ocasiones:  Boolean(ia.ocasiones?.length),
        estilos:    Boolean(ia.estilos?.length),
      });
    }
    setReady(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Estado del formulario ───────────────────────────────────────────────
  const [nombre,        setNombre]       = useState("");
  // Trabajamos con slug — el server resuelve slug → id al guardar
  const [categorySlug,  setCategorySlug] = useState<string>("");
  const [colorNombre, setColorNombre] = useState("");
  const [colorHex,    setColorHex]    = useState("");
  const [estaciones,  setEstaciones]  = useState<string[]>([]);
  const [ocasiones,   setOcasiones]   = useState<string[]>([]);
  const [estilos,     setEstilos]     = useState<string[]>([]);
  const [notas,       setNotas]       = useState("");
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Rastreo de qué campos siguen siendo "fuente IA" (badge desaparece al editar)
  const [aiFields, setAiFields] = useState<Record<string, boolean>>({});
  function clearAI(field: string) {
    setAiFields((prev) => ({ ...prev, [field]: false }));
  }

  // ── UI ─────────────────────────────────────────────────────────────────
  const [loading,   setLoading]   = useState(false);
  const [nameError, setNameError] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  const hasAI = analysis !== null;

  // ── Toggle arrays ──────────────────────────────────────────────────────
  function toggleArr(arr: string[], value: string) {
    return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
  }

  // ── Submit ─────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!nombre.trim()) {
      setNameError("El nombre es obligatorio.");
      nameRef.current?.focus();
      return;
    }
    if (!categorySlug) {
      toast.error("Seleccioná el tipo de prenda.");
      return;
    }
    if (!imageURL) {
      router.replace("/guardarropas/nueva");
      return;
    }

    setLoading(true);
    try {
      // Usar imagen sin fondo si está disponible; si no, la original comprimida
      const uploadURL = nobgURL ?? imageURL;
      const mimeFromURL = uploadURL.match(/^data:([\w/+.-]+);base64,/)?.[1];
      // nobgURL siempre es PNG; imagen original: leer del data URL o sessionStorage
      const mimeType = mimeFromURL || sessionStorage.getItem(SS_TYPE_KEY) || "image/jpeg";
      const blob     = dataURLtoBlob(uploadURL, mimeType);
      const ext      = mimeType === "image/png" ? "png" : "jpg";
      const file     = new File([blob], `prenda.${ext}`, { type: mimeType });

      const fd = new FormData();
      fd.append("nombre",          nombre.trim());
      fd.append("category_slug",   categorySlug);   // el server resuelve slug → id
      if (colorNombre) fd.append("color_principal", colorNombre);
      fd.append("estaciones",   JSON.stringify(estaciones));
      fd.append("estilos",      JSON.stringify(estilos));
      fd.append("ocasiones",    JSON.stringify(ocasiones));
      if (notas.trim()) fd.append("notas", notas.trim());
      fd.append("imagen",       file);

      // Datos de IA
      if (hasAI) {
        fd.append("ia_analizada",  "true");
        if (analysis?.descripcion) fd.append("ia_descripcion", analysis.descripcion);
      }

      const res  = await fetch("/api/garments", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok) {
        const msgs: Record<string, string> = {
          nombre_requerido:    "El nombre es obligatorio.",
          categoria_requerida: "Seleccioná el tipo de prenda.",
          imagen_requerida:    "La foto es obligatoria.",
          tipo_imagen_invalido: "Tipo de imagen no soportado.",
          upload_error:        "Error al subir la imagen. Intentá de nuevo.",
          no_session:          "Tu sesión expiró. Recargá la página.",
        };
        toast.error(msgs[data.error] ?? "Ocurrió un error. Intentá de nuevo.");
        return;
      }

      // Limpiar sessionStorage
      sessionStorage.removeItem(SS_IMAGE_KEY);
      sessionStorage.removeItem(SS_TYPE_KEY);
      sessionStorage.removeItem(SS_IA_KEY);
      sessionStorage.removeItem(SS_NOBG_KEY);

      toast.success("¡Prenda guardada!");
      router.push("/guardarropas");
      router.refresh();

    } catch (err) {
      console.error("[formulario] Submit error:", err);
      toast.error("Error de red. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  // "Saltar" guarda con los valores actuales (no descarta)
  function handleSkip() {
    handleSubmit();
  }

  function retryAnalysis() {
    sessionStorage.removeItem(SS_IA_KEY);
    router.push("/guardarropas/nueva/analizar");
  }

  // ── Render ─────────────────────────────────────────────────────────────
  if (!ready) return null; // evitar flash antes de leer sessionStorage

  return (
    <div className="flex flex-col min-h-dvh bg-bg">
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 shrink-0">
        <button
          type="button"
          aria-label="Volver"
          onClick={() => router.back()}
          className="grid place-items-center size-9 rounded-full text-ink-2 hover:bg-surface-2 transition-colors"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </button>
        <span className="eyebrow">REVISAR · GUARDAR</span>
        <button
          type="button"
          onClick={handleSkip}
          disabled={loading}
          className="text-sm text-accent hover:underline disabled:opacity-50"
        >
          Saltar
        </button>
      </div>

      {/* ── Preview + estado ─────────────────────────────────────────────── */}
      <div className="px-5 pb-5 flex gap-3.5 shrink-0">
        <div
          style={{ width: 110, flexShrink: 0, background: "var(--color-stone-100, #f1ede4)" }}
          className="overflow-hidden"
        >
          {(nobgURL ?? imageURL) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={nobgURL ?? imageURL ?? ""}
              alt="Vista previa de la prenda"
              style={{ width: "100%", aspectRatio: "3/4", objectFit: "contain", display: "block" }}
            />
          )}
        </div>
        <div className="flex-1 pt-1">
          <h2
            className="font-display font-semibold uppercase text-ink"
            style={{ fontSize: 22, lineHeight: 1.05, letterSpacing: "-0.01em", marginBottom: 6 }}
          >
            {hasAI ? "Análisis\ncompleto." : "Completá\nlos datos."}
          </h2>
          <p className="text-sm text-ink-2 mb-2.5" style={{ fontSize: 12 }}>
            {hasAI
              ? "Revisá y editá lo que la IA sugirió."
              : "La IA no pudo analizar la foto."}
          </p>
          <button
            type="button"
            onClick={retryAnalysis}
            className="text-ink-2 flex items-center gap-1 hover:text-ink transition-colors"
            style={{ fontSize: 11, textDecoration: "underline", textUnderlineOffset: 3 }}
          >
            <RefreshCw className="size-3" aria-hidden />
            Reintentar análisis
          </button>
        </div>
      </div>

      {/* ── Formulario (scrollable) ───────────────────────────────────────── */}
      <div
        className="flex-1 overflow-y-auto px-5"
        style={{ paddingBottom: "120px" }} // espacio para el botón fijo
      >
        <div className="flex flex-col gap-5">

          {/* Nombre */}
          <Input
            ref={nameRef}
            label="Nombre"
            ai={aiFields.nombre}
            placeholder="Ej: Blusa de lino crema"
            value={nombre}
            error={nameError}
            onChange={(e) => {
              setNombre(e.target.value);
              setNameError("");
              clearAI("nombre");
            }}
          />

          {/* Tipo de prenda */}
          <div>
            <div className="mb-2 flex items-center gap-1.5">
              <span className="eyebrow">Tipo de prenda</span>
              {aiFields.categoria && <Badge variant="ai" />}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => (
                <Chip
                  key={cat.id}
                  size="sm"
                  active={categorySlug === cat.slug}
                  onClick={() => { setCategorySlug(cat.slug); clearAI("categoria"); }}
                >
                  {cat.nombre}
                </Chip>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <div className="mb-2 flex items-center gap-1.5">
              <span className="eyebrow">Color</span>
              {aiFields.color && <Badge variant="ai" />}
            </div>
            <div className="relative flex items-center gap-2.5">
              {/* Swatch */}
              <button
                type="button"
                onClick={() => setShowColorPicker((v) => !v)}
                aria-label="Cambiar color"
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  background: colorHex || "var(--color-stone-200)",
                  border: "1px solid var(--color-line)",
                  flexShrink: 0,
                }}
              />
              <span className="text-sm text-ink flex-1">
                {colorNombre || <span className="text-ink-3">Sin color</span>}
              </span>
              <button
                type="button"
                onClick={() => { setShowColorPicker((v) => !v); clearAI("color"); }}
                className="text-xs text-ink-3 hover:text-ink transition-colors"
              >
                Cambiar →
              </button>

              {/* Mini-picker de colores */}
              {showColorPicker && (
                <div
                  className="absolute left-0 top-full mt-2 z-20 p-3 bg-surface rounded-xl border border-line shadow-card"
                  style={{ minWidth: 220 }}
                >
                  <div className="grid grid-cols-6 gap-2">
                    {COLORS.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        aria-label={c.nombre}
                        title={c.nombre}
                        onClick={() => {
                          setColorNombre(c.nombre);
                          setColorHex(c.hex);
                          setShowColorPicker(false);
                          clearAI("color");
                        }}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 999,
                          background: c.hex,
                          border: colorHex === c.hex
                            ? "2px solid var(--color-ink)"
                            : "1px solid var(--color-line)",
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Temporada */}
          <div>
            <div className="mb-2 flex items-center gap-1.5">
              <span className="eyebrow">Temporada</span>
              {aiFields.estaciones && <Badge variant="ai" />}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SEASONS.map((s) => (
                <Chip
                  key={s.value}
                  size="sm"
                  active={estaciones.includes(s.value)}
                  onClick={() => { setEstaciones(toggleArr(estaciones, s.value)); clearAI("estaciones"); }}
                >
                  {s.label}
                </Chip>
              ))}
            </div>
          </div>

          {/* Ocasión */}
          <div>
            <div className="mb-2 flex items-center gap-1.5">
              <span className="eyebrow">Ocasión</span>
              {aiFields.ocasiones && <Badge variant="ai" />}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {OCCASIONS.map((o) => (
                <Chip
                  key={o.value}
                  size="sm"
                  active={ocasiones.includes(o.value)}
                  onClick={() => { setOcasiones(toggleArr(ocasiones, o.value)); clearAI("ocasiones"); }}
                >
                  {o.label}
                </Chip>
              ))}
            </div>
          </div>

          {/* Estilo */}
          <div>
            <div className="mb-2 flex items-center gap-1.5">
              <span className="eyebrow">Estilo</span>
              {aiFields.estilos && <Badge variant="ai" />}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {STYLES.map((s) => (
                <Chip
                  key={s.value}
                  size="sm"
                  active={estilos.includes(s.value)}
                  onClick={() => { setEstilos(toggleArr(estilos, s.value)); clearAI("estilos"); }}
                >
                  {s.label}
                </Chip>
              ))}
            </div>
          </div>

          {/* Notas */}
          <Textarea
            label="Notas"
            placeholder="Regalo de mamá, ocasión especial, talle, etc."
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={3}
            maxLength={500}
          />

        </div>
      </div>

      {/* ── Botón sticky "Guardar prenda" ─────────────────────────────────── */}
      <div
        className={cn(
          "fixed inset-x-0 z-20",
          "bg-bg border-t border-line-2",
          "px-5 py-3",
          // Sobre el BottomNav en mobile; pegado abajo en desktop
          "bottom-[calc(60px+max(env(safe-area-inset-bottom),16px))] md:bottom-0",
        )}
      >
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className={cn(
            "w-full h-13 rounded-button",
            "flex items-center justify-center gap-2",
            "text-sm font-medium uppercase tracking-wide",
            "bg-accent text-accent-ink",
            "hover:bg-sage-700 active:scale-[0.985] transition-all",
            "disabled:opacity-50 disabled:pointer-events-none",
          )}
        >
          {loading ? "Guardando…" : "Guardar prenda"}
        </button>
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Convierte un data URL base64 a Blob sin usar fetch().
 * fetch(dataURL) falla en iOS Safari con "TypeError: Load failed".
 */
function dataURLtoBlob(dataURL: string, fallbackMime = "image/jpeg"): Blob {
  const [header, b64] = dataURL.split(",");
  const mime = header.match(/:(.*?);/)?.[1] ?? fallbackMime;
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}
