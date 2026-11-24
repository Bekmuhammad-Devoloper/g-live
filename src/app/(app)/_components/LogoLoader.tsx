const EDGE = Array.from({ length: 10 }, (_, i) => i);

export default function LogoLoader({ size = 88, label = "Yuklanmoqda" }: { size?: number; label?: string }) {
  return (
    <div className="gl-coin-scene" style={{ width: size, height: size }} role="status" aria-label={label}>
      <div className="gl-coin">
        {EDGE.map((i) => (
          <span key={i} className="gl-coin-edge" style={{ transform: `translateZ(${i - 4.5}px)` }} />
        ))}
        <span className="gl-coin-face gl-coin-front">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.png" alt="" draggable={false} />
        </span>
        <span className="gl-coin-face gl-coin-back">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.png" alt="" draggable={false} />
        </span>
      </div>
      <span className="gl-coin-shadow" />
    </div>
  );
}
