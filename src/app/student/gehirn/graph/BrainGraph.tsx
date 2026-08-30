"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GraphSim, type SimLink, type SimNode } from "../../../(app)/tasks/graphSim";
import { TEAL } from "../../_ui";
import type { StudentStrings } from "../../_i18n";
import { kindColor } from "../parse";

// Bog'lanishlar xaritasi (Obsidian Graph View) — telefon uchun:
// bir barmoq bilan surish, ikki barmoq bilan kattalashtirish,
// tugunni bosish — yozuv ochiladi, tugunni sudrash — joyini o'zgartirish.

export interface GNode { id: string; title: string; kind: string; deg: number; missing: boolean }
export interface GLink { source: string; target: string }

export default function BrainGraph({
  nodes, links, t,
}: {
  nodes: GNode[];
  links: GLink[];
  t: StudentStrings;
}) {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const cvRef = useRef<HTMLCanvasElement | null>(null);
  const simRef = useRef(new GraphSim());
  const camRef = useRef({ x: 0, y: 0, z: 1 });
  const rafRef = useRef<number | null>(null);
  const activeRef = useRef<string | null>(null);   // tanlangan tugun
  const dragRef = useRef<{ id: string | null; x: number; y: number; moved: boolean } | null>(null);
  const pinchRef = useRef<{ d: number; z: number } | null>(null);
  const [sel, setSel] = useState<GNode | null>(null);

  // ── Ma'lumotni simulyatsiyaga berish ──
  useEffect(() => {
    const R = 160;
    const sn: SimNode[] = nodes.map((n, i) => {
      const a = (i / Math.max(1, nodes.length)) * Math.PI * 2;
      return {
        id: n.id,
        label: n.title,
        group: n.kind,
        deg: n.deg,
        x: Math.cos(a) * R,
        y: Math.sin(a) * R,
        vx: 0, vy: 0,
        fixed: false,
        payload: n,
      };
    });
    const sl: SimLink[] = links.map((l) => ({ source: l.source, target: l.target, color: TEAL }));
    simRef.current.setData(sn, sl);
    // Kichik grafda tugunlar bir-biriga yaqinroq tursin
    simRef.current.forces = { center: 0.5, repel: nodes.length > 40 ? 8 : 14, link: 1, distance: 90 };
  }, [nodes, links]);

  // ── Barcha tugunlarni ekranga sig'dirish ──
  const fit = useCallback(() => {
    const cv = cvRef.current;
    if (!cv || !simRef.current.nodes.length) return;
    const w = cv.clientWidth, h = cv.clientHeight;
    const b = simRef.current.bounds();
    const pad = 70;
    const zx = (w - pad * 2) / Math.max(60, b.x2 - b.x1);
    const zy = (h - pad * 2) / Math.max(60, b.y2 - b.y1);
    const z = Math.min(2, Math.max(0.25, Math.min(zx, zy)));
    camRef.current = { x: (b.x1 + b.x2) / 2, y: (b.y1 + b.y2) / 2, z };
  }, []);

  // ── Chizish sikli ──
  useEffect(() => {
    const cv = cvRef.current;
    const wrap = wrapRef.current;
    if (!cv || !wrap) return;

    let fitted = false;
    let settleTicks = 0;

    const draw = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = wrap.clientWidth, h = wrap.clientHeight;
      if (cv.width !== w * dpr || cv.height !== h * dpr) {
        cv.width = w * dpr; cv.height = h * dpr;
        cv.style.width = `${w}px`; cv.style.height = `${h}px`;
      }
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const sim = simRef.current;
      const moving = sim.tick();
      if (moving) settleTicks = 0; else settleTicks++;
      // Joylashib bo'lgach bir marta ekranga moslaymiz
      if (!fitted && !moving && sim.nodes.length) { fit(); fitted = true; }

      const cam = camRef.current;
      const cx = w / 2, cy = h / 2;
      const sx = (x: number) => (x - cam.x) * cam.z + cx;
      const sy = (y: number) => (y - cam.y) * cam.z + cy;

      ctx.clearRect(0, 0, w, h);

      const active = activeRef.current;
      // Tanlangan tugunning qo'shnilari
      const near = new Set<string>();
      if (active) {
        near.add(active);
        for (const l of sim.links) {
          if (l.source === active) near.add(l.target);
          if (l.target === active) near.add(l.source);
        }
      }

      // ── Qirralar ──
      ctx.lineCap = "round";
      for (const l of sim.links) {
        const a = sim.get(l.source), b = sim.get(l.target);
        if (!a || !b) continue;
        const lit = !active || (near.has(l.source) && near.has(l.target));
        ctx.globalAlpha = lit ? (active ? 0.7 : 0.32) : 0.07;
        ctx.strokeStyle = active && lit ? TEAL : "#94a3b8";
        ctx.lineWidth = (active && lit ? 1.8 : 1.1) * Math.max(0.6, Math.min(1.6, cam.z));
        ctx.beginPath();
        ctx.moveTo(sx(a.x), sy(a.y));
        ctx.lineTo(sx(b.x), sy(b.y));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // ── Tugunlar ──
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      for (const n of sim.nodes) {
        const p = n.payload as GNode;
        const X = sx(n.x), Y = sy(n.y);
        const r = (6 + Math.min(9, n.deg * 1.8)) * Math.max(0.7, Math.min(1.5, cam.z));
        const lit = !active || near.has(n.id);
        const col = p.missing ? "#94a3b8" : kindColor(p.kind);

        ctx.globalAlpha = lit ? 1 : 0.15;

        // Tanlangan tugun atrofida halqa
        if (n.id === active) {
          ctx.beginPath();
          ctx.arc(X, Y, r + 7, 0, Math.PI * 2);
          ctx.fillStyle = col;
          ctx.globalAlpha = 0.2;
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        ctx.beginPath();
        ctx.arc(X, Y, r, 0, Math.PI * 2);
        if (p.missing) {
          // Hali yaratilmagan — ichi bo'sh doira
          ctx.fillStyle = "#ffffff";
          ctx.fill();
          ctx.strokeStyle = col;
          ctx.lineWidth = 1.8;
          ctx.setLineDash([3, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          ctx.fillStyle = col;
          ctx.fill();
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Yorliq — yetarlicha kattalashtirilganda yoki tanlangan bo'lsa
        if (cam.z > 0.55 || n.id === active) {
          ctx.globalAlpha = lit ? 0.95 : 0.12;
          ctx.font = `600 ${Math.round(11 * Math.max(0.85, Math.min(1.25, cam.z)))}px system-ui, sans-serif`;
          ctx.fillStyle = "#334155";
          const label = n.label.length > 22 ? `${n.label.slice(0, 21)}…` : n.label;
          ctx.fillText(label, X, Y + r + 4);
        }
      }
      ctx.globalAlpha = 1;

      // Tinchlangandan keyin ham chizishda davom etamiz (kamera surilishi mumkin),
      // lekin protsessorni bo'shatish uchun kadrni siyraklashtiramiz
      rafRef.current = requestAnimationFrame(settleTicks > 120 ? () => setTimeout(draw, 60) : draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [fit]);

  // ── Bosish / sudrash ──
  const nodeAt = (px: number, py: number) => {
    const cv = cvRef.current;
    if (!cv) return null;
    const cam = camRef.current;
    const cx = cv.clientWidth / 2, cy = cv.clientHeight / 2;
    let best: SimNode | null = null;
    let bestD = 26; // barmoq uchun kengroq nishon
    for (const n of simRef.current.nodes) {
      const X = (n.x - cam.x) * cam.z + cx;
      const Y = (n.y - cam.y) * cam.z + cy;
      const d = Math.hypot(X - px, Y - py);
      if (d < bestD) { bestD = d; best = n; }
    }
    return best;
  };

  const toLocal = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const { x, y } = toLocal(e);
    const hit = nodeAt(x, y);
    if (hit) hit.fixed = true;
    dragRef.current = { id: hit?.id ?? null, x, y, moved: false };
  };

  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const { x, y } = toLocal(e);
    const dx = x - d.x, dy = y - d.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) d.moved = true;
    const cam = camRef.current;

    if (d.id) {
      const n = simRef.current.get(d.id);
      if (n) { n.x += dx / cam.z; n.y += dy / cam.z; simRef.current.reheat(0.3); }
    } else {
      cam.x -= dx / cam.z;
      cam.y -= dy / cam.z;
    }
    d.x = x; d.y = y;
  };

  const onUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    if (d.id) {
      const n = simRef.current.get(d.id);
      if (n) n.fixed = false;
    }
    if (d.moved) return;

    // Oddiy bosish — tugunni tanlash / bo'sh joyga bosilsa tanlovni olib tashlash
    const { x, y } = toLocal(e);
    const hit = nodeAt(x, y);
    if (hit) {
      activeRef.current = hit.id;
      setSel(hit.payload as GNode);
    } else {
      activeRef.current = null;
      setSel(null);
    }
  };

  // ── Ikki barmoq bilan kattalashtirish + sichqoncha g'ildiragi ──
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinchRef.current = { d: dist(e.touches), z: camRef.current.z };
        dragRef.current = null;
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      const p = pinchRef.current;
      if (e.touches.length === 2 && p) {
        e.preventDefault();
        const k = dist(e.touches) / (p.d || 1);
        camRef.current.z = Math.max(0.2, Math.min(3, p.z * k));
      }
    };
    const onTouchEnd = () => { pinchRef.current = null; };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const cam = camRef.current;
      cam.z = Math.max(0.2, Math.min(3, cam.z * (e.deltaY < 0 ? 1.12 : 0.89)));
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("wheel", onWheel);
    };
  }, []);

  return (
    <div ref={wrapRef} className="fixed inset-0 touch-none bg-[#eef4f8]">
      <canvas
        ref={cvRef}
        className="h-full w-full"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => { dragRef.current = null; }}
      />

      {/* ── Yuqori panel ── */}
      <div className="pointer-events-none absolute inset-x-0 top-0 mx-auto flex max-w-md items-center gap-3 p-4">
        <Link
          href="/student/gehirn"
          aria-label={t.back}
          className="pointer-events-auto grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white shadow-[0_6px_16px_rgba(19,78,94,0.16)]"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5.5 8.5 12l6.5 6.5" />
          </svg>
        </Link>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[17px] font-extrabold text-slate-900">{t.graph}</div>
          <div className="truncate text-[12px] text-slate-500">
            {nodes.length} {t.notes} · {links.length} {t.links}
          </div>
        </div>
        <button
          onClick={fit}
          aria-label={t.graph}
          className="pointer-events-auto grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white shadow-[0_6px_16px_rgba(19,78,94,0.16)]"
        >
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15" />
          </svg>
        </button>
      </div>

      {/* ── Bo'sh holat ── */}
      {nodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center px-8 text-center">
          <div>
            <div className="text-4xl">🧠</div>
            <p className="mt-2 text-[14px] font-semibold text-slate-500">{t.emptyGraph}</p>
          </div>
        </div>
      )}

      {/* ── Tanlangan tugun kartasi ── */}
      {sel ? (
        <div className="absolute inset-x-0 bottom-0 p-4">
          <div className="mx-auto max-w-md rounded-[24px] bg-white p-4 shadow-[0_-6px_24px_rgba(19,78,94,0.18)]">
            <div className="flex items-center gap-3">
              <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: sel.missing ? "#cbd5e1" : kindColor(sel.kind) }} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-extrabold text-slate-900">{sel.title}</div>
                <div className="text-[11.5px] text-slate-400">
                  {sel.missing ? t.notCreatedYet : `${sel.deg} ${t.links}`}
                </div>
              </div>
              <button
                onClick={() => {
                  if (sel.missing) {
                    import("../actions").then(({ createFromLink }) =>
                      createFromLink(sel.title).then((r) => { if (r.id) router.push(`/student/gehirn/${r.id}`); }));
                  } else {
                    router.push(`/student/gehirn/${sel.id}`);
                  }
                }}
                className="shrink-0 rounded-2xl px-4 py-2.5 text-[13px] font-bold text-white"
                style={{ background: TEAL }}
              >
                {sel.missing ? t.createIt : t.open}
              </button>
            </div>
          </div>
        </div>
      ) : (
        nodes.length > 0 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 mx-auto max-w-md p-5 text-center">
            <span className="rounded-full bg-white/85 px-3.5 py-1.5 text-[12px] font-semibold text-slate-500 backdrop-blur-sm">
              {t.graphHint}
            </span>
          </div>
        )
      )}
    </div>
  );
}
