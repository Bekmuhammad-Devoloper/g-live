"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { cn } from "@/lib/cn";
import { Icon } from "../_components/Icon";
import { GraphSim, DEFAULT_FORCES, type Forces, type SimLink, type SimNode } from "./graphSim";
import type { VTask } from "./TasksView";

// Obsidian "Graph View" uslubidagi bog'lanishlar xaritasi:
// kuch simulyatsiyasi, cheksiz kanvas, zoom/pan, tugunni sudrash,
// qo'shni tugunlarni yoritish va jonli sozlamalar paneli.

export type Lens = "all" | "student" | "group" | "staff";

type Urg = "overdue" | "today" | "future" | "done";

const GROUP_COLOR: Record<string, string> = {
  student: "#10b981",
  group: "#3b82f6",
  staff: "#8b5cf6",
  overdue: "#ef4444",
  today: "#f59e0b",
  future: "#6366f1",
  done: "#94a3b8",
};

const GROUP_LABEL: Record<string, { uz: string; ru: string; en: string; de?: string }> = {
  student: { uz: "O'quvchi", ru: "Ученик", en: "Student", de: "Schüler" },
  group: { uz: "Guruh", ru: "Группа", en: "Group", de: "Gruppe" },
  staff: { uz: "Mas'ul shaxs", ru: "Ответственный", en: "Assignee", de: "Verantwortlicher" },
  overdue: { uz: "O'tib ketgan", ru: "Просрочено", en: "Overdue", de: "Überfällig" },
  today: { uz: "Bugun", ru: "Сегодня", en: "Today", de: "Heute" },
  future: { uz: "Kelajak", ru: "Будущее", en: "Future", de: "Zukunft" },
  done: { uz: "Bajarilgan", ru: "Выполнено", en: "Done", de: "Erledigt" },
};

function urgencyOf(t: VTask): Urg {
  if (t.status === "DONE") return "done";
  if (!t.dueAt) return "future";
  const d = new Date(t.dueAt);
  const a = new Date(); a.setHours(0, 0, 0, 0);
  const b = new Date(); b.setHours(23, 59, 59, 999);
  return d < a ? "overdue" : d <= b ? "today" : "future";
}

// Barqaror boshlang'ich joylashuv (Math.random emas — SSR/CSR mos kelsin)
function hash01(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10000) / 10000;
}

interface Display {
  nodeSize: number;      // 0.4 .. 2
  linkThickness: number; // 0.4 .. 3
  textFade: number;      // 0 .. 2   (shu zoomdan pastda yozuvlar yashirinadi)
  showArrows: boolean;
  showOrphans: boolean;
}
const DEFAULT_DISPLAY: Display = { nodeSize: 1, linkThickness: 1, textFade: 0.55, showArrows: false, showOrphans: true };

interface Props {
  tasks: VTask[];
  onSelect: (t: VTask) => void;
  lens?: Lens;
  locale: Locale;
}

export default function GraphView({ tasks, onSelect, lens = "all", locale }: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simRef = useRef(new GraphSim());
  const camRef = useRef({ x: 0, y: 0, z: 1 });       // kamera: siljish + masshtab
  const hoverRef = useRef<string | null>(null);
  const dragRef = useRef<{ id: string | null; sx: number; sy: number; moved: boolean } | null>(null);
  const rafRef = useRef<number | null>(null);
  const darkRef = useRef(false);

  const [forces, setForces] = useState<Forces>({ ...DEFAULT_FORCES });
  const [display, setDisplay] = useState<Display>({ ...DEFAULT_DISPLAY });
  const [q, setQ] = useState("");
  const [panel, setPanel] = useState(false);
  const [open, setOpen] = useState({ filter: true, groups: true, display: false, forces: false });
  const [hoverLabel, setHoverLabel] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  // ── Ma'lumot → graf ──
  const { nodes, links, groupsUsed } = useMemo(() => {
    const allowed: string[] = lens === "all" ? ["student", "group", "staff"] : [lens];
    const nodeMap = new Map<string, SimNode>();
    const links: SimLink[] = [];

    const hub = (type: string, name: string | null | undefined) => {
      if (!name || !allowed.includes(type)) return null;
      const id = `${type}:${name}`;
      let h = nodeMap.get(id);
      if (!h) {
        h = { id, label: name, group: type, deg: 0, x: (hash01(id) - 0.5) * 600, y: (hash01(id + "y") - 0.5) * 600, vx: 0, vy: 0, fixed: false };
        nodeMap.set(id, h);
      }
      h.deg++;
      return h;
    };

    for (const t of tasks) {
      const urg = urgencyOf(t);
      const hubs = [hub("student", t.student), hub("group", t.group), hub("staff", t.assignee)].filter(Boolean) as SimNode[];
      if (!hubs.length && !display.showOrphans) continue;
      const id = `task:${t.id}`;
      nodeMap.set(id, {
        id, label: t.title, group: urg, deg: hubs.length,
        x: (hash01(id) - 0.5) * 400, y: (hash01(id + "y") - 0.5) * 400,
        vx: 0, vy: 0, fixed: false, payload: t,
      });
      for (const h of hubs) links.push({ source: id, target: h.id, color: GROUP_COLOR[urg] });
    }

    const list = [...nodeMap.values()];
    const used = new Set(list.map((n) => n.group));
    return { nodes: list, links, groupsUsed: [...used] };
  }, [tasks, lens, display.showOrphans]);

  // Qidiruvga mos tugunlar (bo'sh so'rovda — hammasi)
  const matched = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return null;
    return new Set(nodes.filter((n) => n.label.toLowerCase().includes(s)).map((n) => n.id));
  }, [q, nodes]);

  // Qo'shnilar jadvali — hover paytida yoritish uchun
  const neighbors = useMemo(() => {
    const m = new Map<string, Set<string>>();
    const add = (a: string, b: string) => { if (!m.has(a)) m.set(a, new Set()); m.get(a)!.add(b); };
    for (const l of links) { add(l.source, l.target); add(l.target, l.source); }
    return m;
  }, [links]);

  useEffect(() => { simRef.current.setData(nodes, links); }, [nodes, links]);
  useEffect(() => { simRef.current.forces = forces; simRef.current.reheat(0.35); }, [forces]);

  // Mavzu (yorug'/qorong'i) — kanvas ranglari shunga moslashadi
  useEffect(() => {
    const read = () => { darkRef.current = document.documentElement.classList.contains("dark"); };
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);

  // ── Chizish ──
  const draw = useCallback(() => {
    const cv = canvasRef.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== w * dpr || cv.height !== h * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const dark = darkRef.current;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = dark ? "#0b1220" : "#fbfcfe";
    ctx.fillRect(0, 0, w, h);

    const cam = camRef.current;
    const sim = simRef.current;
    sim.center = { x: 0, y: 0 };

    // Dunyodan ekranga: (p - cam) * z + markaz
    const sx = (x: number) => (x - cam.x) * cam.z + w / 2;
    const sy = (y: number) => (y - cam.y) * cam.z + h / 2;

    const hovered = hoverRef.current;
    const near = hovered ? neighbors.get(hovered) ?? new Set<string>() : null;
    const isLit = (id: string) => {
      if (matched && !matched.has(id)) return false;
      if (!hovered) return true;
      return id === hovered || (near?.has(id) ?? false);
    };

    // ── Bog'lanishlar ──
    ctx.lineCap = "round";
    for (const l of links) {
      const a = sim.get(l.source), b = sim.get(l.target);
      if (!a || !b) continue;
      const lit = isLit(a.id) && isLit(b.id);
      const touching = hovered && (l.source === hovered || l.target === hovered);
      ctx.globalAlpha = touching ? 0.85 : lit ? (hovered || matched ? 0.28 : 0.22) : 0.04;
      ctx.strokeStyle = touching ? l.color : dark ? "#64748b" : "#94a3b8";
      ctx.lineWidth = (touching ? 1.8 : 1) * display.linkThickness * Math.max(0.5, cam.z);
      ctx.beginPath();
      ctx.moveTo(sx(a.x), sy(a.y));
      ctx.lineTo(sx(b.x), sy(b.y));
      ctx.stroke();

      if (display.showArrows && cam.z > 0.5) {
        const ang = Math.atan2(sy(b.y) - sy(a.y), sx(b.x) - sx(a.x));
        const r = nodeRadius(b) * cam.z + 3;
        const tipX = sx(b.x) - Math.cos(ang) * r, tipY = sy(b.y) - Math.sin(ang) * r;
        const s = 5 * Math.max(0.6, cam.z);
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(tipX - Math.cos(ang - 0.4) * s, tipY - Math.sin(ang - 0.4) * s);
        ctx.lineTo(tipX - Math.cos(ang + 0.4) * s, tipY - Math.sin(ang + 0.4) * s);
        ctx.closePath();
        ctx.fill();
      }
    }

    // ── Tugunlar ──
    const labelAlpha = Math.max(0, Math.min(1, (cam.z - display.textFade) / 0.35));
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    for (const n of sim.nodes) {
      const X = sx(n.x), Y = sy(n.y);
      const r = nodeRadius(n) * cam.z;
      if (X < -60 || Y < -60 || X > w + 60 || Y > h + 60) continue;   // ekrandan tashqarida
      const lit = isLit(n.id);
      ctx.globalAlpha = lit ? 1 : 0.12;

      const color = GROUP_COLOR[n.group] ?? "#94a3b8";
      if (n.id === hovered) {                       // hover — yumshoq nur
        ctx.beginPath();
        ctx.arc(X, Y, r + 7, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.18;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.beginPath();
      ctx.arc(X, Y, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = dark ? "#0b1220" : "#ffffff";
      ctx.stroke();

      // Yozuv — zoom yetarli bo'lsa yoki shu tugun hover bo'lsa
      const la = n.id === hovered ? 1 : labelAlpha;
      if (la > 0.02 && lit) {
        ctx.globalAlpha = la * (lit ? 1 : 0.2);
        ctx.font = `${Math.round(11 * Math.max(0.85, Math.min(1.5, cam.z)))}px ui-sans-serif, system-ui, sans-serif`;
        ctx.fillStyle = dark ? "#cbd5e1" : "#475569";
        const text = n.label.length > 22 ? n.label.slice(0, 21) + "…" : n.label;
        ctx.fillText(text, X, Y + r + 4);
      }
    }
    ctx.globalAlpha = 1;

    function nodeRadius(n: SimNode) {
      return (3.2 + Math.sqrt(n.deg) * 2.4) * display.nodeSize;
    }
  }, [links, neighbors, matched, display]);

  // ── Animatsiya halqasi ──
  useEffect(() => {
    let stop = false;
    const loop = () => {
      if (stop) return;
      simRef.current.tick();
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { stop = true; if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [draw]);

  // ── Dastlabki moslash: butun graf ekranga sig'sin ──
  const fit = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const b = simRef.current.bounds();
    const w = cv.clientWidth, h = cv.clientHeight;
    const gw = Math.max(120, b.x2 - b.x1), gh = Math.max(120, b.y2 - b.y1);
    const z = Math.min(w / (gw + 140), h / (gh + 140), 2);
    camRef.current = { x: (b.x1 + b.x2) / 2, y: (b.y1 + b.y2) / 2, z: Math.max(0.15, z) };
  }, []);

  useEffect(() => {
    const t = setTimeout(fit, 700);   // simulyatsiya biroz joylashgach
    return () => clearTimeout(t);
  }, [fit, nodes.length]);

  // ── Sichqoncha ──
  const worldAt = (e: { clientX: number; clientY: number }) => {
    const cv = canvasRef.current!;
    const r = cv.getBoundingClientRect();
    const cam = camRef.current;
    return {
      x: (e.clientX - r.left - r.width / 2) / cam.z + cam.x,
      y: (e.clientY - r.top - r.height / 2) / cam.z + cam.y,
    };
  };

  const pick = (e: { clientX: number; clientY: number }): SimNode | null => {
    const p = worldAt(e);
    let best: SimNode | null = null;
    let bestD = Infinity;
    for (const n of simRef.current.nodes) {
      const r = (3.2 + Math.sqrt(n.deg) * 2.4) * display.nodeSize + 6 / camRef.current.z;
      const d = Math.hypot(n.x - p.x, n.y - p.y);
      if (d < r && d < bestD) { best = n; bestD = d; }
    }
    return best;
  };

  const onDown = (e: React.MouseEvent) => {
    const n = pick(e);
    dragRef.current = { id: n?.id ?? null, sx: e.clientX, sy: e.clientY, moved: false };
    if (n) { n.fixed = true; simRef.current.reheat(0.3); }
  };

  const onMove = (e: React.MouseEvent) => {
    const d = dragRef.current;
    if (d) {
      if (Math.abs(e.clientX - d.sx) > 2 || Math.abs(e.clientY - d.sy) > 2) d.moved = true;
      if (d.id) {
        const n = simRef.current.get(d.id);
        if (n) { const p = worldAt(e); n.x = p.x; n.y = p.y; n.vx = 0; n.vy = 0; simRef.current.reheat(0.3); }
      } else {
        // Fonni sudrash — kamerani siljitamiz
        const cam = camRef.current;
        cam.x -= (e.clientX - d.sx) / cam.z;
        cam.y -= (e.clientY - d.sy) / cam.z;
        d.sx = e.clientX; d.sy = e.clientY;
      }
      return;
    }
    const n = pick(e);
    const id = n?.id ?? null;
    if (id !== hoverRef.current) {
      hoverRef.current = id;
      setHoverLabel(n ? n.label : null);
      const cv = canvasRef.current;
      if (cv) cv.style.cursor = id ? "pointer" : "grab";
    }
  };

  const onUp = (e: React.MouseEvent) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    if (d.id) {
      const n = simRef.current.get(d.id);
      if (n) n.fixed = false;                       // qo'yib yuborilgach yana fizikaga bo'ysunadi
      if (!d.moved && n?.payload) onSelect(n.payload as VTask);   // bosish — batafsil oyna
    }
    void e;
  };

  const onWheel = (e: React.WheelEvent) => {
    const cv = canvasRef.current!;
    const r = cv.getBoundingClientRect();
    const cam = camRef.current;
    const before = worldAt(e);
    const k = Math.exp(-e.deltaY * 0.0015);
    cam.z = Math.max(0.08, Math.min(6, cam.z * k));
    // Kursor ostidagi nuqta joyida qolsin
    const after = {
      x: (e.clientX - r.left - r.width / 2) / cam.z + cam.x,
      y: (e.clientY - r.top - r.height / 2) / cam.z + cam.y,
    };
    cam.x += before.x - after.x;
    cam.y += before.y - after.y;
  };

  const zoomBy = (k: number) => { const c = camRef.current; c.z = Math.max(0.08, Math.min(6, c.z * k)); };

  if (tasks.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-16 text-center dark:border-slate-700">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-500/10 text-brand-500">
          <Icon name="layers" className="h-7 w-7" />
        </div>
        <h3 className="mt-3 text-lg font-bold text-slate-700 dark:text-slate-200">
          {tr(locale, { uz: "Bog'lanishlar xaritasi bo'sh", ru: "Граф связей пуст", en: "The graph is empty", de: "Der Graph ist leer" })}
        </h3>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-500 dark:text-slate-400">
          {tr(locale, {
            uz: "Eslatma qo'shsangiz — u o'quvchi, guruh va mas'ul shaxs bilan bog'lanib xaritada paydo bo'ladi.",
            ru: "Добавьте напоминание — оно появится на графе, связанное с учеником, группой и ответственным.",
            en: "Add a reminder — it appears on the graph, linked to its student, group and assignee.",
            de: "Fügen Sie eine Erinnerung hinzu — sie erscheint im Graphen, verknüpft mit Schüler, Gruppe und Verantwortlichem.",
          })}
        </p>
      </div>
    );
  }

  return (
    <div className={cn(
      "overflow-hidden rounded-2xl border border-slate-200/70 bg-white dark:border-slate-800 dark:bg-slate-900",
      fullscreen && "fixed inset-3 z-[70] rounded-2xl shadow-2xl",
    )}>
      <div className="relative" style={{ height: fullscreen ? "calc(100vh - 24px)" : 620 }}>
        <canvas
          ref={canvasRef}
          className="h-full w-full touch-none select-none"
          style={{ cursor: "grab" }}
          onMouseDown={onDown}
          onMouseMove={onMove}
          onMouseUp={onUp}
          onMouseLeave={() => { dragRef.current = null; hoverRef.current = null; setHoverLabel(null); }}
          onWheel={onWheel}
        />

        {/* Yuqori chap: qidiruv + hover nomi */}
        <div className="pointer-events-none absolute left-3 top-3 flex max-w-[60%] flex-col gap-2">
          <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-2.5 py-1.5 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/90">
            <Icon name="search" className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={tr(locale, { uz: "Xaritadan qidirish…", ru: "Поиск по графу…", en: "Search graph…", de: "Graph durchsuchen…" })}
              className="w-44 bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-200"
            />
            {q && <button onClick={() => setQ("")} className="text-slate-400 hover:text-slate-600"><Icon name="close" className="h-3.5 w-3.5" /></button>}
          </div>
          {hoverLabel && (
            <span className="w-fit max-w-full truncate rounded-lg bg-slate-900/85 px-2.5 py-1 text-[11px] font-medium text-white shadow-sm">
              {hoverLabel}
            </span>
          )}
        </div>

        {/* Yuqori o'ng: boshqaruv tugmalari */}
        <div className="absolute right-3 top-3 flex items-center gap-1.5">
          <Ctrl title={tr(locale, { uz: "Kattalashtirish", ru: "Приблизить", en: "Zoom in", de: "Vergrößern" })} icon="plus" onClick={() => zoomBy(1.25)} />
          <Ctrl title={tr(locale, { uz: "Kichraytirish", ru: "Отдалить", en: "Zoom out", de: "Verkleinern" })} icon="minimize" onClick={() => zoomBy(0.8)} />
          <Ctrl title={tr(locale, { uz: "Ekranga moslash", ru: "Вписать", en: "Fit to screen", de: "An Bildschirm anpassen" })} icon="expand" onClick={fit} />
          <Ctrl title={tr(locale, { uz: "To'liq ekran", ru: "На весь экран", en: "Fullscreen", de: "Vollbild" })} icon={fullscreen ? "minimize" : "expand"} onClick={() => { setFullscreen((v) => !v); setTimeout(fit, 60); }} />
          <Ctrl title={tr(locale, { uz: "Sozlamalar", ru: "Настройки", en: "Settings", de: "Einstellungen" })} icon="settings" active={panel} onClick={() => setPanel((v) => !v)} />
        </div>

        {/* O'ng panel — Obsidian uslubidagi bo'limlar */}
        {panel && (
          <div className="absolute right-3 top-14 max-h-[calc(100%-72px)] w-[248px] overflow-y-auto rounded-xl border border-slate-200 bg-white/95 p-1 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
            <Section title={tr(locale, { uz: "Filtrlar", ru: "Фильтры", en: "Filters", de: "Filter" })} open={open.filter} onToggle={() => setOpen((o) => ({ ...o, filter: !o.filter }))}>
              <Toggle label={tr(locale, { uz: "Bog'lanmaganlarni ko'rsatish", ru: "Показывать одиночные", en: "Show orphans", de: "Verwaiste anzeigen" })}
                checked={display.showOrphans} onChange={(v) => setDisplay((d) => ({ ...d, showOrphans: v }))} />
              <p className="px-1 pt-1 text-[10px] leading-relaxed text-slate-400">
                {tr(locale, { uz: "Hech kimga biriktirilmagan eslatmalar.", ru: "Напоминания без связей.", en: "Reminders with no links.", de: "Erinnerungen ohne Verknüpfungen." })}
              </p>
            </Section>

            <Section title={tr(locale, { uz: "Guruhlar", ru: "Группы", en: "Groups", de: "Gruppen" })} open={open.groups} onToggle={() => setOpen((o) => ({ ...o, groups: !o.groups }))}>
              <div className="space-y-1">
                {groupsUsed.map((g) => (
                  <div key={g} className="flex items-center gap-2 px-1 py-0.5 text-[11px] text-slate-600 dark:text-slate-300">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: GROUP_COLOR[g] }} />
                    {GROUP_LABEL[g] ? tr(locale, GROUP_LABEL[g]) : g}
                    <span className="ml-auto tabular-nums text-slate-400">{nodes.filter((n) => n.group === g).length}</span>
                  </div>
                ))}
              </div>
            </Section>

            <Section title={tr(locale, { uz: "Ko'rinish", ru: "Отображение", en: "Display", de: "Anzeige" })} open={open.display} onToggle={() => setOpen((o) => ({ ...o, display: !o.display }))}>
              <Slider label={tr(locale, { uz: "Tugun o'lchami", ru: "Размер узла", en: "Node size", de: "Knotengröße" })} min={0.4} max={2} step={0.05}
                value={display.nodeSize} onChange={(v) => setDisplay((d) => ({ ...d, nodeSize: v }))} />
              <Slider label={tr(locale, { uz: "Chiziq qalinligi", ru: "Толщина связей", en: "Link thickness", de: "Verbindungsdicke" })} min={0.4} max={3} step={0.1}
                value={display.linkThickness} onChange={(v) => setDisplay((d) => ({ ...d, linkThickness: v }))} />
              <Slider label={tr(locale, { uz: "Yozuv chegarasi", ru: "Порог текста", en: "Text fade threshold", de: "Textausblend-Schwelle" })} min={0} max={2} step={0.05}
                value={display.textFade} onChange={(v) => setDisplay((d) => ({ ...d, textFade: v }))} />
              <Toggle label={tr(locale, { uz: "Yo'nalish strelkalari", ru: "Стрелки", en: "Arrows", de: "Pfeile" })}
                checked={display.showArrows} onChange={(v) => setDisplay((d) => ({ ...d, showArrows: v }))} />
            </Section>

            <Section title={tr(locale, { uz: "Kuchlar", ru: "Силы", en: "Forces", de: "Kräfte" })} open={open.forces} onToggle={() => setOpen((o) => ({ ...o, forces: !o.forces }))}>
              <Slider label={tr(locale, { uz: "Markazga tortish", ru: "Центр", en: "Center force", de: "Zentralkraft" })} min={0} max={1} step={0.02}
                value={forces.center} onChange={(v) => setForces((f) => ({ ...f, center: v }))} />
              <Slider label={tr(locale, { uz: "Itarish kuchi", ru: "Отталкивание", en: "Repel force", de: "Abstoßungskraft" })} min={0} max={30} step={0.5}
                value={forces.repel} onChange={(v) => setForces((f) => ({ ...f, repel: v }))} />
              <Slider label={tr(locale, { uz: "Bog'lanish kuchi", ru: "Сила связей", en: "Link force", de: "Verbindungskraft" })} min={0} max={2} step={0.05}
                value={forces.link} onChange={(v) => setForces((f) => ({ ...f, link: v }))} />
              <Slider label={tr(locale, { uz: "Bog'lanish uzunligi", ru: "Длина связей", en: "Link distance", de: "Verbindungslänge" })} min={30} max={300} step={5}
                value={forces.distance} onChange={(v) => setForces((f) => ({ ...f, distance: v }))} />
              <button
                onClick={() => { setForces({ ...DEFAULT_FORCES }); setDisplay({ ...DEFAULT_DISPLAY }); }}
                className="mt-1.5 w-full rounded-lg border border-slate-200 py-1.5 text-[11px] font-medium text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                {tr(locale, { uz: "Standart holatga qaytarish", ru: "Сбросить настройки", en: "Restore defaults", de: "Standard wiederherstellen" })}
              </button>
            </Section>
          </div>
        )}

        {/* Pastki chap: hisob */}
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-white/85 px-2.5 py-1 text-[11px] text-slate-500 shadow-sm backdrop-blur dark:bg-slate-900/85 dark:text-slate-400">
          {nodes.length} {tr(locale, { uz: "tugun", ru: "узлов", en: "nodes", de: "Knoten" })} · {links.length} {tr(locale, { uz: "bog'lanish", ru: "связей", en: "links", de: "Verbindungen" })}
        </div>
      </div>

      <p className="border-t border-slate-100 px-4 py-2 text-center text-[11px] text-slate-400 dark:border-slate-800">
        {tr(locale, {
          uz: "Sudrab suring · g'ildirak bilan kattalashtiring · tugunni sudrang · ustiga borsangiz qo'shnilari yoritiladi · bosing — batafsil",
          ru: "Тяните для перемещения · колесо — масштаб · тяните узел · наведите — подсветятся соседи · клик — подробнее",
          en: "Drag to pan · wheel to zoom · drag a node · hover to highlight neighbours · click for details",
          de: "Ziehen zum Verschieben · Mausrad zum Zoomen · Knoten ziehen · Hover hebt Nachbarn hervor · Klick für Details",
        })}
      </p>
    </div>
  );
}

// ─────────── Yordamchi boshqaruvlar ───────────

function Ctrl({ title, icon, onClick, active }: { title: string; icon: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={cn(
        "grid h-8 w-8 place-items-center rounded-lg border shadow-sm backdrop-blur transition",
        active
          ? "border-brand-300 bg-brand-50 text-brand-600 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-300"
          : "border-slate-200 bg-white/90 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-400 dark:hover:bg-slate-800",
      )}
    >
      <Icon name={icon} className="h-4 w-4" />
    </button>
  );
}

function Section({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="border-b border-slate-100 last:border-0 dark:border-slate-800">
      <button onClick={onToggle} className="flex w-full items-center gap-1.5 px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
        <Icon name="chevronDown" className={cn("h-3 w-3 transition-transform", !open && "-rotate-90")} />
        {title}
      </button>
      {open && <div className="px-2 pb-2.5">{children}</div>}
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <label className="mb-2 block last:mb-0">
      <span className="mb-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
        {label}
        <span className="tabular-nums text-slate-400">{value}</span>
      </span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-600 dark:bg-slate-700"
      />
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 px-1 py-1 text-[11px] text-slate-600 dark:text-slate-300">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-3.5 w-3.5 rounded accent-brand-600" />
      {label}
    </label>
  );
}
