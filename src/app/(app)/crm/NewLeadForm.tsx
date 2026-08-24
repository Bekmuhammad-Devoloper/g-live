"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createLead, enrollOptions, type LeadState, type EnrollGroupOpt } from "./actions";
import { LEAD_STAGES, LEAD_STAGE_LABELS, label, type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { getT } from "@/lib/i18n";
import { Icon } from "../_components/Icon";

const SOURCES = ["sayt", "ilova", "telegram", "telefon", "reklama", "tashrif"];

// Boshqariladigan (controlled) yon panel — trigger tugmasi tashqarida.
// EnrollDrawer bilan bir xil uslub: o'ngdan sirg'alib chiqadi.
export default function NewLeadForm({
  locale,
  open,
  onClose,
  defaultStage = "NEW",
}: {
  locale: Locale;
  open: boolean;
  onClose: () => void;
  defaultStage?: string;
}) {
  const t = getT(locale);
  const router = useRouter();
  const [state, action, pending] = useActionState<LeadState, FormData>(createLead, {});
  const formRef = useRef<HTMLFormElement>(null);
  const [mounted, setMounted] = useState(false);
  // Ixtiyoriy guruh biriktiruvi. Ro'yxat HAR ochilishda qayta yuklanadi —
  // shu orada yaratilgan guruh ham ko'rinsin (bir martalik kesh eskirib qoladi).
  const [groups, setGroups] = useState<EnrollGroupOpt[]>([]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    enrollOptions()
      .then((o) => { if (alive) setGroups(o.groups); })
      .catch(() => { if (alive) setGroups([]); });
    return () => { alive = false; };
  }, [open]);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      onClose();
      router.refresh();
    }
  }, [state.ok, router, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted || !open) return null;

  const input = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

  return createPortal(
    <div className="fixed inset-0 z-[70]" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <form
        ref={formRef}
        action={action}
        onMouseDown={(e) => e.stopPropagation()}
        className="animate-slide-in-right absolute right-0 top-0 flex h-full w-[440px] max-w-[92%] flex-col border-l border-slate-200 bg-white shadow-pop dark:border-white/10 dark:bg-[#15243d]"
      >
        {/* Sarlavha */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-5 py-4 dark:border-white/10">
          <div className="flex items-center gap-2 text-base font-bold text-slate-800 dark:text-slate-100">
            <Icon name="plus" className="h-5 w-5 shrink-0 text-brand-500" />
            {t("crm.newLead")}
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 dark:hover:bg-white/10">
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        {/* Maydonlar */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{tr(locale, { uz: "F.I.Sh.", ru: "Ф.И.О.", en: "Full name" })} <span className="text-red-500">*</span></label>
              <input name="fullName" required autoFocus className={input} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{t("common.phone")} <span className="text-red-500">*</span></label>
              <input name="phone" required placeholder="+998 __ ___ __ __" className={input} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{t("crm.source")}</label>
              <select name="source" className={input} defaultValue="telegram">
                {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{tr(locale, { uz: "Kurs", ru: "Курс", en: "Course" })}</label>
              <input name="interestCourse" placeholder={tr(locale, { uz: "Nemis tili A1", ru: "Немецкий язык A1", en: "German A1" })} className={input} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{t("crm.budget")} ({tr(locale, { uz: "so'm", ru: "сум", en: "UZS" })})</label>
              <input name="budget" type="number" min="0" step="10000" className={input} />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{t("crm.stage")}</label>
              <select name="stage" className={input} defaultValue={defaultStage}>
                {LEAD_STAGES.map((st) => <option key={st} value={st}>{label(LEAD_STAGE_LABELS, st, locale)}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                {tr(locale, { uz: "Guruh", ru: "Группа", en: "Group" })}
                <span className="ml-1 font-normal text-slate-400">
                  ({tr(locale, { uz: "ixtiyoriy", ru: "необязательно", en: "optional" })})
                </span>
              </label>
              <select name="groupId" className={input} defaultValue="">
                <option value="">{tr(locale, { uz: "— yo'naltirilmagan —", ru: "— не назначена —", en: "— not assigned —" })}</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id} disabled={g.taken >= g.capacity}>
                    {g.courseName} — {g.name} ({g.taken}/{g.capacity})
                    {g.schedule ? ` · ${g.schedule}` : ""}
                    {g.taken >= g.capacity ? ` · ${tr(locale, { uz: "to'lgan", ru: "заполнена", en: "full" })}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{t("common.note")}</label>
              <textarea name="note" rows={3} className={input} />
            </div>
          </div>

          {state.error && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
              {state.error === "duplicate"
                ? tr(locale, { uz: "Bu telefon raqami bilan lid allaqachon mavjud (dublikat).", ru: "Лид с этим номером телефона уже существует (дубликат).", en: "A lead with this phone number already exists (duplicate)." })
                : state.error === "forbidden"
                  ? t("pay.noPermission")
                  : state.error === "group_required"
                    ? tr(locale, { uz: "\"Qabul qilindi\" bosqichi uchun guruh tanlash majburiy.", ru: "Для этапа «Принят» выбор группы обязателен.", en: "A group is required for the Won stage." })
                    : state.error === "group_full"
                      ? tr(locale, { uz: "Tanlangan guruh to'lgan — boshqasini tanlang.", ru: "Выбранная группа заполнена — выберите другую.", en: "The selected group is full — pick another." })
                      : state.error === "group_not_found"
                        ? tr(locale, { uz: "Guruh topilmadi.", ru: "Группа не найдена.", en: "Group not found." })
                        : tr(locale, { uz: "Ma'lumotlar to'liq emas.", ru: "Данные заполнены не полностью.", en: "The data is incomplete." })}
            </p>
          )}
        </div>

        {/* Tugmalar */}
        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-5 py-4 dark:border-white/10">
          <button type="button" onClick={onClose} className="btn-ghost">{t("common.cancel")}</button>
          <button type="submit" disabled={pending} className="btn-primary">{pending ? "..." : t("common.save")}</button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
