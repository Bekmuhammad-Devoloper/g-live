type ViewTransitionDoc = Document & {
  startViewTransition?: (cb: () => void) => { ready: Promise<void>; finished: Promise<void> };
};

const DURATION = 700;

function originPoint(origin?: { x: number; y: number }) {
  if (origin) return origin;
  const el = document.activeElement;
  if (el instanceof HTMLElement && el !== document.body) {
    const r = el.getBoundingClientRect();
    if (r.width || r.height) return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  return { x: window.innerWidth / 2, y: 0 };
}

export function switchTheme(next: boolean, origin?: { x: number; y: number }) {
  const root = document.documentElement;
  const apply = () => {
    root.classList.toggle("dark", next);
    try { localStorage.setItem("gl-theme", next ? "dark" : "light"); } catch {}
  };

  const doc = document as ViewTransitionDoc;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (!doc.startViewTransition || reduce || root.classList.contains("dark") === next) {
    apply();
    return;
  }

  const { x, y } = originPoint(origin);
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  root.classList.add("gl-theme-vt");
  const t = doc.startViewTransition(apply);
  t.ready
    .then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: DURATION, easing: "cubic-bezier(0.65, 0, 0.35, 1)", pseudoElement: "::view-transition-new(root)" },
      );
    })
    .catch(() => {});
  t.finished.finally(() => root.classList.remove("gl-theme-vt"));
}
