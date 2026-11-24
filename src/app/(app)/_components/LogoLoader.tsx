const LAYERS = 6;

export default function LogoLoader({ size = 88, label = "Yuklanmoqda", shadow = false }: { size?: number; label?: string; shadow?: boolean }) {
  const half = Math.max(1, Math.round(size / 22));
  const steps = Array.from({ length: LAYERS }, (_, i) => (i / (LAYERS - 1)) * half);
  return (
    <div className="gl-coin-scene" style={{ width: size, height: size }} role="status" aria-label={label}>
      <div className="gl-coin">
        {steps.map((z, i) => (
          <span key={`f${i}`} className="gl-logo-edge" style={{ transform: `translateZ(${z}px)` }} />
        ))}
        {steps.map((z, i) => (
          <span key={`b${i}`} className="gl-logo-edge" style={{ transform: `rotateY(180deg) translateZ(${z}px)` }} />
        ))}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-mark.png" alt="" draggable={false} className="gl-logo-layer gl-logo-face" style={{ transform: `translateZ(${half + 0.5}px)` }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-mark.png" alt="" draggable={false} className="gl-logo-layer gl-logo-face" style={{ transform: `rotateY(180deg) translateZ(${half + 0.5}px)` }} />
      </div>
      {shadow && <span className="gl-coin-shadow" />}
    </div>
  );
}
