"use client";

import { useRef, useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../../_components/Icon";
import { levelGradient, PRESET_COLORS } from "@/lib/levelColor";
import {
  saveBanner, deleteBanner, toggleBanner, moveBanner,
  saveVideo, deleteVideo, toggleVideo, moveVideo,
  type BannerInput, type VideoInput,
} from "./actions";

// O'quvchi bosh sahifasidagi banner karuseli va "Video va podkastlar" ro'yxati.

export type VBanner = {
  id: string; title: string; subtitle: string | null; btnLabel: string | null;
  href: string | null; imageUrl: string | null; color: string; isActive: boolean;
};
export type VVideo = {
  id: string; title: string; note: string | null; url: string;
  kind: string; isActive: boolean; thumb: string | null;
};

const inp =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";
const lbl = "mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400";

export default function HomeContentView({
  banners, videos, locale,
}: {
  banners: VBanner[];
  videos: VVideo[];
  locale: Locale;
}) {
  const T = (uz: string, ru: string, en: string, de: string) => tr(locale, { uz, ru, en, de });
  const [bs, setBs] = useState(banners);
  const [vs, setVs] = useState(videos);
  const [editB, setEditB] = useState<VBanner | "new" | null>(null);
  const [editV, setEditV] = useState<VVideo | "new" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [, start] = useTransition();

  const after = (r: { error?: string }, ok?: () => void) => (r.error ? setErr(r.error) : (setErr(null), ok?.()));

  const swap = <T,>(xs: T[], i: number, j: number) => {
    if (i < 0 || j < 0 || j >= xs.length) return xs;
    const c = [...xs];
    [c[i], c[j]] = [c[j], c[i]];
    return c;
  };

  return (
    <div className="space-y-4">
      {err ? (
        <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{err}</div>
      ) : null}

      {/* ══ Bannerlar ══ */}
      <section>
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
              {T("Bannerlar", "Баннеры", "Banners", "Banner")}
            </h2>
            <p className="text-sm text-slate-500">
              {T(
                "O'quvchi bosh sahifasining tepasida aylanadi. Bir nechta bo'lsa karusel bo'lib almashadi.",
                "Крутится вверху главной страницы ученика. Несколько баннеров — карусель.",
                "Rotates at the top of the student home. Several banners form a carousel.",
                "Läuft oben auf der Schüler-Startseite. Mehrere Banner ergeben ein Karussell.",
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setErr(null); setEditB("new"); }}
            className="h-10 shrink-0 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            + {T("Banner", "Баннер", "Banner", "Banner")}
          </button>
        </div>

        {bs.length === 0 ? (
          <Empty text={T("Hali banner yo'q", "Баннеров пока нет", "No banners yet", "Noch keine Banner")} />
        ) : (
          <div className="space-y-2.5">
            {bs.map((b, i) => (
              <div
                key={b.id}
                className={cn(
                  "flex flex-wrap items-center gap-3 rounded-xl border border-slate-200/70 bg-white p-3 shadow-card dark:border-slate-800 dark:bg-slate-900",
                  !b.isActive && "opacity-60",
                )}
              >
                <div
                  className="relative grid h-[62px] w-[112px] shrink-0 place-items-center overflow-hidden rounded-xl px-2 text-center text-white"
                  style={b.imageUrl ? { backgroundColor: "#12303f" } : { background: levelGradient(b.color) }}
                >
                  {b.imageUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={b.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                      <span className="absolute inset-0 bg-black/40" />
                    </>
                  ) : null}
                  <span className="relative line-clamp-2 text-[10.5px] font-bold leading-tight">{b.title}</span>
                </div>

                <div className="min-w-[160px] flex-1">
                  <div className="truncate text-[15px] font-semibold text-slate-800 dark:text-slate-100">{b.title}</div>
                  {b.subtitle ? <p className="mt-0.5 line-clamp-1 text-[13px] text-slate-500">{b.subtitle}</p> : null}
                  <div className="mt-1 truncate text-[12px] text-slate-400">
                    {b.btnLabel ? `${b.btnLabel} → ` : ""}{b.href ?? "—"}
                  </div>
                </div>

                <Arrows
                  first={i === 0}
                  last={i === bs.length - 1}
                  onUp={() => { setBs((x) => swap(x, i, i - 1)); start(async () => after(await moveBanner(b.id, "up"))); }}
                  onDown={() => { setBs((x) => swap(x, i, i + 1)); start(async () => after(await moveBanner(b.id, "down"))); }}
                />

                <div className="flex shrink-0 items-center gap-1.5">
                  <OnOff
                    on={b.isActive}
                    locale={locale}
                    onClick={() => {
                      setBs((x) => x.map((y) => (y.id === b.id ? { ...y, isActive: !y.isActive } : y)));
                      start(async () => after(await toggleBanner(b.id, !b.isActive)));
                    }}
                  />
                  <Small onClick={() => { setErr(null); setEditB(b); }}>{T("Tahrirlash", "Изменить", "Edit", "Bearbeiten")}</Small>
                  <Small tone="rose" onClick={() => start(async () => after(await deleteBanner(b.id), () => setBs((x) => x.filter((y) => y.id !== b.id))))}>
                    {T("O'chirish", "Удалить", "Delete", "Löschen")}
                  </Small>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ══ Video va podkastlar ══ */}
      <section className="pt-2">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
              {T("Video va podkastlar", "Видео и подкасты", "Videos and podcasts", "Videos und Podcasts")}
            </h2>
            <p className="text-sm text-slate-500">
              {T(
                "YouTube havolasini qo'ying — o'quvchi ilovadan chiqmasdan ko'radi.",
                "Вставьте ссылку YouTube — ученик смотрит прямо в приложении.",
                "Paste a YouTube link — the student watches it inside the app.",
                "YouTube-Link einfügen — der Schüler sieht es direkt in der App.",
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setErr(null); setEditV("new"); }}
            className="h-10 shrink-0 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            + {T("Video", "Видео", "Video", "Video")}
          </button>
        </div>

        {vs.length === 0 ? (
          <Empty text={T("Hali video yo'q", "Видео пока нет", "No videos yet", "Noch keine Videos")} />
        ) : (
          <div className="space-y-2.5">
            {vs.map((v, i) => (
              <div
                key={v.id}
                className={cn(
                  "flex flex-wrap items-center gap-3 rounded-xl border border-slate-200/70 bg-white p-3 shadow-card dark:border-slate-800 dark:bg-slate-900",
                  !v.isActive && "opacity-60",
                )}
              >
                <div className="relative grid h-[62px] w-[112px] shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-900">
                  {v.thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.thumb} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />
                  ) : null}
                  <span className="relative grid h-8 w-8 place-items-center rounded-full bg-white/25 pl-0.5 text-white backdrop-blur-sm">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.2v13.6L19 12 8 5.2Z" /></svg>
                  </span>
                </div>

                <div className="min-w-[160px] flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-[15px] font-semibold text-slate-800 dark:text-slate-100">{v.title}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-[1px] text-[10.5px] font-bold uppercase tracking-wide text-slate-500 dark:bg-slate-800">
                      {v.kind === "PODCAST" ? T("Podkast", "Подкаст", "Podcast", "Podcast") : T("Video", "Видео", "Video", "Video")}
                    </span>
                  </div>
                  {v.note ? <p className="mt-0.5 line-clamp-1 text-[13px] text-slate-500">{v.note}</p> : null}
                  <div className="mt-1 truncate text-[12px] text-slate-400">{v.url}</div>
                </div>

                <Arrows
                  first={i === 0}
                  last={i === vs.length - 1}
                  onUp={() => { setVs((x) => swap(x, i, i - 1)); start(async () => after(await moveVideo(v.id, "up"))); }}
                  onDown={() => { setVs((x) => swap(x, i, i + 1)); start(async () => after(await moveVideo(v.id, "down"))); }}
                />

                <div className="flex shrink-0 items-center gap-1.5">
                  <OnOff
                    on={v.isActive}
                    locale={locale}
                    onClick={() => {
                      setVs((x) => x.map((y) => (y.id === v.id ? { ...y, isActive: !y.isActive } : y)));
                      start(async () => after(await toggleVideo(v.id, !v.isActive)));
                    }}
                  />
                  <Small onClick={() => { setErr(null); setEditV(v); }}>{T("Tahrirlash", "Изменить", "Edit", "Bearbeiten")}</Small>
                  <Small tone="rose" onClick={() => start(async () => after(await deleteVideo(v.id), () => setVs((x) => x.filter((y) => y.id !== v.id))))}>
                    {T("O'chirish", "Удалить", "Delete", "Löschen")}
                  </Small>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {editB ? (
        <BannerDialog
          locale={locale}
          row={editB === "new" ? null : editB}
          onClose={() => setEditB(null)}
          onSaved={() => { setEditB(null); location.reload(); }}
        />
      ) : null}

      {editV ? (
        <VideoDialog
          locale={locale}
          row={editV === "new" ? null : editV}
          onClose={() => setEditV(null)}
          onSaved={() => { setEditV(null); location.reload(); }}
        />
      ) : null}
    </div>
  );
}

/* ── Kichik yordamchilar ── */
function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-400 dark:border-slate-700">
      {text}
    </div>
  );
}

function Small({ children, onClick, tone }: { children: React.ReactNode; onClick: () => void; tone?: "rose" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-9 rounded-lg px-3 text-xs font-semibold",
        tone === "rose"
          ? "bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-300"
          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200",
      )}
    >
      {children}
    </button>
  );
}

function OnOff({ on, onClick, locale }: { on: boolean; onClick: () => void; locale: Locale }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-9 rounded-lg px-3 text-xs font-semibold",
        on ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-slate-100 text-slate-500 dark:bg-slate-800",
      )}
    >
      {on
        ? tr(locale, { uz: "Yoqilgan", ru: "Включён", en: "On", de: "An" })
        : tr(locale, { uz: "O'chirilgan", ru: "Выключен", en: "Off", de: "Aus" })}
    </button>
  );
}

function Arrows({ first, last, onUp, onDown }: { first: boolean; last: boolean; onUp: () => void; onDown: () => void }) {
  const cls = "grid h-[22px] w-7 place-items-center rounded bg-slate-100 text-slate-500 disabled:opacity-30 dark:bg-slate-800";
  return (
    <div className="flex shrink-0 flex-col gap-0.5">
      <button type="button" onClick={onUp} disabled={first} aria-label="↑" className={cls}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 15 6-6 6 6" /></svg>
      </button>
      <button type="button" onClick={onDown} disabled={last} aria-label="↓" className={cls}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
      </button>
    </div>
  );
}

function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{title}</h2>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>
        {children}
        <div className="mt-5 flex gap-2.5">{footer}</div>
      </div>
    </div>
  );
}

/* ── Banner oynasi ── */
function BannerDialog({ row, locale, onClose, onSaved }: { row: VBanner | null; locale: Locale; onClose: () => void; onSaved: () => void }) {
  const T = (uz: string, ru: string, en: string, de: string) => tr(locale, { uz, ru, en, de });
  const [f, setF] = useState<BannerInput>({
    title: row?.title ?? "",
    subtitle: row?.subtitle ?? "",
    btnLabel: row?.btnLabel ?? "",
    href: row?.href ?? "/student/kurse",
    imageUrl: row?.imageUrl ?? "",
    color: row?.color ?? PRESET_COLORS[1],
  });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, start] = useTransition();
  const file = useRef<HTMLInputElement>(null);
  const set = (k: keyof BannerInput, v: string) => setF((x) => ({ ...x, [k]: v }));

  const upload = async (fl: File) => {
    setErr(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", fl);
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok || !j.url) throw new Error();
      set("imageUrl", j.url);
    } catch {
      setErr(T("Rasmni yuklab bo'lmadi", "Не удалось загрузить", "Upload failed", "Upload fehlgeschlagen"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={row ? T("Bannerni tahrirlash", "Изменить баннер", "Edit banner", "Banner bearbeiten") : T("Yangi banner", "Новый баннер", "New banner", "Neues Banner")}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="h-11 flex-1 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
            {T("Bekor", "Отмена", "Cancel", "Abbrechen")}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => start(async () => {
              const r = await saveBanner(row?.id ?? null, f);
              if (r.error) setErr(r.error);
              else onSaved();
            })}
            className="h-11 flex-1 rounded-xl bg-brand-600 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {pending ? "…" : T("Saqlash", "Сохранить", "Save", "Speichern")}
          </button>
        </>
      }
    >
      {/* Ko'rinishi */}
      <div
        className="relative mb-4 grid min-h-[112px] place-items-start overflow-hidden rounded-2xl p-4 text-white"
        style={f.imageUrl ? { backgroundColor: "#12303f" } : { background: levelGradient(f.color) }}
      >
        {f.imageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <span className="absolute inset-0 bg-gradient-to-r from-black/70 to-black/25" />
          </>
        ) : null}
        <div className="relative">
          <div className="text-[18px] font-extrabold leading-snug">{f.title || T("Sarlavha", "Заголовок", "Title", "Titel")}</div>
          {f.subtitle ? <p className="mt-1 text-[12.5px] text-white/85">{f.subtitle}</p> : null}
          {f.btnLabel ? <span className="mt-2.5 inline-block rounded-xl bg-white px-3.5 py-1.5 text-[12.5px] font-bold text-slate-900">{f.btnLabel}</span> : null}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className={lbl}>{T("Sarlavha", "Заголовок", "Title", "Titel")} *</label>
          <input value={f.title} onChange={(e) => set("title", e.target.value)} className={inp} />
        </div>
        <div>
          <label className={lbl}>{T("Matn", "Текст", "Text", "Text")}</label>
          <input value={f.subtitle} onChange={(e) => set("subtitle", e.target.value)} className={inp} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={lbl}>{T("Tugma yozuvi", "Текст кнопки", "Button label", "Button-Text")}</label>
            <input value={f.btnLabel} onChange={(e) => set("btnLabel", e.target.value)} placeholder="Ko'rish" className={inp} />
          </div>
          <div>
            <label className={lbl}>{T("Havola", "Ссылка", "Link", "Link")}</label>
            <input value={f.href} onChange={(e) => set("href", e.target.value)} placeholder="/student/kurse" className={inp} />
          </div>
        </div>

        <div>
          <label className={lbl}>{T("Rasm (ixtiyoriy)", "Изображение (необязательно)", "Image (optional)", "Bild (optional)")}</label>
          <div className="flex flex-wrap items-center gap-2">
            <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { const x = e.target.files?.[0]; if (x) void upload(x); e.target.value = ""; }} />
            <button type="button" disabled={busy} onClick={() => file.current?.click()} className="h-10 rounded-lg bg-slate-100 px-3.5 text-xs font-semibold text-slate-600 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200">
              {busy ? "…" : f.imageUrl ? T("Almashtirish", "Заменить", "Replace", "Ersetzen") : T("Yuklash", "Загрузить", "Upload", "Hochladen")}
            </button>
            {f.imageUrl ? (
              <button type="button" onClick={() => set("imageUrl", "")} className="h-10 rounded-lg bg-rose-50 px-3.5 text-xs font-semibold text-rose-600">
                {T("Rasmni olib tashlash", "Убрать изображение", "Remove image", "Bild entfernen")}
              </button>
            ) : null}
          </div>
        </div>

        {!f.imageUrl ? (
          <div>
            <label className={lbl}>{T("Rangi", "Цвет", "Colour", "Farbe")}</label>
            <div className="flex flex-wrap items-center gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c} type="button" onClick={() => set("color", c)} aria-label={c}
                  className={cn("h-8 w-8 rounded-lg ring-offset-2 transition dark:ring-offset-slate-900", f.color.toLowerCase() === c ? "ring-2 ring-brand-500" : "")}
                  style={{ background: levelGradient(c) }}
                />
              ))}
              <input type="color" value={f.color} onChange={(e) => set("color", e.target.value)} className="h-8 w-12 cursor-pointer rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-800" />
            </div>
          </div>
        ) : null}
      </div>

      {err ? <p className="mt-3 text-sm font-medium text-rose-600">{err}</p> : null}
    </Modal>
  );
}

/* ── Video oynasi ── */
function VideoDialog({ row, locale, onClose, onSaved }: { row: VVideo | null; locale: Locale; onClose: () => void; onSaved: () => void }) {
  const T = (uz: string, ru: string, en: string, de: string) => tr(locale, { uz, ru, en, de });
  const [f, setF] = useState<VideoInput>({
    title: row?.title ?? "",
    note: row?.note ?? "",
    url: row?.url ?? "",
    kind: row?.kind ?? "VIDEO",
  });
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof VideoInput, v: string) => setF((x) => ({ ...x, [k]: v }));

  return (
    <Modal
      title={row ? T("Videoni tahrirlash", "Изменить видео", "Edit video", "Video bearbeiten") : T("Yangi video", "Новое видео", "New video", "Neues Video")}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="h-11 flex-1 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
            {T("Bekor", "Отмена", "Cancel", "Abbrechen")}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => start(async () => {
              const r = await saveVideo(row?.id ?? null, f);
              if (r.error) setErr(r.error);
              else onSaved();
            })}
            className="h-11 flex-1 rounded-xl bg-brand-600 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {pending ? "…" : T("Saqlash", "Сохранить", "Save", "Speichern")}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className={lbl}>{T("Sarlavha", "Заголовок", "Title", "Titel")} *</label>
          <input value={f.title} onChange={(e) => set("title", e.target.value)} className={inp} />
        </div>
        <div>
          <label className={lbl}>{T("YouTube havolasi", "Ссылка YouTube", "YouTube link", "YouTube-Link")} *</label>
          <input value={f.url} onChange={(e) => set("url", e.target.value)} placeholder="https://www.youtube.com/watch?v=..." className={inp} />
          <p className="mt-1 text-xs text-slate-400">
            {T(
              "youtube.com/watch?v=… , youtu.be/… yoki vimeo.com/… havolasi ishlaydi.",
              "Подходит youtube.com/watch?v=…, youtu.be/… или vimeo.com/…",
              "youtube.com/watch?v=…, youtu.be/… or vimeo.com/… all work.",
              "youtube.com/watch?v=…, youtu.be/… oder vimeo.com/… funktionieren.",
            )}
          </p>
        </div>
        <div>
          <label className={lbl}>{T("Izoh", "Описание", "Note", "Notiz")}</label>
          <input value={f.note} onChange={(e) => set("note", e.target.value)} className={inp} />
        </div>
        <div>
          <label className={lbl}>{T("Turi", "Тип", "Kind", "Art")}</label>
          <select value={f.kind} onChange={(e) => set("kind", e.target.value)} className={inp}>
            <option value="VIDEO">{T("Video", "Видео", "Video", "Video")}</option>
            <option value="PODCAST">{T("Podkast", "Подкаст", "Podcast", "Podcast")}</option>
          </select>
        </div>
      </div>

      {err ? <p className="mt-3 text-sm font-medium text-rose-600">{err}</p> : null}
    </Modal>
  );
}
