const LAYERS = 10;

export default function LogoLoader({ size = 88, label = "Yuklanmoqda", shadow = true }: { size?: number; label?: string; shadow?: boolean }) {
  const depth = Math.max(2, Math.round(size / 9));
  const face = depth / 2 + 0.5;
  return (
    <div className={size < 40 ? "gl-coin-scene gl-coin-sm" : "gl-coin-scene"} style={{ width: size, height: size }} role="status" aria-label={label}>
      <div className="gl-coin">
        {Array.from({ length: LAYERS }, (_, i) => (
          <span key={i} className="gl-coin-edge" style={{ transform: `translateZ(${((i / (LAYERS - 1)) - 0.5) * depth}px)` }} />
        ))}
        <span className="gl-coin-face" style={{ transform: `translateZ(${face}px)` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.png" alt="" draggable={false} />
        </span>
        <span className="gl-coin-face" style={{ transform: `rotateY(180deg) translateZ(${face}px)` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.png" alt="" draggable={false} />
        </span>
      </div>
      {shadow && <span className="gl-coin-shadow" />}
    </div>
  );
}
