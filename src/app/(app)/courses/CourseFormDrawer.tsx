"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Icon } from "../_components/Icon";
import { createCourse, updateCourse, type CourseState } from "./actions";
import { LESSON_DURATIONS, type CourseMeta } from "./shared";

// Raqamlarni har 3 xonada bo'shliq bilan ajratadi ("800000" -> "800 000")
const fmtDigits = (d: string) => d.replace(/\B(?=(\d{3})+(?!\d))/g, " ");

export default function CourseFormDrawer({
  mode,
  initial,
  open,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  initial?: { id: string; name: string; description: string | null; meta: CourseMeta; banners?: string[] };
  open: boolean;
  onClose: () => void;
  onSaved: (id: string, meta: CourseMeta) => void;
}) {
  const boundAction = mode === "edit" && initial ? updateCourse.bind(null, initial.id) : createCourse;
  const [state, action, pending] = useActionState<CourseState, FormData>(boundAction, {});
  const [mounted, setMounted] = useState(false);
  const [code, setCode] = useState(initial?.meta.code ?? "");
  const [lessonDuration, setLessonDuration] = useState(initial?.meta.lessonDuration ?? "90 daqiqa");
  const [months, setMonths] = useState(initial?.meta.months ? String(initial.meta.months) : "");
  const [price, setPrice] = useState(initial?.meta.price ? String(initial.meta.price) : "");
  const [banners, setBanners] = useState<string[]>(initial?.banners ?? []);
  const formRef = useRef<HTMLFormElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  const onBannerFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new window.Image();
        img.onload = () => {
          const maxW = 1200, scale = Math.min(1, maxW / img.width);
          const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
          const c = document.createElement("canvas"); c.width = w; c.height = h;
          const ctx = c.getContext("2d");
          if (!ctx) return;
          ctx.drawImage(img, 0, 0, w, h);
          const url = c.toDataURL("image/jpeg", 0.72);
          setBanners((prev) => (prev.length >= 6 ? prev : [...prev, url]));
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });
  };
  const router = useRouter();
  const done = useRef(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (state.ok && state.id && !done.current) {
      done.current = true;
      onSaved(state.id, {
        code: code.trim() || undefined,
        lessonDuration,
        months: Number(months) > 0 ? Math.round(Number(months)) : undefined,
        price: Number(price) > 0 ? Math.round(Number(price)) : undefined,
      });
      if (mode === "create") {
        formRef.current?.reset();
        setCode(""); setLessonDuration("90 daqiqa"); setMonths(""); setPrice(""); setBanners([]);
      }
      onClose();
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.id]);

  useEffect(() => {
    if (!open) { done.current = false; return; }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  const label = "mb-1.5 block text-sm text-slate-600 dark:text-slate-300";
  const input = "h-11 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-sm text-slate-800 outline-none transition focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100";

  return createPortal(
    <div className="fixed inset-0 z-[80]" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <form
        ref={formRef}
        action={action}
        onMouseDown={(e) => e.stopPropagation()}
        className="animate-slide-in-right absolute right-0 top-0 flex h-full w-[460px] max-w-[92%] flex-col bg-white shadow-pop dark:bg-[#15243d]"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-white/10">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            {mode === "edit" ? "Elementni tahrirlash" : "Yangi element qo'shish"}
          </h3>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10">✕</button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div>
            <label className={label}>Ism <span className="text-rose-500">*</span></label>
            <input name="name" required defaultValue={initial?.name ?? ""} className={input} />
          </div>
          <div>
            <label className={label}>Kurs kodi</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>Dars davomiyligi</label>
            <div className="relative">
              <select value={lessonDuration} onChange={(e) => setLessonDuration(e.target.value)} className={`${input} appearance-none pr-9`}>
                {LESSON_DURATIONS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <Icon name="chevronDown" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </div>
          <div>
            <label className={label}>Kurs davomiyligi (oylarda)</label>
            <input value={months} onChange={(e) => setMonths(e.target.value)} type="number" min="0" className={input} />
          </div>
          <div>
            <label className={label}>Oylik narx</label>
            <div className="relative">
              <input
                value={price ? fmtDigits(price) : ""}
                onChange={(e) => setPrice(e.target.value.replace(/\D/g, "").slice(0, 12))}
                type="text"
                inputMode="numeric"
                placeholder="0"
                className={`${input} pr-12 tabular-nums`}
              />
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">so&apos;m</span>
            </div>
            {/* Bazaga yoziladi: qarz shu summadan hisoblanadi */}
            <input type="hidden" name="monthlyFee" value={price} />
            <p className="mt-1 text-xs text-slate-400">
              O&apos;quvchi guruhga qo&apos;shilgan oydan boshlab har oy shu summa qarzga hisoblanadi.
              Guruhda o&apos;z narxi ko&apos;rsatilsa — o&apos;shanisi ustun.
            </p>
          </div>
          <div>
            <label className={label}>Izoh</label>
            <textarea name="description" rows={3} defaultValue={initial?.description ?? ""} className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100" />
          </div>

          {/* Kurs bannerlari (bir nechta rasm) */}
          <div>
            <label className={label}>Kurs bannerlari <span className="text-slate-400">(bir nechta, ixtiyoriy · {banners.length}/6)</span></label>
            <p className="-mt-1 mb-2 flex items-start gap-1.5 text-xs leading-relaxed text-slate-400">
              <Icon name="info" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>Tavsiya etilgan o&apos;lcham: <b className="text-slate-500 dark:text-slate-300">1200 × 628 px</b> (keng/gorizontal, ~1.9:1). Rasm karta muqovasiga moslab (cover) qirqiladi — muhim qism markazda bo&apos;lsin. JPG/PNG.</span>
            </p>
            <div className="flex flex-wrap gap-2.5">
              {banners.map((b, i) => (
                <div key={i} className="group relative h-20 w-32 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-cover bg-center shadow-sm dark:border-slate-700" style={{ backgroundImage: `url(${b})` }}>
                  <button type="button" onClick={() => setBanners((p) => p.filter((_, idx) => idx !== i))} title="O'chirish" className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/55 text-white opacity-0 transition group-hover:opacity-100">
                    <Icon name="close" className="h-3.5 w-3.5" />
                  </button>
                  {i === 0 && <span className="absolute bottom-1 left-1 rounded bg-brand-600 px-1.5 py-0.5 text-[9px] font-bold text-white">asosiy</span>}
                </div>
              ))}
              {banners.length < 6 && (
                <button type="button" onClick={() => bannerRef.current?.click()} className="grid h-20 w-32 shrink-0 place-items-center rounded-lg border border-dashed border-slate-300 text-slate-400 transition hover:border-brand-400 hover:text-brand-500 dark:border-slate-600 dark:hover:border-brand-500">
                  <div className="flex flex-col items-center gap-1">
                    <Icon name="image" className="h-5 w-5" />
                    <span className="text-[10px] font-medium">Rasm qo&apos;shish</span>
                  </div>
                </button>
              )}
            </div>
            <input ref={bannerRef} type="file" accept="image/*" multiple className="hidden" onChange={onBannerFiles} />
            <input type="hidden" name="banners" value={JSON.stringify(banners)} />
          </div>

          {state.error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">
              {state.error === "forbidden" ? "Ruxsat yo'q." : "Ma'lumot to'liq emas."}
            </p>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-100 px-6 py-4 dark:border-white/10">
          <button type="submit" disabled={pending} className="rounded-full bg-[#1f3a5f] px-8 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#152a45] disabled:opacity-60">
            {pending ? "Saqlanmoqda..." : "Saqlash"}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}
