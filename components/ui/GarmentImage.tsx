import type { CSSProperties } from "react";

// ── Color swatches — de components.jsx del prototipo original ──────────────
const SWATCHES: Record<string, [string, string]> = {
  neutral:   ["#e8e3d8", "#d8d0c0"],
  cream:     ["#efe9dc", "#dfd6c2"],
  sand:      ["#e2d6c0", "#c9b993"],
  olive:     ["#c9c8b0", "#a8a78a"],
  forest:    ["#7b8472", "#5e6755"],
  denim:     ["#8a9aa8", "#647383"],
  navy:      ["#3d4858", "#2a3340"],
  blanco:    ["#f3efe5", "#e5dfd0"],
  crudo:     ["#ece3d2", "#d4c8af"],
  negro:     ["#262522", "#15140f"],
  arena:     ["#d6c5a8", "#b8a37e"],
  rosa:      ["#e6cfc9", "#caa8a0"],
  chocolate: ["#5e4a39", "#3f3024"],
  camel:     ["#c2a079", "#a78458"],
  terra:     ["#b56b4a", "#8c4d33"],
};

export interface GarmentImageProps {
  color?: string;
  label?: string;
  /** Si se pasa, renderiza una foto real en lugar del placeholder SVG */
  src?: string;
  style?: CSSProperties;
  className?: string;
}

/**
 * Placeholder visual de prenda: stripes diagonales sobre un color sólido
 * + etiqueta inferior. Equivalente exacto al <GarmentImage /> del prototipo.
 *
 * Safari/WebKit bug: aspect-ratio no se respeta en `position:absolute`
 * sin alto explícito. Se calcula `height` automáticamente cuando `width` es un
 * número en px.
 */
export function GarmentImage({
  color = "neutral",
  label,
  src,
  style = {},
  className,
}: GarmentImageProps) {
  const [a, b] = SWATCHES[color] ?? SWATCHES.neutral;
  const safeLabel = (label ?? color).replace(/\W+/g, "_");
  const patternId = `gp_${color}_${safeLabel}`;

  // Fix Safari: calcular height explícito si width es número (4:5 ratio)
  const numericWidth =
    typeof style.width === "number" ? style.width : undefined;
  const explicitHeight =
    style.height == null && numericWidth != null
      ? Math.round((numericWidth * 5) / 4)
      : undefined;

  return (
    <div
      aria-hidden
      className={className}
      style={{
        position: "relative",
        aspectRatio: "4/5",
        background: src ? "transparent" : a,
        overflow: src ? "visible" : "hidden",
        ...style,
        ...(explicitHeight != null ? { height: explicitHeight } : {}),
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={label ?? ""}
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            objectFit: "contain",
          }}
        />
      ) : (
        <svg
          width="100%"
          height="100%"
          style={{ position: "absolute", inset: 0, display: "block" }}
        >
          <defs>
            <pattern
              id={patternId}
              width="14"
              height="14"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width="14" height="14" fill={a} />
              <rect width="7" height="14" fill={b} />
            </pattern>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill={`url(#${patternId})`}
            opacity="0.45"
          />
        </svg>
      )}

      {/* Etiqueta inferior con fade — solo en placeholder */}
      {label && !src && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            padding: "6px 8px",
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "0.04em",
            color: "rgba(0,0,0,0.55)",
            textTransform: "lowercase",
            background:
              "linear-gradient(to top, rgba(255,255,255,0.55), rgba(255,255,255,0))",
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}
