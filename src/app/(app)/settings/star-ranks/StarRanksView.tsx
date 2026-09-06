"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../../_components/Icon";
import { PRESET_COLORS } from "@/lib/levelColor";
import { createStarRank, updateStarRank, deleteStarRank, toggleStarRank, setStarRankIcon, type RankInput } from "./actions";

// Yulduz pog'onalari — qo'shish, tahrirlash, o'chirish.
// Tartib qo'lda emas: ro'yxat YULDUZ CHEGARASI bo'yicha tuziladi, shu sabab
// "yuqoriga/pastga" tugmalari yo'q — chegarani o'zgartirsangiz o'zi joyiga
// tushadi va ilovadagi tartib bilan hech qachon ajralib qolmaydi.

export type RankRow = {
  id: string;
  nameUz: string;
  nameRu: string;
  nameEn: string;
  nameDe: string;
  stars: number;
  reward: number;
  color: string;
  iconUrl: string | null;
  isActive: boolean;
};

const inp =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";
const lbl = "mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400";

const EMPTY: RankInput = { nameUz: "", nameRu: "", nameEn: "", nameDe: "", stars: 0, reward: 0, color: PRESET_COLORS[1], iconUrl: null };

export default function StarRanksView({ rows, locale }: { rows: RankRow[]; locale: Locale }) {
  const [items, setItems] = useState(rows);
  const [editing, setEditing] = useState<RankRow | "new" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();
  const files = useRef<Record<string, HTMLInputElement | null>>({});

  const T = (uz: string, ru: string, en: string, de: string) => tr(locale, { uz, ru, en, de });

  useEffect(() => setItems(rows), [rows]);

  const after = (r: { ok?: boolean; error?: string }, apply?: () => void) => {
    if (r.error) setErr(r.error);
    else { setErr(null); apply?.(); }
  };

  const toggle = (it: RankRow) => {
    setErr(null);
    setItems((xs) => xs.map((x) => (x.id === it.id ? { ...x, isActive: !x.isActive } : x)));
    start(async () => after(await toggleStarRank(it.id, !it.isActive)));
  };

  // Belgini yuklash — /api/upload manzilni qaytaradi, keyin pog'onaga bog'lanadi
  const uploadIcon = async (it: RankRow, fl: File) => {
    setErr(null);
    setBusy(it.id);
    try {
      const fd = new FormData();
      fd.append("file", fl);
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok || !j.url) throw new Error();
      const res = await setStarRankIcon(it.id, j.url);
      if (res.error) setErr(res.error);
      else setItems((xs) => xs.map((x) => (x.id === it.id ? { ...x, iconUrl: j.url } : x)));
    } catch {
      setErr(T("Rasmni yuklab bo'lmadi", "Не удалось загрузить", "Upload failed", "Upload fehlgeschlagen"));
    } finally {
      setBusy(null);
    }
  };

  const clearIcon = (it: RankRow) => {
    setErr(null);
    setItems((xs) => xs.map((x) => (x.id === it.id ? { ...x, iconUrl: null } : x)));
    start(async () => after(await setStarRankIcon(it.id, null)));
  };

  const remove = (it: RankRow) => {
    setErr(null);
    start(async () => after(await deleteStarRank(it.id), () => setItems((xs) => xs.filter((x) => x.id !== it.id))));
  };

  return (
    <div className="space-y-4">
      {err ? (
        <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{err}</div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-2xl text-sm text-slate-500">
          {T(
            "O'quvchi yulduz yig'ib pog'onadan pog'onaga ko'tariladi. Har pog'onaga chiqqani uchun mukofot tanga beriladi. Chegara yoki mukofotni o'zgartirsangiz — barcha o'quvchining hisobi darhol qayta hisoblanadi.",
            "Ученик поднимается по ступеням, набирая звёзды. За каждую ступень начисляются монеты. Изменение порога или награды сразу пересчитывает баланс всех учеников.",
            "Students climb the ranks by collecting stars. Each rank pays a coin reward. Changing a threshold or reward instantly recalculates every student's balance.",
            "Schüler steigen mit Sternen auf. Jede Stufe zahlt Münzen. Änderungen wirken sofort auf alle Guthaben.",
          )}
        </p>
        <button
          type="button"
          onClick={() => { setErr(null); setEditing("new"); }}
          className="h-10 shrink-0 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          + {T("Pog'ona", "Ступень", "Rank", "Stufe")}
        </button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400 dark:border-slate-800">
          {T("Pog'ona yo'q", "Ступеней нет", "No ranks", "Keine Stufen")}
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((it, i) => (
            <div
              key={it.id}
              className={cn(
                "flex flex-wrap items-center gap-3 rounded-xl border border-slate-200/70 bg-white p-3 shadow-card dark:border-slate-800 dark:bg-slate-900",
                !it.isActive && "opacity-60",
              )}
            >
              <span
                className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl text-[15px] font-extrabold tabular-nums text-white"
                style={{ background: it.color }}
              >
                {it.iconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.iconUrl} alt="" className="h-full w-full object-contain p-1" />
                ) : (
                  i + 1
                )}
              </span>

              <div className="min-w-[150px] flex-1">
                <div className="truncate text-[15px] font-semibold text-slate-800 dark:text-slate-100">{it.nameUz}</div>
                <div className="mt-0.5 truncate text-[12px] text-slate-400">
                  {it.nameRu} · {it.nameEn} · {it.nameDe}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-4">
                <div className="text-center">
                  <div className="text-[11px] text-slate-400">{T("Yulduz", "Звёзды", "Stars", "Sterne")}</div>
                  <div className="text-[15px] font-bold tabular-nums text-slate-800 dark:text-slate-100">{it.stars}</div>
                </div>
                <div className="text-center">
                  <div className="text-[11px] text-slate-400">{T("Mukofot", "Награда", "Reward", "Belohnung")}</div>
                  <div className="text-[15px] font-bold tabular-nums text-amber-600">+{it.reward}</div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <input
                  ref={(el) => { files.current[it.id] = el; }}
                  type="file" accept="image/*" hidden
                  onChange={(e) => { const x = e.target.files?.[0]; if (x) void uploadIcon(it, x); e.target.value = ""; }}
                />
                <button
                  type="button"
                  disabled={busy === it.id}
                  onClick={() => files.current[it.id]?.click()}
                  className="h-9 rounded-lg bg-slate-100 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200"
                >
                  {busy === it.id ? "…" : it.iconUrl ? T("Belgini almashtirish", "Заменить значок", "Replace icon", "Symbol ersetzen") : T("Belgi yuklash", "Загрузить значок", "Upload icon", "Symbol hochladen")}
                </button>
                {it.iconUrl ? (
                  <button
                    type="button"
                    onClick={() => clearIcon(it)}
                    className="h-9 rounded-lg bg-slate-100 px-2.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-200 dark:bg-slate-800"
                    title={T("Belgini olib tashlash", "Убрать значок", "Remove icon", "Symbol entfernen")}
                  >
                    <Icon name="close" className="h-3.5 w-3.5" />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => toggle(it)}
                  className={cn(
                    "h-9 rounded-lg px-3 text-xs font-semibold transition",
                    it.isActive
                      ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400",
                  )}
                >
                  {it.isActive ? T("Yoqilgan", "Включено", "On", "An") : T("O'chiq", "Выключено", "Off", "Aus")}
                </button>
                <button
                  type="button"
                  onClick={() => { setErr(null); setEditing(it); }}
                  className="h-9 rounded-lg bg-slate-100 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
                >
                  {T("Tahrirlash", "Изменить", "Edit", "Bearbeiten")}
                </button>
                <button
                  type="button"
                  onClick={() => remove(it)}
                  className="h-9 rounded-lg bg-rose-50 px-3 text-xs font-semibold text-rose-600 transition hover:bg-rose-100 dark:bg-rose-950/30"
                >
                  {T("O'chirish", "Удалить", "Delete", "Löschen")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing ? (
        <RankDrawer
          row={editing === "new" ? null : editing}
          locale={locale}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); location.reload(); }}
        />
      ) : null}
    </div>
  );
}

/* ── Yonbosh panel ── */
function RankDrawer({
  row, locale, onClose, onSaved,
}: {
  row: RankRow | null;
  locale: Locale;
  onClose: () => void;
  onSaved: () => void;
}) {
  const T = (uz: string, ru: string, en: string, de: string) => tr(locale, { uz, ru, en, de });
  const [mounted, setMounted] = useState(false);
  const [f, setF] = useState<RankInput>(
    row
      ? { nameUz: row.nameUz, nameRu: row.nameRu, nameEn: row.nameEn, nameDe: row.nameDe, stars: row.stars, reward: row.reward, color: row.color, iconUrl: row.iconUrl }
      : EMPTY,
  );
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, start] = useTransition();
  const file = useRef<HTMLInputElement>(null);

  const set = <K extends keyof RankInput>(k: K, v: RankInput[K]) => setF((x) => ({ ...x, [k]: v }));

  // Rasm avval serverga yuklanadi, manzili esa "Saqlash" bilan birga ketadi —
  // shu sabab yangi pog'onaga ham darhol belgi qo'yish mumkin.
  const upload = async (fl: File) => {
    setErr(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", fl);
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok || !j.url) throw new Error();
      set("iconUrl", j.url);
    } catch {
      setErr(T("Rasmni yuklab bo'lmadi", "Не удалось загрузить", "Upload failed", "Upload fehlgeschlagen"));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="animate-slide-in-right absolute right-0 top-0 flex h-full w-[440px] max-w-[92%] flex-col border-l border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3.5 dark:border-slate-800">
          <h2 className="truncate text-[15px] font-bold text-slate-900 dark:text-slate-100">
            {row ? T("Pog'onani tahrirlash", "Изменить ступень", "Edit rank", "Stufe bearbeiten") : T("Yangi pog'ona", "Новая ступень", "New rank", "Neue Stufe")}
          </h2>
          <button type="button" onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          <div>
            <label className={lbl}>{T("Nomi (o'zbekcha)", "Название (узб.)", "Name (Uzbek)", "Name (Usbekisch)")} *</label>
            <input value={f.nameUz} onChange={(e) => set("nameUz", e.target.value)} className={inp} placeholder="Boshlovchi" />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={lbl}>RU</label>
              <input value={f.nameRu} onChange={(e) => set("nameRu", e.target.value)} className={inp} placeholder="Начинающий" />
            </div>
            <div>
              <label className={lbl}>EN</label>
              <input value={f.nameEn} onChange={(e) => set("nameEn", e.target.value)} className={inp} placeholder="Beginner" />
            </div>
            <div>
              <label className={lbl}>DE</label>
              <input value={f.nameDe} onChange={(e) => set("nameDe", e.target.value)} className={inp} placeholder="Anfänger" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={lbl}>{T("Kerakli yulduz", "Нужно звёзд", "Stars required", "Sterne nötig")}</label>
              <input
                type="number" min={0} inputMode="numeric"
                value={f.stars}
                onChange={(e) => set("stars", Number(e.target.value))}
                className={inp}
              />
            </div>
            <div>
              <label className={lbl}>{T("Mukofot (tanga)", "Награда (монеты)", "Reward (coins)", "Belohnung (Münzen)")}</label>
              <input
                type="number" min={0} inputMode="numeric"
                value={f.reward}
                onChange={(e) => set("reward", Number(e.target.value))}
                className={inp}
              />
            </div>
          </div>

          <p className="text-xs leading-relaxed text-slate-400">
            {T(
              "Birinchi pog'ona (eng kam yulduzli) kirish darajasi — uning mukofoti berilmaydi.",
              "Первая ступень (с наименьшим порогом) — входная, её награда не начисляется.",
              "The first rank (lowest threshold) is the entry level — its reward is not paid.",
              "Die erste Stufe ist die Einstiegsstufe — ihre Belohnung wird nicht gezahlt.",
            )}
          </p>

          <div>
            <label className={lbl}>{T("Rangi", "Цвет", "Colour", "Farbe")}</label>
            <div className="flex flex-wrap items-center gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c} type="button" onClick={() => set("color", c)} aria-label={c}
                  className={cn("h-8 w-8 rounded-lg ring-offset-2 transition dark:ring-offset-slate-900", f.color.toLowerCase() === c ? "ring-2 ring-brand-500" : "")}
                  style={{ background: c }}
                />
              ))}
              <input
                type="color" value={f.color} onChange={(e) => set("color", e.target.value)}
                className="h-8 w-12 cursor-pointer rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <div>
            <label className={lbl}>{T("Belgi (rasm)", "Значок (картинка)", "Icon (image)", "Symbol (Bild)")}</label>
            <div className="flex items-center gap-3">
              <span
                className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl text-[15px] font-extrabold text-white"
                style={{ background: f.color }}
              >
                {f.iconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.iconUrl} alt="" className="h-full w-full object-contain p-1" />
                ) : (
                  "?"
                )}
              </span>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={file} type="file" accept="image/*" hidden
                  onChange={(e) => { const x = e.target.files?.[0]; if (x) void upload(x); e.target.value = ""; }}
                />
                <button
                  type="button" disabled={busy} onClick={() => file.current?.click()}
                  className="h-10 rounded-lg bg-slate-100 px-3.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200"
                >
                  {busy ? "…" : f.iconUrl ? T("Almashtirish", "Заменить", "Replace", "Ersetzen") : T("Yuklash", "Загрузить", "Upload", "Hochladen")}
                </button>
                {f.iconUrl ? (
                  <button
                    type="button" onClick={() => set("iconUrl", null)}
                    className="h-10 rounded-lg bg-rose-50 px-3.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-100 dark:bg-rose-950/30"
                  >
                    {T("Olib tashlash", "Убрать", "Remove", "Entfernen")}
                  </button>
                ) : null}
              </div>
            </div>
            <p className="mt-1.5 text-xs text-slate-400">
              {T(
                "512×512 PNG, shaffof fon. Belgi qo'yilmasa pog'ona raqami ko'rinadi.",
                "512×512 PNG, прозрачный фон. Без значка показывается номер ступени.",
                "512×512 PNG, transparent background. Without an icon the rank number is shown.",
                "512×512 PNG, transparenter Hintergrund. Ohne Symbol wird die Stufennummer angezeigt.",
              )}
            </p>
          </div>

          {err ? <p className="text-sm font-medium text-rose-600">{err}</p> : null}
        </div>

        <div className="flex gap-2.5 border-t border-slate-200 p-4 dark:border-slate-800">
          <button type="button" onClick={onClose} className="h-11 flex-1 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
            {T("Bekor", "Отмена", "Cancel", "Abbrechen")}
          </button>
          <button
            type="button"
            disabled={pending || busy}
            onClick={() => start(async () => {
              const r = row ? await updateStarRank(row.id, f) : await createStarRank(f);
              if (r.error) setErr(r.error);
              else onSaved();
            })}
            className="h-11 flex-1 rounded-xl bg-brand-600 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {pending ? "…" : T("Saqlash", "Сохранить", "Save", "Speichern")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
