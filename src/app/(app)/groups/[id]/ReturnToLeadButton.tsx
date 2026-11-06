"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { tr } from "@/lib/tr";
import { formatMoney, type Locale } from "@/lib/constants";
import DateInput from "../../_components/DateInput";
import { alertDialog } from "../../_components/dialogs";
import { Icon } from "../../_components/Icon";
import { returnStudentToLead } from "../../crm/actions";

export interface LeadTarget { value: string; label: string }

const field = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";
const labelCls = "mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300";

export default function ReturnToLeadButton({ groupId, studentId, studentName, debt, targets, locale }: {
  groupId: string;
  studentId: string;
  studentName: string;
  debt: number;
  targets: LeadTarget[];
  locale: Locale;
}) {
  const L = (uz: string, ru: string, en: string, de: string) => tr(locale, { uz, ru, en, de });
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(targets[0]?.value ?? "");
  const [resumeOn, setResumeOn] = useState("");
  const [note, setNote] = useState("");
  const [clearDebt, setClearDebt] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const errorText = (code?: string) => {
    if (code === "no_phone") return L("O'quvchi va ota-onasida telefon raqami yo'q. Avval profilga raqam kiriting.", "Нет номера телефона у ученика и родителей. Сначала укажите номер в профиле.", "No phone number for the student or parents. Add one to the profile first.", "Keine Telefonnummer für Schüler oder Eltern. Bitte zuerst im Profil eintragen.");
    if (code === "not_in_group") return L("O'quvchi endi bu guruhda emas. Sahifani yangilang.", "Ученик уже не в этой группе. Обновите страницу.", "The student is no longer in this group. Reload the page.", "Der Schüler ist nicht mehr in dieser Gruppe. Seite neu laden.");
    if (code === "forbidden") return L("Bu amal uchun ruxsatingiz yo'q.", "У вас нет прав на это действие.", "You do not have permission for this action.", "Keine Berechtigung für diese Aktion.");
    return L("Saqlanmadi. Qayta urinib ko'ring.", "Не сохранено. Попробуйте снова.", "Not saved. Please try again.", "Nicht gespeichert. Bitte erneut versuchen.");
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await returnStudentToLead({ groupId, studentId, target, resumeOn, note, clearDebt });
      if (!r.ok) { setError(errorText(r.error)); return; }
      setOpen(false);
      const cleared = r.cleared ? ` ${L("O'chirilgan guruh qarzi", "Списан долг группы", "Group debt cleared", "Gelöschte Gruppenschulden")}: ${formatMoney(r.cleared, locale)}.` : "";
      void alertDialog({
        title: L("Lidlarga qaytarildi", "Возвращён в лиды", "Returned to leads", "Zu Leads verschoben"),
        message: `${studentName} — ${L("Lidlar bo'limida tanlangan holatda turibdi.", "находится в разделе лидов в выбранном статусе.", "is now in the leads section with the selected status.", "ist jetzt im Lead-Bereich mit dem gewählten Status.")}${cleared}`,
      });
    });
  };

  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={L("Guruhdan chiqarib, lidlarga qaytarish", "Вернуть из группы в лиды", "Move from the group back to leads", "Aus der Gruppe zurück zu den Leads")}
        className="shrink-0 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium text-brand-600 transition hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
      >
        {L("Lidga qaytarish", "В лиды", "To leads", "Zu Leads")}
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm sm:p-8" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-pop dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">{L("Lidga qaytarish", "Вернуть в лиды", "Return to leads", "Zurück zu Leads")}</h3>
                <p className="mt-0.5 truncate text-xs text-slate-500">{studentName}</p>
              </div>
              <button type="button" onClick={close} aria-label={L("Yopish", "Закрыть", "Close", "Schließen")} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submit}>
              <div className="space-y-3.5 px-5 py-4">
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600 dark:bg-white/[0.04] dark:text-slate-300">
                  {L("O'quvchi shu guruhdan chiqadi. Profili, to'lov va davomat tarixi saqlanadi. Keyin lidni guruhga qabul qilsangiz, o'qishi davom etadi va tanaffus oylari hisoblanmaydi.", "Ученик выйдет из этой группы. Профиль, оплаты и посещаемость сохранятся. При повторном зачислении учёба продолжится, месяцы перерыва не начисляются.", "The student leaves this group. The profile, payments and attendance are kept. After you enroll the lead again, studies continue and the pause is not billed.", "Der Schüler verlässt diese Gruppe. Profil, Zahlungen und Anwesenheit bleiben erhalten. Nach erneuter Aufnahme läuft der Unterricht weiter, die Pause wird nicht berechnet.")}
                </p>
                <div>
                  <label className={labelCls}>{L("Lid holati", "Статус лида", "Lead status", "Lead-Status")} <span className="text-rose-500">*</span></label>
                  <select value={target} onChange={(e) => setTarget(e.target.value)} required className={field}>
                    {targets.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>{L("Qachondan davom etadi (ixtiyoriy)", "С какой даты продолжит (необязательно)", "Continues from (optional)", "Fortsetzung ab (optional)")}</label>
                  <DateInput value={resumeOn} onChange={(e) => setResumeOn(e.target.value)} className={field} />
                </div>
                <div>
                  <label className={labelCls}>{L("Izoh (ixtiyoriy)", "Комментарий (необязательно)", "Comment (optional)", "Kommentar (optional)")}</label>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} placeholder={L("Masalan: kelasi oydan kechki guruhga", "Например: со следующего месяца в вечернюю группу", "e.g. evening group from next month", "z. B. ab nächstem Monat Abendgruppe")} className={field} />
                </div>
                {debt > 0 && (
                  <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                    <input type="checkbox" checked={clearDebt} onChange={(e) => setClearDebt(e.target.checked)} className="mt-0.5 h-3.5 w-3.5 accent-amber-600" />
                    <span>
                      <b>{L("Qarzi", "Долг", "Debt", "Schulden")}: {formatMoney(debt, locale)}.</b>{" "}
                      {L("Belgilanmasa qarz saqlanadi. Belgilansa, shu guruh uchun qarz o'chiriladi.", "Без отметки долг сохранится. С отметкой долг этой группы будет списан.", "Unchecked keeps the debt. Checked clears the debt for this group.", "Ohne Haken bleiben die Schulden. Mit Haken werden die Schulden dieser Gruppe gelöscht.")}
                    </span>
                  </label>
                )}
                {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>}
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4 dark:border-slate-800">
                <button type="button" onClick={close} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">{L("Bekor qilish", "Отмена", "Cancel", "Abbrechen")}</button>
                <button type="submit" disabled={pending || !target} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
                  {pending ? L("Saqlanmoqda...", "Сохранение...", "Saving...", "Wird gespeichert...") : L("Lidga qaytarish", "Вернуть в лиды", "Return to leads", "Zurück zu Leads")}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
