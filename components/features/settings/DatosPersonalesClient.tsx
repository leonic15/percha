"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import imageCompression from "browser-image-compression";
import {
  ArrowLeft,
  Bot,
  Camera,
  CheckCircle,
  ChevronRight,
  Circle,
  GalleryHorizontal,
  Lock,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useToast } from "@/components/ui";
import { cn } from "@/lib/cn";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type Genero = "hombre" | "mujer" | "prefiero_no_decirlo" | null;

export interface DatosPersonalesClientProps {
  genero:         Genero;
  alturaCm:       number | null;
  pesoKg:         number | null;
  bodyPhotoUrl:   string | null; // signed URL para mostrar
  bodyPhotoPath:  string | null; // path en Storage (para saber si existe)
}

// ── Constantes ────────────────────────────────────────────────────────────────

const GENERO_OPTS = [
  { value: "hombre"              as const, labelMobile: "Hombre",    labelDesktop: "Hombre"              },
  { value: "mujer"               as const, labelMobile: "Mujer",     labelDesktop: "Mujer"               },
  { value: "prefiero_no_decirlo" as const, labelMobile: "No decir",  labelDesktop: "Prefiero no decirlo" },
] as const;

const GUIAS = [
  "Cuerpo completo (cabeza a pies)",
  "Fondo claro o neutro",
  "Pose natural de frente",
] as const;

const COMPRESS_OPTIONS = {
  maxSizeMB: 2,
  maxWidthOrHeight: 2000,
  useWebWorker: true,
};

// ── Sub-componentes ───────────────────────────────────────────────────────────

function GenderPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 h-11 rounded-button text-sm font-medium transition-all duration-150",
        "border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1",
        active
          ? "bg-ink text-bg border-ink"
          : "bg-surface text-ink-2 border-line hover:border-ink-3 hover:text-ink",
      )}
    >
      {label}
    </button>
  );
}

function NumberField({
  label,
  value,
  unit,
  min,
  max,
  onChange,
  error,
}: {
  label:    string;
  value:    string;
  unit:     string;
  min:      number;
  max:      number;
  onChange: (v: string) => void;
  error?:   string;
}) {
  return (
    <div className="flex-1 min-w-0">
      <label className="eyebrow text-[10px] text-ink-3 block mb-1">{label}</label>
      <div
        className={cn(
          "flex items-baseline gap-1 border-b pb-1 transition-colors",
          error ? "border-danger" : "border-line",
        )}
      >
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="—"
          className={cn(
            "w-full bg-transparent outline-none font-mono text-[22px] font-semibold text-ink",
            "placeholder:text-ink-3 placeholder:font-normal placeholder:text-lg",
            "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
          )}
        />
        <span className="text-[12px] text-ink-3 shrink-0">{unit}</span>
      </div>
      {error && (
        <p className="text-[11px] text-danger mt-1">{error}</p>
      )}
    </div>
  );
}

/** SVG silueta humana — Handoff 19: viewBox 48×64, line art */
function BodySilhouette({ size }: { size: number }) {
  const scale = size / 48;
  return (
    <svg
      width={48 * scale}
      height={64 * scale}
      viewBox="0 0 48 64"
      fill="none"
      aria-hidden
      style={{ color: "var(--color-ink-3)" }}
    >
      <circle cx="24" cy="9" r="7" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M18 16c0 0-6 4-6 12v8h24v-8c0-8-6-12-6-12"
        stroke="currentColor" strokeWidth="1.6"
        strokeLinecap="round" strokeLinejoin="round"
      />
      <path d="M12 28l-5 14M36 28l5 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M18 36l-3 26M30 36l3 26" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Lista de guías con check circles — Handoff 19 */
function PhotoGuidelineList({ complete }: { complete: boolean }) {
  return (
    <div
      className="rounded-sm p-3"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-line-2)" }}
    >
      <p className="eyebrow text-[9px] text-ink-3 mb-2">GUÍAS PARA LA FOTO</p>
      <ul className="space-y-2">
        {GUIAS.map((guia) => (
          <li key={guia} className="flex items-center gap-2">
            {complete ? (
              <CheckCircle className="size-4 text-accent shrink-0" strokeWidth={2} />
            ) : (
              <Circle className="size-4 text-line shrink-0" strokeWidth={1.5} />
            )}
            <span className="text-[12.5px] text-ink-2">{guia}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── BodyPhotoZone ─────────────────────────────────────────────────────────────

/**
 * Estado vacío: dropzone con silueta + botón "Agregar foto"
 * Estado lleno: thumb 96px + acciones (Cambiar / Eliminar)
 * Handoff 19 (pantalla 19) + Sheet 20
 */
function BodyPhotoZone({
  photoUrl,
  uploading,
  deletePending,
  onAdd,
  onDelete,
}: {
  photoUrl:      string | null;
  uploading:     boolean;
  deletePending: boolean;
  onAdd:         () => void;
  onDelete:      () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Reset confirmDelete si la foto cambia
  useEffect(() => { setConfirmDelete(false); }, [photoUrl]);

  if (photoUrl) {
    return (
      <div
        className="flex items-start gap-3 rounded-sm p-2.5"
        style={{ border: "1px solid var(--color-line-2)" }}
      >
        {/* Thumb 96px aspect 3/4 */}
        <div className="relative shrink-0 rounded-sm overflow-hidden" style={{ width: 96, aspectRatio: "3/4" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl}
            alt="Foto de referencia corporal"
            className="w-full h-full object-cover"
          />
          {uploading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1"
              style={{ background: "rgba(0,0,0,0.45)" }}>
              <div className="size-[18px] rounded-full border-2 border-accent border-t-transparent animate-spin" />
              <span className="text-[10px] text-white font-medium">Subiendo…</span>
            </div>
          )}
        </div>

        {/* Acciones */}
        <div className="flex flex-col gap-2 pt-1">
          <button
            type="button"
            onClick={onAdd}
            disabled={uploading || deletePending}
            className="flex items-center gap-1.5 h-8 px-3 rounded-button text-[12px] font-medium text-ink-2 border border-line hover:border-ink-3 hover:text-ink transition-colors disabled:opacity-50"
          >
            <RefreshCw className="size-3" strokeWidth={2} />
            Cambiar
          </button>

          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-ink-2">¿Eliminar?</span>
              <button
                type="button"
                onClick={() => { setConfirmDelete(false); onDelete(); }}
                className="text-[11px] text-danger font-medium hover:underline"
              >
                Sí
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="text-[11px] text-ink-3 hover:text-ink-2"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={uploading || deletePending}
              className="flex items-center gap-1.5 h-8 px-3 rounded-button text-[12px] font-medium border transition-colors disabled:opacity-50"
              style={{ color: "var(--color-danger)", borderColor: "var(--color-danger)" }}
            >
              <Trash2 className="size-3" strokeWidth={2} />
              Eliminar
            </button>
          )}
        </div>
      </div>
    );
  }

  // Estado vacío
  return (
    <div
      className="rounded-sm flex flex-col items-center justify-center gap-3 py-8 px-4 text-center"
      style={{
        border:     "1.5px dashed var(--color-line)",
        background: "var(--color-surface-2)",
      }}
    >
      <BodySilhouette size={56} />
      <div>
        <h3 className="font-display font-bold text-ink leading-tight" style={{ fontSize: 18 }}>
          Foto de cuerpo
          <br />
          completo.
        </h3>
        <p className="text-[12px] text-ink-3 mt-1 leading-snug">
          Usada para generar imágenes
          <br />
          con el look puesto.
        </p>
      </div>
      <button
        type="button"
        onClick={onAdd}
        className={cn(
          "flex items-center gap-1.5 h-9 px-4 rounded-button",
          "bg-ink text-bg text-sm font-medium",
          "transition-[transform,opacity] duration-150 active:scale-[0.97]",
        )}
      >
        <span className="text-base leading-none">+</span>
        Agregar foto
      </button>
    </div>
  );
}

// ── AddBodyPhotoSheet ─────────────────────────────────────────────────────────

/**
 * Sheet 20 · Handoff 20 — Agregar foto de referencia
 *
 * Mobile: bottom sheet slide-up.  Desktop: dialog centrado max-w-[420px].
 * Opciones: Galería / Cámara.  Aviso de privacidad.
 */
function AddBodyPhotoSheet({
  open,
  onClose,
  onFilePicked,
}: {
  open:         boolean;
  onClose:      () => void;
  onFilePicked: (file: File) => void;
}) {
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef  = useRef<HTMLInputElement>(null);

  // Animación slide-up: translateY(100%) → 0
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (open) {
      // Pequeño delay para que la transición funcione tras montar el DOM
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    } else {
      setVisible(false);
    }
  }, [open]);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFilePicked(file);
      onClose();
    }
    // Reset input para que el mismo archivo se pueda re-seleccionar
    e.target.value = "";
  }, [onFilePicked, onClose]);

  if (!open) return null;

  const sheetContent = (
    <div className="flex flex-col">
      {/* Handle pill — solo mobile */}
      <div className="md:hidden flex justify-center pt-2 pb-1">
        <div className="w-9 h-1 rounded-full" style={{ background: "var(--color-line)" }} />
      </div>

      {/* Cabecera */}
      <div className="px-[22px] pt-3 pb-4">
        <p className="eyebrow text-[10px] text-ink-3 mb-1">FOTO DE REFERENCIA</p>
        <h2 className="font-display font-bold text-ink leading-tight mb-1" style={{ fontSize: 24 }}>
          Agregar foto.
        </h2>
        <p className="text-[13px] text-ink-3 leading-snug">
          Elegí una foto de cuerpo completo — de frente, fondo claro o neutro.
        </p>
      </div>

      {/* Opciones — Handoff 20: ícono en círculo 40px surface-2 + textos + chevron */}
      <div className="px-[22px] flex flex-col gap-2 pb-4">
        {/* Galería */}
        <button
          type="button"
          onClick={() => galleryInputRef.current?.click()}
          className="flex items-center gap-3 p-3 rounded-sm transition-colors hover:bg-surface-2 active:bg-surface-2"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-line-2)" }}
        >
          <div
            className="size-10 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "var(--color-surface-2)" }}
          >
            <GalleryHorizontal className="size-[18px] text-ink-2" strokeWidth={1.6} />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium text-ink leading-tight">Elegir de la galería</p>
            <p className="text-[11.5px] text-ink-3 mt-0.5">Foto existente del rollo</p>
          </div>
          <ChevronRight className="size-[14px] text-ink-3 shrink-0" strokeWidth={1.8} />
        </button>

        {/* Cámara — capture="user" (frontal, como selfie) */}
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          className="flex items-center gap-3 p-3 rounded-sm transition-colors hover:bg-surface-2 active:bg-surface-2"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-line-2)" }}
        >
          <div
            className="size-10 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "var(--color-surface-2)" }}
          >
            <Camera className="size-[18px] text-ink-2" strokeWidth={1.6} />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium text-ink leading-tight">Usar cámara</p>
            <p className="text-[11.5px] text-ink-3 mt-0.5">Sacar una nueva ahora</p>
          </div>
          <ChevronRight className="size-[14px] text-ink-3 shrink-0" strokeWidth={1.8} />
        </button>
      </div>

      {/* Aviso de privacidad — Handoff 20: card accent-tint, ícono lock, texto 11px */}
      <div className="px-[22px] pb-[max(env(safe-area-inset-bottom),28px)]">
        <div
          className="flex items-start gap-2 p-3 rounded-sm"
          style={{ background: "var(--color-accent-tint)" }}
        >
          <Lock className="size-[14px] text-accent shrink-0 mt-0.5" strokeWidth={1.8} />
          <p className="text-[11px] text-ink-2 leading-snug max-w-[280px]">
            Esta foto solo se usa para generar imágenes de looks.
            No es visible para otros usuarios.
          </p>
        </div>
      </div>

      {/* Inputs ocultos */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={handleFile}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="user"
        className="sr-only"
        onChange={handleFile}
      />
    </div>
  );

  // ── Mobile: bottom sheet ──────────────────────────────────────────────────
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 md:hidden transition-opacity duration-280"
        style={{
          background: "rgba(0,0,0,0.45)",
          opacity: visible ? 1 : 0,
        }}
        onClick={onClose}
      />

      {/* Sheet mobile */}
      <div
        className="fixed bottom-0 inset-x-0 z-50 md:hidden rounded-t-[20px] overflow-hidden"
        style={{
          background:  "var(--color-bg)",
          boxShadow:   "var(--shadow-modal, 0 -4px 24px rgba(0,0,0,0.12))",
          transform:   visible ? "translateY(0)" : "translateY(100%)",
          transition:  "transform 280ms cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        {sheetContent}
      </div>

      {/* Desktop: dialog centrado */}
      <div
        className="hidden md:flex fixed inset-0 z-40 items-center justify-center transition-opacity duration-200"
        style={{ background: "rgba(0,0,0,0.45)", opacity: visible ? 1 : 0 }}
        onClick={onClose}
      >
        <div
          className="relative max-w-[420px] w-full rounded-xl overflow-hidden"
          style={{ background: "var(--color-bg)", boxShadow: "var(--shadow-modal)" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close ×  desktop */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 size-8 grid place-items-center rounded-full text-ink-3 hover:bg-surface-2 transition-colors z-10"
            aria-label="Cerrar"
          >
            ×
          </button>
          {sheetContent}
        </div>
      </div>
    </>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function patchPerfil(fields: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch("/api/perfil", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(fields),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function validateAltura(v: string): string | undefined {
  if (v === "") return undefined;
  const n = Number(v);
  if (isNaN(n) || n < 80 || n > 250) return "Ingresá un valor entre 80 y 250 cm";
}

function validatePeso(v: string): string | undefined {
  if (v === "") return undefined;
  const n = Number(v);
  if (isNaN(n) || n < 30 || n > 250) return "Ingresá un valor entre 30 y 250 kg";
}

// ── Main component ─────────────────────────────────────────────────────────────

export function DatosPersonalesClient({
  genero:        initialGenero,
  alturaCm:      initialAltura,
  pesoKg:        initialPeso,
  bodyPhotoUrl:  initialPhotoUrl,
  bodyPhotoPath: initialPhotoPath,
}: DatosPersonalesClientProps) {
  const router    = useRouter();
  const { toast } = useToast();

  const [genero,       setGenero]       = useState<Genero>(initialGenero);
  const [altura,       setAltura]       = useState(initialAltura?.toString() ?? "");
  const [peso,         setPeso]         = useState(initialPeso?.toString() ?? "");
  const [saving,       setSaving]       = useState(false);
  const [generoError,  setGeneroError]  = useState(false);

  // Foto corporal
  const [photoUrl,     setPhotoUrl]     = useState<string | null>(initialPhotoUrl);
  const [hasPhoto,     setHasPhoto]     = useState(!!initialPhotoPath);
  const [showSheet,    setShowSheet]    = useState(false);
  const [uploading,    setUploading]    = useState(false);
  const [deletePending, setDeletePending] = useState(false);

  const alturaError = validateAltura(altura);
  const pesoError   = validatePeso(peso);
  const hasErrors   = !!alturaError || !!pesoError;

  const dirty =
    genero  !== initialGenero ||
    altura  !== (initialAltura?.toString() ?? "") ||
    peso    !== (initialPeso?.toString()   ?? "");

  // ── Guardar datos corporales ────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!genero) {
      setGeneroError(true);
      return;
    }
    if (hasErrors) return;

    setSaving(true);
    const ok = await patchPerfil({
      genero,
      altura_cm: altura !== "" ? Number(altura) : null,
      peso_kg:   peso   !== "" ? Number(peso)   : null,
    });
    setSaving(false);

    if (ok) {
      toast.success("Datos guardados.");
      router.back();
    } else {
      toast.error("Error guardando. Intentá de nuevo.");
    }
  }, [genero, altura, peso, hasErrors, toast, router]);

  // ── Upload foto ─────────────────────────────────────────────────────────────

  const handleFilePicked = useCallback(async (file: File) => {
    const MAX_BYTES = 10 * 1024 * 1024;
    const ALLOWED   = ["image/jpeg", "image/png", "image/webp"];

    if (!ALLOWED.includes(file.type)) {
      toast.error("Solo se aceptan imágenes JPG, PNG o WebP.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("La imagen no puede superar 10 MB.");
      return;
    }

    setUploading(true);

    let compressed: File | Blob = file;
    try {
      compressed = await imageCompression(file, COMPRESS_OPTIONS);
    } catch {
      // Si falla la compresión subimos el original
    }

    const formData = new FormData();
    formData.append("file", compressed, file.name);

    try {
      const res = await fetch("/api/perfil/foto-corporal", {
        method: "POST",
        body:   formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.message ?? "Error al subir la foto. Intentá de nuevo.");
        setUploading(false);
        return;
      }

      // Preview local inmediato
      const localUrl = URL.createObjectURL(compressed);
      setPhotoUrl(localUrl);
      setHasPhoto(true);
      toast.success("Foto de referencia guardada.");
    } catch {
      toast.error("Error al subir la foto. Intentá de nuevo.");
    } finally {
      setUploading(false);
    }
  }, [toast]);

  // ── Eliminar foto ───────────────────────────────────────────────────────────

  const handleDeletePhoto = useCallback(async () => {
    setDeletePending(true);
    try {
      const res = await fetch("/api/perfil/foto-corporal", { method: "DELETE" });
      if (res.ok) {
        setPhotoUrl(null);
        setHasPhoto(false);
        toast.success("Foto eliminada.");
      } else {
        toast.error("Error al eliminar la foto. Intentá de nuevo.");
      }
    } catch {
      toast.error("Error al eliminar la foto. Intentá de nuevo.");
    } finally {
      setDeletePending(false);
    }
  }, [toast]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="flex flex-col min-h-dvh bg-bg md:flex-row md:min-h-0">

        {/* Top bar mobile */}
        <header className="sticky top-0 z-20 bg-bg/90 backdrop-blur-md border-b border-line-2 md:hidden">
          <div className="flex items-center gap-3 px-4 h-[52px]">
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="Volver"
              className="size-9 grid place-items-center rounded-full text-ink-2 hover:bg-surface-2 transition-colors -ml-1"
            >
              <ArrowLeft className="size-5" strokeWidth={1.6} />
            </button>
            <span className="eyebrow text-[10px] text-ink-3 tracking-widest flex-1">
              PERFIL · DATOS PERSONALES
            </span>
          </div>
        </header>

        {/* Desktop: rail nav */}
        <nav className="hidden md:flex md:flex-col md:w-[200px] md:shrink-0 md:border-r md:border-line-2 md:py-6">
          <p className="px-4 eyebrow text-[10px] text-ink-3 mb-2">CONFIGURACIÓN</p>
          {[
            { label: "Perfil",           href: "/perfil"        },
            { label: "Datos personales", href: "/perfil/datos", active: true },
            { label: "Estilo",           href: "/perfil"        },
            { label: "App",              href: "/perfil"        },
            { label: "Cuenta",           href: "/perfil"        },
          ].map(({ label, href, active }) => (
            <a
              key={label}
              href={href}
              className={cn(
                "flex items-center h-10 px-4 text-sm transition-colors",
                active
                  ? "text-ink font-medium border-l-2 border-accent bg-surface"
                  : "text-ink-2 border-l-2 border-transparent hover:text-ink hover:bg-surface-2",
              )}
            >
              {label}
            </a>
          ))}
        </nav>

        {/* Contenido */}
        <div className="flex-1 pb-[calc(60px+max(env(safe-area-inset-bottom),16px)+90px)] md:pb-8 md:overflow-y-auto">
          <div className="px-[22px] pt-6 md:pt-8 md:max-w-[680px]">

            {/* Título */}
            <h1
              className="font-display font-bold text-ink leading-none mb-2"
              style={{ fontSize: 32, letterSpacing: "-0.02em" }}
            >
              Datos
              <br />
              personales.
            </h1>
            <p className="text-[13px] text-ink-3 mb-8 leading-snug">
              Esta información ayuda a la IA a generar looks
              más precisos para tu cuerpo e identidad.
            </p>

            {/* GÉNERO */}
            <section className="mb-8">
              <p className="eyebrow text-[10px] text-ink-3 mb-3">GÉNERO</p>
              <div className="flex gap-2">
                {GENERO_OPTS.map(({ value, labelMobile }) => (
                  <GenderPill
                    key={value}
                    label={labelMobile}
                    active={genero === value}
                    onClick={() => { setGenero(value); setGeneroError(false); }}
                  />
                ))}
              </div>
              {generoError && (
                <p className="text-[11px] text-danger mt-2">Seleccioná una opción para continuar.</p>
              )}
              <p className="text-[11px] text-ink-3 mt-2">
                Influye en cómo la IA interpreta cortes y siluetas.
              </p>
            </section>

            {/* MEDIDAS */}
            <section className="mb-8">
              <p className="eyebrow text-[10px] text-ink-3 mb-3">MEDIDAS</p>
              <div className="flex gap-[22px]">
                <NumberField
                  label="ALTURA"
                  value={altura}
                  unit="cm"
                  min={80}
                  max={250}
                  onChange={setAltura}
                  error={alturaError}
                />
                <NumberField
                  label="PESO"
                  value={peso}
                  unit="kg"
                  min={30}
                  max={250}
                  onChange={setPeso}
                  error={pesoError}
                />
              </div>
            </section>

            {/* FOTO DE REFERENCIA */}
            <section className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <p className="eyebrow text-[10px] text-ink-3">FOTO DE REFERENCIA CORPORAL</p>
                <span className="flex items-center gap-1 bg-accent-tint px-2 py-0.5 rounded-full">
                  <Bot className="size-3 text-accent" strokeWidth={1.8} />
                  <span className="text-[10px] text-accent font-medium">IA</span>
                </span>
              </div>

              <BodyPhotoZone
                photoUrl={photoUrl}
                uploading={uploading}
                deletePending={deletePending}
                onAdd={() => setShowSheet(true)}
                onDelete={handleDeletePhoto}
              />

              <div className="mt-3">
                <PhotoGuidelineList complete={hasPhoto} />
              </div>

              {/* Nota de privacidad — siempre visible */}
              <div className="flex items-start gap-1.5 mt-3">
                <Lock className="size-3 text-ink-3 shrink-0 mt-0.5" strokeWidth={1.6} />
                <p className="text-[10.5px] text-ink-2 leading-snug">
                  Esta foto solo se usa para generar imágenes de looks.
                  No es visible para otros usuarios.
                </p>
              </div>
            </section>

          </div>
        </div>
      </div>

      {/* Sticky CTA mobile */}
      <div
        className={cn(
          "fixed inset-x-0 z-30 px-[22px] pb-4 pt-8 md:hidden",
          "bottom-[calc(60px+max(env(safe-area-inset-bottom),16px))]",
          "pointer-events-none",
        )}
        style={{ background: "linear-gradient(0deg, var(--color-bg) 65%, transparent)" }}
      >
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || hasErrors || !dirty}
          className={cn(
            "w-full h-[54px] rounded-button text-sm font-semibold uppercase tracking-wide",
            "transition-[transform,opacity] duration-150 active:scale-[0.985]",
            "pointer-events-auto",
            saving || hasErrors || !dirty
              ? "bg-surface-2 text-ink-3 cursor-not-allowed"
              : "bg-accent text-accent-ink",
          )}
        >
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>

      {/* Desktop: row de acciones */}
      <div className="hidden md:flex gap-3 px-[22px] pb-8 md:ml-[200px] md:max-w-[680px]">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || hasErrors || !dirty}
          className={cn(
            "h-11 px-6 rounded-button text-sm font-semibold uppercase tracking-wide",
            "transition-[transform,opacity] duration-150 active:scale-[0.985]",
            saving || hasErrors || !dirty
              ? "bg-surface-2 text-ink-3 cursor-not-allowed"
              : "bg-accent text-accent-ink",
          )}
        >
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="h-11 px-6 rounded-button text-sm font-medium text-ink-2 hover:text-ink border border-line hover:border-ink-3 transition-colors"
        >
          Descartar
        </button>
      </div>

      {/* Sheet 20 */}
      <AddBodyPhotoSheet
        open={showSheet}
        onClose={() => setShowSheet(false)}
        onFilePicked={handleFilePicked}
      />
    </>
  );
}
