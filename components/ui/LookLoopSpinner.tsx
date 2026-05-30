import { CSSProperties } from "react";

const SWATCHES = ["#efe9dc", "#c2a079", "#c9c8b0", "#8a9aa8"]; // crudo · camel · oliva · denim

export function LookLoopSpinner({ size = 72 }: { size?: number }) {
  const chip = size * 0.26;
  const radius = size / 2 - chip / 2;
  return (
    <div
      role="status"
      aria-label="Cargando"
      className="relative"
      style={{ width: size, height: size }}
    >
      <div className="absolute inset-0 animate-[ls-orbit_2.4s_cubic-bezier(.6,0,.4,1)_infinite]">
        {SWATCHES.map((c, i) => {
          const angle = (i / SWATCHES.length) * 2 * Math.PI - Math.PI / 2;
          const x = size / 2 + radius * Math.cos(angle) - chip / 2;
          const y = size / 2 + radius * Math.sin(angle) - chip / 2;
          const style: CSSProperties = {
            left: x,
            top: y,
            width: chip,
            height: chip,
            borderRadius: chip * 0.28,
            background: c,
            animationDelay: `${i * 0.22}s`,
          };
          return (
            <span
              key={i}
              className="absolute shadow-sm animate-[ls-orbit-pulse_1.8s_ease-in-out_infinite]"
              style={style}
            />
          );
        })}
      </div>
      <span className="absolute left-1/2 top-1/2 size-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-accent)]" />
    </div>
  );
}
