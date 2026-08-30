"use client";

import { useRef, useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../../_components/Icon";
import { PRESET_COLORS, levelGradient } from "@/lib/levelColor";
import {
  createLevel, updateLevel, deleteLevel, moveLevel, toggleLevel, setLevelBanner,
  type LevelInput,
} from "./actions";

// Daraja katalogi — qo'shish, tahrirlash, tartib, banner, o'chirish.

export type LevelRow = {
  id: string;
  code: string;
  nameUz: string;
  nameRu: string;
  nameEn: string;
  nameDe: string;
  color: string;
  bannerUrl: string | null;
  isActive: boolean;
  /** Shu daraja nechta joyda ishlatilmoqda — o'chirishdan oldin ogohlantirish uchun */
  usage: number;
};

const inp =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";
const lbl = "mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400";

const EMPTY: LevelInput = { code: "", nameUz: "", nameRu: "", nameEn: "", nameDe: "", color: PRESET_COLORS[1] };

export default function LevelsView({ rows, locale }: { rows: LevelRow[]; locale: Locale }) {
  const [items, setItems] = useState(rows);
  const [editing, setEditing] = useState<LevelRow | "new" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();
  const files = useRef<Record<string, HTMLInputElement | null>>({});

  const T = (uz: string, ru: string, en: string, de: string) => tr(locale, { uz, ru, en, de });

  const after = (r: { ok?: boolean; error?: string }, apply?: () => void) => {
    if (r.error) setErr(r.error);
    else {
      setErr(null);
      apply?.();
    }
  };

  const move = (id: string, dir: "up" | "down") => {
    setErr(null);
    setItems((xs) => {
      const i = xs.findIndex((x) => x.id === id);
      const j = dir === "up" ? i - 1 : i + 1;
      if (i < 0 || j < 0 || j >= xs.length) return xs;
      const c = [...xs];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });
    start(async () => after(await moveLevel(id, dir)));
  };

  const toggle = (it: LevelRow) => {
    setErr(null);
    setItems((xs) => xs.map((x) => (x.id === it.id ? { ...x, isActive: !x.isActive } : x)));
    start(async () => after(await toggleLevel(it.id, !it.isActive)));
  };

  const remove = (it: LevelRow) => {
    setErr(null);
    start(async () =>
      after(await deleteLevel(it.id), () => setItems((xs) => xs.filter((x) => x.id !== it.id))),
    );
  };

  const upload = async (it: LevelRow, file: File) => {
    setErr(null);
    setBusy(it.id);
    try {
      const blob = await shrink(file);
      const fd = new FormData();
      fd.append("file", new File([blob], "banner.jpg", { type: "image/jpeg" }));
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok || !j.url) throw new Error("upload");
      const res = await setLevelBanner(it.id, j.url);
      if (res.error) throw new Error(res.error);
      setItems((xs) => xs.map((x) => (x.id === it.id ? { ...x, bannerUrl: j.url } : x)));
    } catch {
      setErr(T("Rasmni yuklab bo'lmadi", "Не удалось загрузить", "Upload failed", "Upload fehlgeschlagen"));
    } finally {
      setBusy(null);
    }
  };

  const clearBanner = (it: LevelRow) => {
    setErr(null);
    start(async () =>
      after(await setLevelBanner(it.id, null), () =>
        setItems((xs) => xs.map((x) => (x.id === it.id ? { ...x, bannerUrl: null } : x))),
      ),
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
        {T(
          "Bu ro'yxat butun tizim uchun umumiy: o'quvchi ilovasidagi kurslar, dars qo'shish oynasidagi \"Daraja\" tanlovi va ariza formasi shu yerdan oladi.",
          "Этот список общий для всей системы: курсы в приложении ученика, выбор «Уровень» при добавлении урока и форма заявки берут данные отсюда.",
          "This list is system-wide: courses in the student app, the lesson dialog's level picker and the application form all read from here.",
          "Diese Liste gilt systemweit: Kurse in der Schüler-App, die Niveauauswahl im Lektionsdialog und das Bewerbungsformular greifen darauf zu.",
        )}
      </div>

      {err ? (
        <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{err}</div>
      ) : null}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => { setErr(null); setEditing("new"); }}
          className="h-10 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          + {T("Yangi daraja", "Новый уровень", "New level", "Neues Niveau")}
        </button>
      </div>

      <div className="space-y-2.5">
        {items.map((it, i) => (
          <div
            key={it.id}
            className={cn(
              "flex flex-wrap items-center gap-3 rounded-xl border border-slate-200/70 bg-white p-3 shadow-card dark:border-slate-800 dark:bg-slate-900",
              !it.isActive && "opacity-60",
            )}
          >
            {/* Ilovadagi kartochkaning kichik nusxasi */}
            <div
              className="relative grid h-[62px] w-[104px] shrink-0 place-items-center overflow-hidden rounded-xl text-white"
              style={it.bannerUrl ? { backgroundColor: "#12303f" } : { background: levelGradient(it.color) }}
            >
              {it.bannerUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  <span className="absolute inset-0 bg-black/35" />
                </>
              ) : null}
              <span className="relative text-[17px] font-extrabold drop-shadow">{it.code}</span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-semibold text-slate-800 dark:text-slate-100">
                {tr(locale, { uz: it.nameUz, ru: it.nameRu, en: it.nameEn, de: it.nameDe })}
              </div>
              <div className="mt-0.5 text-xs text-slate-400">
                {it.usage > 0
                  ? T(`${it.usage} joyda ishlatilmoqda`, `Используется в ${it.usage} местах`, `Used in ${it.usage} places`, `An ${it.usage} Stellen verwendet`)
                  : T("Hali ishlatilmagan", "Пока не используется", "Not used yet", "Noch nicht verwendet")}
                {it.isActive ? "" : ` · ${T("o'chirilgan", "отключён", "disabled", "deaktiviert")}`}
              </div>
            </div>

            {/* Tartib */}
            <div className="flex shrink-0 flex-col gap-0.5">
              <button
                type="button" onClick={() => move(it.id, "up")} disabled={i === 0}
                aria-label={T("Yuqoriga", "Вверх", "Up", "Nach oben")}
                className="grid h-[22px] w-7 place-items-center rounded bg-slate-100 text-slate-500 disabled:opacity-30 dark:bg-slate-800"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 15 6-6 6 6" /></svg>
              </button>
              <button
                type="button" onClick={() => move(it.id, "down")} disabled={i === items.length - 1}
                aria-label={T("Pastga", "Вниз", "Down", "Nach unten")}
                className="grid h-[22px] w-7 place-items-center rounded bg-slate-100 text-slate-500 disabled:opacity-30 dark:bg-slate-800"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
              </button>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              <input
                ref={(el) => { files.current[it.id] = el; }}
                type="file" accept="image/*" hidden
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(it, f); e.target.value = ""; }}
              />
              <button
                type="button" disabled={busy === it.id} onClick={() => files.current[it.id]?.click()}
                className="h-9 rounded-lg bg-slate-100 px-3 text-xs font-semibold text-slate-600 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200"
              >
                {busy === it.id ? "…" : it.bannerUrl ? T("Banner ✓", "Баннер ✓", "Banner ✓", "Banner ✓") : T("Banner", "Баннер", "Banner", "Banner")}
              </button>
              {it.bannerUrl ? (
                <button
                  type="button" onClick={() => clearBanner(it)}
                  aria-label={T("Bannerni o'chirish", "Удалить баннер", "Remove banner", "Banner entfernen")}
                  className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-slate-400 dark:bg-slate-800"
                >
                  <Icon name="close" className="h-4 w-4" />
                </button>
              ) : null}

              <button
                type="button" onClick={() => toggle(it)}
                className={cn(
                  "h-9 rounded-lg px-3 text-xs font-semibold",
                  it.isActive
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                    : "bg-slate-100 text-slate-500 dark:bg-slate-800",
                )}
              >
                {it.isActive ? T("Yoqilgan", "Включён", "On", "An") : T("O'chirilgan", "Выключен", "Off", "Aus")}
              </button>

              <button
                type="button" onClick={() => { setErr(null); setEditing(it); }}
                className="h-9 rounded-lg bg-slate-100 px-3 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-200"
              >
                {T("Tahrirlash", "Изменить", "Edit", "Bearbeiten")}
              </button>

              <button
                type="button" onClick={() => remove(it)}
                className="h-9 rounded-lg bg-rose-50 px-3 text-xs font-semibold text-rose-600 dark:bg-rose-950/30 dark:text-rose-300"
              >
                {T("O'chirish", "Удалить", "Delete", "Löschen")}
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing ? (
        <LevelDialog
          locale={locale}
          row={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setEditing(null);
            if (saved) setItems((xs) => xs.map((x) => (x.id === saved.id ? { ...x, ...saved } : x)));
            else location.reload(); // yangi daraja — ro'yxatni serverdan qayta olamiz
          }}
        />
      ) : null}
    </div>
  );
}

// ── Qo'shish / tahrirlash oynasi ──
function LevelDialog({
  row, locale, onClose, onSaved,
}: {
  row: LevelRow | null;
  locale: Locale;
  onClose: () => void;
  onSaved: (v: (LevelInput & { id: string }) | null) => void;
}) {
  const T = (uz: string, ru: string, en: string, de: string) => tr(locale, { uz, ru, en, de });
  const [f, setF] = useState<LevelInput>(
    row
      ? { code: row.code, nameUz: row.nameUz, nameRu: row.nameRu, nameEn: row.nameEn, nameDe: row.nameDe, color: row.color }
      : EMPTY,
  );
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof LevelInput, v: string) => setF((x) => ({ ...x, [k]: v }));

  const save = () => {
    setErr(null);
    start(async () => {
      const r = row ? await updateLevel(row.id, f) : await createLevel(f);
      if (r.error) setErr(r.error);
      else onSaved(row ? { ...f, id: row.id } : null);
    });
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            {row
              ? T("Darajani tahrirlash", "Изменить уровень", "Edit level", "Niveau bearbeiten")
              : T("Yangi daraja", "Новый уровень", "New level", "Neues Niveau")}
          </h2>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        {/* Ilovada qanday ko'rinishi — shu zahoti */}
        <div className="mb-4 grid h-[92px] place-items-center rounded-2xl text-white" style={{ background: levelGradient(f.color) }}>
          <span className="text-[26px] font-extrabold drop-shadow">{f.code || "A1"}</span>
        </div>

        <div className="space-y-3">
          <div>
            <label className={lbl}>{T("Kod", "Код", "Code", "Code")} *</label>
            <input value={f.code} onChange={(e) => set("code", e.target.value)} placeholder="A1" className={inp} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={lbl}>{T("Nomi (o'zbekcha)", "Название (узб.)", "Name (Uzbek)", "Name (Usbekisch)")} *</label>
              <input value={f.nameUz} onChange={(e) => set("nameUz", e.target.value)} placeholder="Boshlang'ich" className={inp} />
            </div>
            <div>
              <label className={lbl}>{T("Ruscha", "Русский", "Russian", "Russisch")}</label>
              <input value={f.nameRu} onChange={(e) => set("nameRu", e.target.value)} placeholder="Начальный" className={inp} />
            </div>
            <div>
              <label className={lbl}>{T("Inglizcha", "Английский", "English", "Englisch")}</label>
              <input value={f.nameEn} onChange={(e) => set("nameEn", e.target.value)} placeholder="Beginner" className={inp} />
            </div>
            <div>
              <label className={lbl}>{T("Nemischa", "Немецкий", "German", "Deutsch")}</label>
              <input value={f.nameDe} onChange={(e) => set("nameDe", e.target.value)} placeholder="Anfänger" className={inp} />
            </div>
          </div>

          <div>
            <label className={lbl}>{T("Rangi", "Цвет", "Colour", "Farbe")}</label>
            <div className="flex flex-wrap items-center gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c} type="button" onClick={() => set("color", c)} aria-label={c}
                  className={cn(
                    "h-8 w-8 rounded-lg ring-offset-2 transition dark:ring-offset-slate-900",
                    f.color.toLowerCase() === c ? "ring-2 ring-brand-500" : "",
                  )}
                  style={{ background: levelGradient(c) }}
                />
              ))}
              <input
                type="color" value={f.color} onChange={(e) => set("color", e.target.value)}
                className="h-8 w-12 cursor-pointer rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <p className="mt-1.5 text-xs text-slate-400">
              {T("Banner yuklansa rang o'rniga o'sha rasm ko'rinadi.", "Если загружен баннер, вместо цвета будет он.", "A banner image replaces the colour.", "Ein Banner ersetzt die Farbe.")}
            </p>
          </div>
        </div>

        {err ? <p className="mt-3 text-sm font-medium text-rose-600">{err}</p> : null}

        <div className="mt-5 flex gap-2.5">
          <button
            type="button" onClick={onClose}
            className="h-11 flex-1 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300"
          >
            {T("Bekor", "Отмена", "Cancel", "Abbrechen")}
          </button>
          <button
            type="button" onClick={save} disabled={pending}
            className="h-11 flex-1 rounded-xl bg-brand-600 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {pending ? "…" : T("Saqlash", "Сохранить", "Save", "Speichern")}
          </button>
        </div>
      </div>
    </div>
  );
}

// Banner uchun 1200px yetarli — katta suratni brauzerda kichraytiramiz
function shrink(f: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(f);
    const im = new Image();
    im.onload = () => {
      URL.revokeObjectURL(url);
      const k = Math.min(1, 1200 / im.width);
      const c = document.createElement("canvas");
      c.width = Math.round(im.width * k);
      c.height = Math.round(im.height * k);
      const ctx = c.getContext("2d");
      if (!ctx) return reject(new Error("canvas"));
      ctx.drawImage(im, 0, 0, c.width, c.height);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("blob"))), "image/jpeg", 0.86);
    };
    im.onerror = () => { URL.revokeObjectURL(url); reject(new Error("image")); };
    im.src = url;
  });
}
