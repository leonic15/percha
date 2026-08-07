"use client";

/**
 * EditGarmentClient — PERCHA-011 (LSI-21) · EDITAR PRENDA
 * Ruta: /guardarropas/[id]/editar
 *
 * Criterios de aceptación:
 *  1. Formulario pre-completado con valores actuales de la prenda
 *  2. Guardar cambios → PATCH /api/garments/[id] → redirect al detalle
 *  3. Reemplazar imagen → preview antes de guardar
 *  4. Sin cambios → no llama a la API, vuelve al detalle
 *  5. Cancelar → descarta cambios, vuelve al detalle
 *  6. Error → toast + posibilidad de reintentar
 */

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera } from "lucide-react";
import { Input, Textarea, Chip, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { Category, Prenda } from "@/lib/database.types";

// ── Constantes (mismas que AddFormClient) ─────────────────────────────────────

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

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface EditGarmentClientProps {
  garment: Prenda & {
    signedUrl: string | null;
    categorySlug: string | null;
  };
  categories: Category[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toggleArr(arr: string[], v: string) {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

/** Convierte File a dataURL para mostrar preview */
function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Componente ────────────────────────────────────────────────────────────────

export function EditGarmentClient({ garment, categories }: EditGarmentClientProps) {
  const router   = useRouter();
  const { toast } = useToast();

  // ── Estado inicial (snapshot para detectar cambios) ───────────────────────
  const initial = {
    nombre:       garment.nombre,
    categorySlug: garment.categorySlug ?? "",
    colorNombre:  garment.color_principal ?? "",
    estaciones:   garment.estaciones ?? [],
    ocasiones:    garment.ocasiones ?? [],
    estilos:      garment.estilos ?? [],
    notas:        garment.notas ?? "",
  };

  // ── Form state ────────────────────────────────────────────────────────────
  const [nombre,       setNombre]       = useState(initial.nombre);
  const [categorySlug, setCategorySlug] = useState(initial.categorySlug);
  const [colorNombre,  setColorNombre]  = useState(initial.colorNombre);
  const [colorHex,     setColorHex]     = useState(
    // Intentar encontrar el hex del color actual en la paleta
    COLORS.find((c) => c.nombre === initial.colorNombre)?.hex ?? ""
  );
  const [estaciones,  setEstaciones]  = useState<string[]>(initial.estaciones);
  const [ocasiones,   setOcasiones]   = useState<string[]>(initial.ocasiones);
  const [estilos,     setEstilos]     = useState<string[]>(initial.estilos);
  const [notas,       setNotas]       = useState(initial.notas);

  // ── Imagen ────────────────────────────────────────────────────────────────
  const [newImageFile,    setNewImageFile]    = useState<File | null>(null);
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayImage = newImagePreview ?? garment.signedUrl;

  // ── UI state ──────────────────────────────────────────────────────────────
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [nameError,       setNameError]       = useState("");
  const [loading,         setLoading]         = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  // ── Detección de cambios ──────────────────────────────────────────────────
  const hasChanges = useCallback((): boolean => {
    if (newImageFile)                   return true;
    if (nombre        !== initial.nombre)       return true;
    if (categorySlug  !== initial.categorySlug) return true;
    if (colorNombre   !== initial.colorNombre)  return true;
    if (notas         !== initial.notas)        return true;
    if (JSON.stringify([...estaciones].sort()) !== JSON.stringify([...initial.estaciones].sort())) return true;
    if (JSON.stringify([...ocasiones].sort())  !== JSON.stringify([...initial.ocasiones].sort()))  return true;
    if (JSON.stringify([...estilos].sort())    !== JSON.stringify([...initial.estilos].sort()))    return true;
    return false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nombre, categorySlug, colorNombre, estaciones, ocasiones, estilos, notas, newImageFile]);

  // ── Imagen: selección ─────────────────────────────────────────────────────
  const handleImageChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNewImageFile(file);
    const preview = await fileToDataURL(file);
    setNewImagePreview(preview);
  }, []);

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!nombre.trim()) {
      setNameError("El nombre es obligatorio.");
      nameRef.current?.focus();
      return;
    }
    if (!categorySlug) {
      toast.error("Seleccioná el tipo de prenda.");
      return;
    }

    // Escenario 4: sin cambios → volver sin llamar a la API
    if (!hasChanges()) {
      router.push(`/guardarropas/${garment.id}`);
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("nombre",          nombre.trim());
      fd.append("category_slug",   categorySlug);
      if (colorNombre) fd.append("color_principal", colorNombre);
      fd.append("estaciones",      JSON.stringify(estaciones));
      fd.append("ocasiones",       JSON.stringify(ocasiones));
      fd.append("estilos",         JSON.stringify(estilos));
      if (notas.trim()) fd.append("notas", notas.trim());
      else fd.append("notas", "");

      if (newImageFile) fd.append("imagen", newImageFile);

      const res  = await fetch(`/api/garments/${garment.id}`, {
        method: "PATCH",
        body:   fd,
      });
      const data = await res.json();

      if (!res.ok) {
        const msgs: Record<string, string> = {
          nombre_requerido:     "El nombre es obligatorio.",
          tipo_imagen_invalido: "Tipo de imagen no soportado.",
          upload_error:         "Error al subir la imagen. Intentá de nuevo.",
          no_session:           "Tu sesión expiró. Recargá la página.",
          not_found:            "Prenda no encontrada.",
          db_error:             "Error al guardar. Intentá de nuevo.",
        };
        toast.error(msgs[data.error] ?? "Ocurrió un error. Intentá de nuevo.");
        return;
      }

      toast.success("Cambios guardados");
      router.push(`/guardarropas/${garment.id}`);
      router.refresh();

    } catch {
      toast.error("Error de red. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }, [
    nombre, categorySlug, colorNombre, estaciones, ocasiones, estilos,
    notas, newImageFile, garment.id, hasChanges, router, toast,
  ]);

  // ── Cancelar ──────────────────────────────────────────────────────────────
  const handleCancel = useCallback(() => {
    router.push(`/guardarropas/${garment.id}`);
  }, [garment.id, router]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-dvh bg-bg">

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 shrink-0">
        <button
          type="button"
          aria-label="Cancelar"
          onClick={handleCancel}
          className="grid place-items-center size-9 rounded-full text-ink-2 hover:bg-surface-2 transition-colors"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </button>
        <span className="eyebrow">EDITAR PRENDA</span>
        {/* Cancelar texto en desktop */}
        <button
          type="button"
          onClick={handleCancel}
          disabled={loading}
          className="text-sm text-ink-2 hover:text-ink transition-colors disabled:opacity-50 md:block hidden"
        >
          Cancelar
        </button>
        {/* Placeholder para alinear en mobile */}
        <div className="size-9 md:hidden" />
      </div>

      {/* ── Preview de imagen ────────────────────────────────────────────── */}
      <div className="px-5 pb-5 flex gap-3.5 shrink-0">
        <div className="relative shrink-0" style={{ width: 110 }}>
          <div
            style={{
              width: 110,
              aspectRatio: "3/4",
              background: "var(--color-stone-100, #f1ede4)",
              overflow: "hidden",
              position: "relative",
            }}
          >
            {displayImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={displayImage}
                alt="Vista previa de la prenda"
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            ) : (
              <div className="w-full h-full grid place-items-center">
                <Camera className="size-8 text-ink-3" strokeWidth={1.2} />
              </div>
            )}

            {/* Overlay "Cambiar foto" */}
            <button
              type="button"
              aria-label="Cambiar foto"
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "absolute inset-0 flex flex-col items-center justify-center gap-1",
                "bg-black/40 text-white opacity-0 hover:opacity-100",
                "transition-opacity duration-150",
              )}
            >
              <Camera className="size-5" strokeWidth={1.4} />
              <span className="text-[10px] font-medium uppercase tracking-wide">Cambiar</span>
            </button>
          </div>

          {/* Indicador de nueva imagen seleccionada */}
          {newImageFile && (
            <div className="mt-1 text-[10px] text-accent text-center font-medium uppercase tracking-wide">
              Nueva foto ✓
            </div>
          )}
        </div>

        <div className="flex-1 pt-1">
          <h2
            className="font-display font-semibold uppercase text-ink"
            style={{ fontSize: 22, lineHeight: 1.05, letterSpacing: "-0.01em", marginBottom: 6 }}
          >
            Editá la prenda.
          </h2>
          <p className="text-ink-3" style={{ fontSize: 12 }}>
            Modificá los campos que necesites. Toca la foto para reemplazarla.
          </p>
        </div>
      </div>

      {/* Input de archivo oculto */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={handleImageChange}
        aria-hidden
      />

      {/* ── Formulario (scrollable) ───────────────────────────────────────── */}
      <div
        className="flex-1 overflow-y-auto px-5"
        style={{ paddingBottom: "120px" }}
      >
        <div className="flex flex-col gap-5">

          {/* Nombre */}
          <Input
            ref={nameRef}
            label="Nombre"
            placeholder="Ej: Blusa de lino crema"
            value={nombre}
            error={nameError}
            onChange={(e) => { setNombre(e.target.value); setNameError(""); }}
          />

          {/* Tipo de prenda */}
          <div>
            <div className="mb-2">
              <span className="eyebrow">Tipo de prenda</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => (
                <Chip
                  key={cat.id}
                  size="sm"
                  active={categorySlug === cat.slug}
                  onClick={() => setCategorySlug(cat.slug)}
                >
                  {cat.nombre}
                </Chip>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <div className="mb-2">
              <span className="eyebrow">Color</span>
            </div>
            <div className="relative flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowColorPicker((v) => !v)}
                aria-label="Cambiar color"
                style={{
                  width: 22, height: 22, borderRadius: 999,
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
                onClick={() => setShowColorPicker((v) => !v)}
                className="text-xs text-ink-3 hover:text-ink transition-colors"
              >
                Cambiar →
              </button>

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
                        }}
                        style={{
                          width: 28, height: 28, borderRadius: 999,
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
            <div className="mb-2">
              <span className="eyebrow">Temporada</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SEASONS.map((s) => (
                <Chip
                  key={s.value}
                  size="sm"
                  active={estaciones.includes(s.value)}
                  onClick={() => setEstaciones(toggleArr(estaciones, s.value))}
                >
                  {s.label}
                </Chip>
              ))}
            </div>
          </div>

          {/* Ocasión */}
          <div>
            <div className="mb-2">
              <span className="eyebrow">Ocasión</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {OCCASIONS.map((o) => (
                <Chip
                  key={o.value}
                  size="sm"
                  active={ocasiones.includes(o.value)}
                  onClick={() => setOcasiones(toggleArr(ocasiones, o.value))}
                >
                  {o.label}
                </Chip>
              ))}
            </div>
          </div>

          {/* Estilo */}
          <div>
            <div className="mb-2">
              <span className="eyebrow">Estilo</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {STYLES.map((s) => (
                <Chip
                  key={s.value}
                  size="sm"
                  active={estilos.includes(s.value)}
                  onClick={() => setEstilos(toggleArr(estilos, s.value))}
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

      {/* ── Botones sticky ───────────────────────────────────────────────── */}
      <div
        className={cn(
          "fixed inset-x-0 z-20 bg-bg border-t border-line-2 px-5 py-3",
          "bottom-[calc(60px+max(env(safe-area-inset-bottom),16px))] md:bottom-0",
        )}
      >
        <div className="flex gap-3">
          {/* Cancelar — visible en mobile también */}
          <button
            type="button"
            onClick={handleCancel}
            disabled={loading}
            className={cn(
              "h-13 px-5 rounded-button border border-line",
              "text-sm font-medium uppercase tracking-wide text-ink",
              "hover:bg-surface-2 active:scale-[0.985] transition-all",
              "disabled:opacity-50 disabled:pointer-events-none",
            )}
          >
            Cancelar
          </button>

          {/* Guardar cambios */}
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className={cn(
              "flex-1 h-13 rounded-button",
              "flex items-center justify-center gap-2",
              "text-sm font-medium uppercase tracking-wide",
              "bg-accent text-accent-ink",
              "hover:bg-sage-700 active:scale-[0.985] transition-all",
              "disabled:opacity-50 disabled:pointer-events-none",
            )}
          >
            {loading ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}
