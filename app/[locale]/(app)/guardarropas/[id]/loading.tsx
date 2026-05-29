/**
 * Skeleton que se muestra mientras el servidor renderiza el detalle de la prenda.
 * Coincide con el layout del GarmentDetailClient para evitar layout shift.
 */
export default function GarmentDetailLoading() {
  return (
    <div style={{ minHeight: "100dvh", background: "var(--color-bg)" }}>
      {/* Hero image placeholder */}
      <div
        className="animate-pulse bg-surface-2"
        style={{ width: "100%", aspectRatio: "1 / 1.15" }}
      />

      {/* Contenido */}
      <div style={{ padding: "22px 22px 0" }}>
        {/* eyebrow */}
        <div className="animate-pulse bg-surface-2" style={{ height: 10, width: 110, borderRadius: 4, marginBottom: 14 }} />
        {/* H1 */}
        <div className="animate-pulse bg-surface-2" style={{ height: 30, width: "60%", borderRadius: 4, marginBottom: 8 }} />
        <div className="animate-pulse bg-surface-2" style={{ height: 30, width: "40%", borderRadius: 4, marginBottom: 24 }} />
        {/* AI description box */}
        <div className="animate-pulse bg-surface-2" style={{ height: 80, borderRadius: 4, marginBottom: 24 }} />
        {/* Chips rows */}
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ marginBottom: 20 }}>
            <div className="animate-pulse bg-surface-2" style={{ height: 9, width: 70, borderRadius: 4, marginBottom: 10 }} />
            <div style={{ display: "flex", gap: 6 }}>
              <div className="animate-pulse bg-surface-2" style={{ height: 28, width: 60, borderRadius: 999 }} />
              <div className="animate-pulse bg-surface-2" style={{ height: 28, width: 80, borderRadius: 999 }} />
              <div className="animate-pulse bg-surface-2" style={{ height: 28, width: 55, borderRadius: 999 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
