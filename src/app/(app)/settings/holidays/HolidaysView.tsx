"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { Icon } from "../../_components/Icon";

interface Holiday {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  createdAt: string; // ISO
  affectsPayment: boolean;
}

const KEY = "gl:holidays";

const p2 = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const fmt = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : s;
};
const newId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

function load(): Holiday[] {
  try { const raw = localStorage.getItem(KEY); return raw ? (JSON.parse(raw) as Holiday[]) : []; } catch { return []; }
}
function persist(list: Holiday[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

export default function HolidaysView() {
  const [items, setItems] = useState<Holiday[]>([]);
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [drawer, setDrawer] = useState<{ open: boolean; edit?: Holiday }>({ open: false });

  useEffect(() => { setItems(load()); }, []);

  const today = ymd(new Date());
  const shown = useMemo(() => {
    const list = items.filter((h) => (tab === "upcoming" ? h.date >= today : h.date < today));
    return [...list].sort((a, b) => (tab === "upcoming" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));
  }, [items, tab, today]);

  function save(h: Holiday) {
    setItems((cur) => {
      const exists = cur.some((x) => x.id === h.id);
      const next = exists ? cur.map((x) => (x.id === h.id ? h : x)) : [...cur, h];
      persist(next);
      return next;
    });
  }
  function remove(id: string) {
    if (!confirm("Ushbu kunni o'chirmoqchimisiz?")) return;
    setItems((cur) => { const next = cur.filter((x) => x.id !== id); persist(next); return next; });
  }

  return (
    <div>
      {/* Sarlavha + qo'shish */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Dam olish kunlari</h1>
        <button
          onClick={() => setDrawer({ open: true })}
          className="rounded-lg bg-blue-500 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600"
        >
          Yangisini qo&apos;shish
        </button>
      </div>

      {/* Tab'lar */}
      <div className="mb-5 flex gap-6 border-b border-slate-200/70 dark:border-slate-800">
        {([["upcoming", "Kelajakdagi"], ["past", "Yakunlangan"]] as const).map(([k, lbl]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn(
              "relative -mb-px pb-3 text-sm font-medium transition",
              tab === k ? "text-blue-600 dark:text-blue-400" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            )}
          >
            {lbl}
            {tab === k && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-t bg-blue-500" />}
          </button>
        ))}
      </div>

      {/* Jadval */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-slate-200/70 text-slate-500 dark:border-slate-800">
              <tr>
                <th className="px-5 py-4 font-medium">Ism</th>
                <th className="px-5 py-4 font-medium">Bayram sanasi</th>
                <th className="px-5 py-4 font-medium">Yaratilgan</th>
                <th className="px-5 py-4 font-medium">To&apos;lovga ta&apos;sir qiladi</th>
                <th className="px-5 py-4 text-right font-medium">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {shown.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center text-slate-400">Bo&apos;sh</td>
                </tr>
              ) : (
                shown.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-5 py-3.5 font-medium text-slate-800 dark:text-slate-100">{h.name}</td>
                    <td className="px-5 py-3.5 tabular-nums text-slate-600 dark:text-slate-300">{fmt(h.date)}</td>
                    <td className="px-5 py-3.5 tabular-nums text-slate-500">{fmt(h.createdAt)}</td>
                    <td className="px-5 py-3.5">
                      {h.affectsPayment
                        ? <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400">Ha</span>
                        : <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:text-slate-400">Yo&apos;q</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setDrawer({ open: true, edit: h })} title="Tahrirlash" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-800">
                          <Icon name="edit" className="h-4 w-4" />
                        </button>
                        <button onClick={() => remove(h.id)} title="O'chirish" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10">
                          <Icon name="trash" className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {drawer.open && (
        <HolidayDrawer
          edit={drawer.edit}
          onClose={() => setDrawer({ open: false })}
          onSave={(h) => { save(h); setDrawer({ open: false }); }}
        />
      )}
    </div>
  );
}

function HolidayDrawer({ edit, onClose, onSave }: { edit?: Holiday; onClose: () => void; onSave: (h: Holiday) => void }) {
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState(edit?.name ?? "");
  const [date, setDate] = useState(edit?.date ?? "");
  const [affects, setAffects] = useState(edit?.affectsPayment ?? false);
  const [err, setErr] = useState("");

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  if (!mounted) return null;

  function submit() {
    if (name.trim().length < 2 || !date) { setErr("Ism va sana majburiy."); return; }
    onSave({
      id: edit?.id ?? newId(),
      name: name.trim(),
      date,
      createdAt: edit?.createdAt ?? new Date().toISOString(),
      affectsPayment: affects,
    });
  }

  const label = "mb-1.5 block text-sm text-slate-600 dark:text-slate-300";
  const input = "h-11 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-sm text-slate-800 outline-none transition focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100";

  return createPortal(
    <div className="fixed inset-0 z-[80]" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="animate-slide-in-right absolute right-0 top-0 flex h-full w-[440px] max-w-[92%] flex-col bg-white shadow-pop dark:bg-[#15243d]"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-white/10">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{edit ? "Tahrirlash" : "Yangi element qo'shish"}</h3>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10">✕</button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div>
            <label className={label}>Ism <span className="text-rose-500">*</span></label>
            <input value={name} onChange={(e) => { setName(e.target.value); setErr(""); }} className={input} placeholder="Masalan: Navro'z" />
          </div>
          <div>
            <label className={label}>Bayram sanasi <span className="text-rose-500">*</span></label>
            <input type="date" value={date} onChange={(e) => { setDate(e.target.value); setErr(""); }} className={input} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3.5 py-3 dark:border-slate-700">
            <span className="text-sm text-slate-600 dark:text-slate-300">To&apos;lovga ta&apos;sir qiladi</span>
            <button
              type="button"
              role="switch"
              aria-checked={affects}
              onClick={() => setAffects((v) => !v)}
              className={cn("relative h-6 w-11 rounded-full transition-colors", affects ? "bg-blue-500" : "bg-slate-300 dark:bg-slate-600")}
            >
              <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", affects ? "left-[22px]" : "left-0.5")} />
            </button>
          </div>

          {err && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">{err}</p>}
        </div>

        <div className="shrink-0 border-t border-slate-100 px-6 py-4 dark:border-white/10">
          <button onClick={submit} className="rounded-full bg-blue-500 px-8 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600">
            Saqlash
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
