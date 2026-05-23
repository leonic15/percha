"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import imageCompression from "browser-image-compression";
import { Camera, ImagePlus, X, Loader2 } from "lucide-react";
import { Button, Chip, Input, Textarea } from "@/components/ui";
import type { Category, Subcategory } from "@/lib/database.types";
import { cn } from "@/lib/cn";

// ── Tipos ────────────────────────────────────────────────────────────────────

interface AddGarmentFormProps {
  categories: Category[];
  subcategories: Subcategory[];
}

// ── Constantes ───────────────────────────────────────────────────────────────

const SEASONS = [
  { value: "primavera",   label: "Primavera" },
  { value: "verano",      label: "Verano" },
  { value: "otoño",       label: "Otoño" },
  { value: "invierno",    label: "Invierno" },
  { value: "todo_el_año", label: "Todo el año" },
] as const;

const STYLES = [
  { value: "casual",     label: "Casual" },
  { value: "clasico",    label: "Clásico" },
  { value: "deportivo",  label: "Deportivo" },
  { value: "elegante",   label: "Elegante" },
  { value: "bohemio",    label: "Bohemio" },
  { value: "urbano",     label: "Urbano" },
] as const;

const OCCASIONS = [
  { value: "casual",   label: "Casual" },
  { value: "trabajo",  label: "Trabajo" },
  { value: "formal",   label: "Formal" },
  { value: "deporte",  label: "Deporte" },
  { value: "salida",   label: "Salida" },
] as const;

const STATES = [
  { value: "nueva",      label: "Nueva" },
  { value: "buena",      label: "Buena" },
  { value: "desgastada", label: "Desgastada" },
] as const;

const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.8,
  maxWidthOrHeight: 1200,
  useWebWorker: true,
} as const;

// ── Componente ───────────────────────────────────────────────────────────────

export function AddGarmentForm({ categories, subcategories }: AddGarmentFormProps) {
  const router = useRouter();

  // ── Imagen ───────────────────────────────────────────────────────────────
  const fileInputRef    = useRef<HTMLInputElement>(null);
  const cameraInputRef  = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile]     = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);

  // ── Campos del formulario ────────────────────────────────────────────────
  const [nombre, setNombre]           = useState("");
  const [categoryId, setCategoryId]   = useState<number | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<number | null>(null);
  const [color, setColor]             = useState("");
  const [estaciones, setEstaciones]   = useState<string[]>([]);
  const [estilos, setEstilos]         = useState<string[]>([]);
  const [ocasiones, setOcasiones]     = useState<string[]>([]);
  const [estado, setEstado]           = useState<string>("");
  const [notas, setNotas]             = useState("");

  // ── UI state ─────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [errors, setErrors]   = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  // Subcategorías disponibles para la categoría seleccionada
  const availableSubcategories = categoryId
    ? subcategories.filter((s) => s.category_id === categoryId)
    : [];

  // ── Manejo de imagen ─────────────────────────────────────────────────────

  async function processImageFile(file: File) {
    setCompressing(true);
    try {
      const compressed = await imageCompression(file, COMPRESSION_OPTIONS);
      setImageFile(compressed);
      const url = URL.createObjectURL(compressed);
      setImagePreview(url);
    } catch {
      // Si la compresión falla, usar el original
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    } finally {
      setCompressing(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    processImageFile(file);
    setErrors((prev) => ({ ...prev, imagen: "" }));
  }

  function clearImage() {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    if (fileInputRef.current)   fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  }

  // ── Multi-select helpers ──────────────────────────────────────────────────

  function toggleArray(arr: string[], value: string): string[] {
    return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
  }

  // ── Validación ────────────────────────────────────────────────────────────

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!imageFile)   e.imagen    = "La foto de la prenda es obligatoria.";
    if (!nombre.trim()) e.nombre  = "El nombre es obligatorio.";
    if (!categoryId)  e.categoria = "Seleccioná una categoría.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("nombre", nombre.trim());
      fd.append("category_id", String(categoryId!));
      if (subcategoryId) fd.append("subcategory_id", String(subcategoryId));
      if (color.trim()) fd.append("color_principal", color.trim());
      fd.append("estaciones", JSON.stringify(estaciones));
      fd.append("estilos",    JSON.stringify(estilos));
      fd.append("ocasiones",  JSON.stringify(ocasiones));
      if (estado) fd.append("estado", estado);
      if (notas.trim()) fd.append("notas", notas.trim());
      fd.append("imagen", imageFile!, imageFile!.name);

      const res = await fetch("/api/garments", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok) {
        const msgs: Record<string, string> = {
          nombre_requerido:    "El nombre es obligatorio.",
          categoria_requerida: "Seleccioná una categoría.",
          imagen_requerida:    "La foto de la prenda es obligatoria.",
          tipo_imagen_invalido: "Tipo de imagen no soportado. Usá JPG, PNG, WebP o AVIF.",
          upload_error:        "No se pudo subir la imagen. Por favor, intentá de nuevo.",
          no_session:          "Tu sesión expiró. Recargá la página.",
        };
        setServerError(msgs[data.error] ?? "Ocurrió un error. Por favor, intentá de nuevo.");
        return;
      }

      router.push("/guardarropas");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6 pb-8">
      {/* ── Imagen ──────────────────────────────────────────────────────── */}
      <div>
        <p className="text-sm font-medium text-ink mb-2">
          Foto de la prenda <span className="text-danger">*</span>
        </p>

        {imagePreview ? (
          <div className="relative w-full aspect-[4/5] max-w-xs mx-auto rounded-xl overflow-hidden bg-surface-2">
            <Image
              src={imagePreview}
              alt="Vista previa"
              fill
              className="object-cover"
              unoptimized // blob URL — no pasar por next/image optimization
            />
            {compressing && (
              <div className="absolute inset-0 bg-bg/60 flex items-center justify-center">
                <Loader2 className="size-6 text-ink animate-spin" />
              </div>
            )}
            <button
              type="button"
              onClick={clearImage}
              aria-label="Eliminar imagen"
              className={cn(
                "absolute top-2 right-2 size-7 rounded-full",
                "bg-white/90 text-ink grid place-items-center",
                "hover:bg-white transition-colors",
              )}
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <div className="flex gap-3">
            {/* Cámara */}
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-2 py-8",
                "rounded-xl border-2 border-dashed text-sm font-medium",
                errors.imagen
                  ? "border-danger text-danger"
                  : "border-line text-ink-3 hover:border-accent hover:text-accent",
                "transition-colors",
              )}
            >
              <Camera className="size-6" aria-hidden />
              <span>Tomar foto</span>
            </button>

            {/* Galería */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-2 py-8",
                "rounded-xl border-2 border-dashed text-sm font-medium",
                errors.imagen
                  ? "border-danger text-danger"
                  : "border-line text-ink-3 hover:border-accent hover:text-accent",
                "transition-colors",
              )}
            >
              <ImagePlus className="size-6" aria-hidden />
              <span>Elegir foto</span>
            </button>
          </div>
        )}

        {/* Input oculto para cámara */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={handleFileChange}
          aria-hidden
        />
        {/* Input oculto para galería */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={handleFileChange}
          aria-hidden
        />

        {errors.imagen && (
          <p className="mt-1.5 text-sm text-danger">{errors.imagen}</p>
        )}
      </div>

      {/* ── Nombre ──────────────────────────────────────────────────────── */}
      <Input
        label="Nombre"
        placeholder="Ej: Remera blanca básica"
        value={nombre}
        onChange={(e) => { setNombre(e.target.value); setErrors((p) => ({ ...p, nombre: "" })); }}
        required
        error={errors.nombre}
      />

      {/* ── Categoría ───────────────────────────────────────────────────── */}
      <div>
        <label className="block text-sm font-medium text-ink mb-1.5">
          Categoría <span className="text-danger">*</span>
        </label>
        <select
          value={categoryId ?? ""}
          onChange={(e) => {
            const id = e.target.value ? Number(e.target.value) : null;
            setCategoryId(id);
            setSubcategoryId(null); // reset subcategoría al cambiar categoría
            setErrors((p) => ({ ...p, categoria: "" }));
          }}
          className={cn(
            "w-full h-11 px-3 rounded-lg text-sm border bg-surface text-ink",
            "focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent",
            errors.categoria ? "border-danger" : "border-line",
          )}
        >
          <option value="">Seleccionar categoría...</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.nombre}</option>
          ))}
        </select>
        {errors.categoria && (
          <p className="mt-1 text-sm text-danger">{errors.categoria}</p>
        )}
      </div>

      {/* ── Subcategoría (condicional) ───────────────────────────────────── */}
      {availableSubcategories.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">
            Subcategoría <span className="text-danger">*</span>
          </label>
          <select
            value={subcategoryId ?? ""}
            onChange={(e) => setSubcategoryId(e.target.value ? Number(e.target.value) : null)}
            className={cn(
              "w-full h-11 px-3 rounded-lg text-sm border bg-surface text-ink",
              "focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent border-line",
            )}
          >
            <option value="">Seleccionar subcategoría...</option>
            {availableSubcategories.map((sub) => (
              <option key={sub.id} value={sub.id}>{sub.nombre}</option>
            ))}
          </select>
        </div>
      )}

      {/* ── Color principal ──────────────────────────────────────────────── */}
      <Input
        label="Color principal"
        placeholder="Ej: Azul marino, Blanco, Rojo"
        value={color}
        onChange={(e) => setColor(e.target.value)}
      />

      {/* ── Estación ────────────────────────────────────────────────────── */}
      <ChipGroup
        label="Estación"
        items={SEASONS}
        selected={estaciones}
        onChange={(v) => setEstaciones(toggleArray(estaciones, v))}
      />

      {/* ── Estilo ──────────────────────────────────────────────────────── */}
      <ChipGroup
        label="Estilo"
        items={STYLES}
        selected={estilos}
        onChange={(v) => setEstilos(toggleArray(estilos, v))}
      />

      {/* ── Ocasión ─────────────────────────────────────────────────────── */}
      <ChipGroup
        label="Ocasión"
        items={OCCASIONS}
        selected={ocasiones}
        onChange={(v) => setOcasiones(toggleArray(ocasiones, v))}
      />

      {/* ── Estado ──────────────────────────────────────────────────────── */}
      <div>
        <label className="block text-sm font-medium text-ink mb-1.5">Estado</label>
        <div className="flex gap-2">
          {STATES.map((s) => (
            <Chip
              key={s.value}
              active={estado === s.value}
              onClick={() => setEstado(estado === s.value ? "" : s.value)}
            >
              {s.label}
            </Chip>
          ))}
        </div>
      </div>

      {/* ── Notas ───────────────────────────────────────────────────────── */}
      <Textarea
        label="Notas"
        placeholder="Observaciones, talles, cómo combinarlo..."
        value={notas}
        onChange={(e) => setNotas(e.target.value)}
        maxLength={500}
        rows={3}
      />
      {notas.length > 0 && (
        <p className="text-xs text-ink-3 text-right -mt-4">{notas.length}/500</p>
      )}

      {/* ── Error de servidor ────────────────────────────────────────────── */}
      {serverError && (
        <p className="text-sm text-danger">{serverError}</p>
      )}

      {/* ── Botones ─────────────────────────────────────────────────────── */}
      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="ghost"
          size="lg"
          className="flex-1"
          onClick={() => router.back()}
          disabled={loading}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="flex-1"
          loading={loading}
          disabled={loading || compressing}
        >
          Guardar prenda
        </Button>
      </div>
    </form>
  );
}

// ── ChipGroup helper ─────────────────────────────────────────────────────────

function ChipGroup({
  label,
  items,
  selected,
  onChange,
}: {
  label: string;
  items: readonly { value: string; label: string }[];
  selected: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-ink mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Chip
            key={item.value}
            active={selected.includes(item.value)}
            onClick={() => onChange(item.value)}
          >
            {item.label}
          </Chip>
        ))}
      </div>
    </div>
  );
}
