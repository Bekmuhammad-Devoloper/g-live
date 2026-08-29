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
import MarqueeText from "../_components/MarqueeText";
import { fmtUzPhoneInput } from "@/lib/phone";

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
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{tr(locale, { uz: "F.I.Sh.", ru: "Ф.И.О.", en: "Full name", de: "Vollständiger Name" })} <span className="text-red-500">*</span></label>
              <input name="fullName" required autoFocus className={input} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{t("common.phone")} <span className="text-red-500">*</span></label>
              <PhoneField input={input} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{t("crm.source")}</label>
              <select name="source" className={input} defaultValue="telegram">
                {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{tr(locale, { uz: "Kurs", ru: "Курс", en: "Course", de: "Kurs" })}</label>
              <input name="interestCourse" placeholder={tr(locale, { uz: "Nemis tili A1", ru: "Немецкий язык A1", en: "German A1", de: "Deutsch A1" })} className={input} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{t("crm.budget")} ({tr(locale, { uz: "so'm", ru: "сум", en: "UZS", de: "UZS" })})</label>
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
                {tr(locale, { uz: "Guruh", ru: "Группа", en: "Group", de: "Gruppe" })}
                <span className="ml-1 font-normal text-slate-400">
                  ({tr(locale, { uz: "ixtiyoriy", ru: "необязательно", en: "optional", de: "optional" })})
                </span>
              </label>
              <GroupPicker locale={locale} groups={groups} inputClass={input} />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{t("common.note")}</label>
              <textarea name="note" rows={3} className={input} />
            </div>
          </div>

          {state.error && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
              {state.error === "duplicate"
                ? tr(locale, { uz: "Bu telefon raqami bilan lid allaqachon mavjud (dublikat).", ru: "Лид с этим номером телефона уже существует (дубликат).", en: "A lead with this phone number already exists (duplicate).", de: "Ein Lead mit dieser Telefonnummer existiert bereits (Duplikat)." })
                : state.error === "invalid_phone"
                  ? tr(locale, { uz: "Telefon raqami noto'g'ri — masalan: +998 90 123 45 67", ru: "Неверный номер телефона — например: +998 90 123 45 67", en: "Invalid phone number — e.g. +998 90 123 45 67", de: "Ungültige Telefonnummer — z. B. +998 90 123 45 67" })
                  : state.error === "forbidden"
                  ? t("pay.noPermission")
                  : state.error === "group_required"
                    ? tr(locale, { uz: "\"Qabul qilindi\" bosqichi uchun guruh tanlash majburiy.", ru: "Для этапа «Принят» выбор группы обязателен.", en: "A group is required for the Won stage.", de: "Für die Phase 'Gewonnen' ist eine Gruppe erforderlich." })
                    : state.error === "group_full"
                      ? tr(locale, { uz: "Tanlangan guruh to'lgan — boshqasini tanlang.", ru: "Выбранная группа заполнена — выберите другую.", en: "The selected group is full — pick another.", de: "Die ausgewählte Gruppe ist voll — wählen Sie eine andere." })
                      : state.error === "group_not_found"
                        ? tr(locale, { uz: "Guruh topilmadi.", ru: "Группа не найдена.", en: "Group not found.", de: "Gruppe nicht gefunden." })
                        : tr(locale, { uz: "Ma'lumotlar to'liq emas.", ru: "Данные заполнены не полностью.", en: "The data is incomplete.", de: "Die Daten sind unvollständig." })}
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

// Telefon maydoni: +998 doimiy prefiks, maska 9 xonadan ortiq yozdirmaydi.
// Ilgari oddiy input edi — juda uzun, soxta raqamlar ham kiritilardi.
function PhoneField({ input }: { input: string }) {
  const [phone, setPhone] = useState("");
  return (
    <>
      <div className={`${input} flex items-center !py-0`}>
        <span className="select-none py-2 text-sm font-medium text-slate-500">+998</span>
        <input
          value={phone}
          onChange={(e) => setPhone(fmtUzPhoneInput(e.target.value))}
          required
          inputMode="numeric"
          placeholder="90 123 45 67"
          className="ml-2 w-full flex-1 bg-transparent py-2 outline-none"
        />
      </div>
      <input type="hidden" name="phone" value={phone ? `+998 ${phone}` : ""} />
    </>
  );
}

// Guruh tanlash — brauzerning o'z ro'yxati o'rniga (u maydondan chiqib ketardi).
// Ro'yxat maydon kengligida qoladi, uzun yozuv esa 3 soniyadan keyin aylanadi.
function GroupPicker({ locale, groups, inputClass }: { locale: Locale; groups: EnrollGroupOpt[]; inputClass: string }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  const none = tr(locale, { uz: "— yo'naltirilmagan —", ru: "— не назначена —", en: "— not assigned —", de: "— nicht zugewiesen —" });
  const fullTxt = tr(locale, { uz: "to'lgan", ru: "заполнена", en: "full", de: "voll" });
  const optLabel = (g: EnrollGroupOpt) =>
    `${g.courseName} — ${g.name} (${g.taken}/${g.capacity})` +
    (g.schedule ? ` · ${g.schedule}` : "") +
    (g.taken >= g.capacity ? ` · ${fullTxt}` : "") +
    (g.note ? ` · ${g.note}` : ""); // guruh izohi (kament)

  const current = groups.find((g) => g.id === picked);

  // Tashqariga bosilsa yopiladi
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={boxRef} className="relative">
      <input type="hidden" name="groupId" value={picked} />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${inputClass} flex items-center gap-2 text-left`}
      >
        <MarqueeText text={current ? optLabel(current) : none} className={current ? "flex-1" : "flex-1 text-slate-400"} />
        <Icon name="chevronDown" className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-20 mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-pop dark:border-slate-700 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => { setPicked(""); setOpen(false); }}
            className="block w-full px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-white/5"
          >
            {none}
          </button>
          {groups.map((g) => {
            const full = g.taken >= g.capacity;
            return (
              <button
                key={g.id}
                type="button"
                disabled={full}
                onClick={() => { setPicked(g.id); setOpen(false); }}
                className={`block w-full px-3 py-2 text-left text-sm ${
                  full
                    ? "cursor-not-allowed text-slate-300 dark:text-slate-600"
                    : picked === g.id
                      ? "bg-brand-50 font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
                      : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5"
                }`}
              >
                <MarqueeText text={optLabel(g)} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
