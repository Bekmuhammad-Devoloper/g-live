"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { exportRows } from "@/lib/export";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { issueCertificate, revokeCertificate, type FormState } from "./actions";

export interface CertExportRow {
  number: string;
  student: string;
  program: string;
  result: string;
  status: string;
}

export function ExportCertsButton({ rows, locale }: { rows: CertExportRow[]; locale: Locale }) {
  return (
    <button
      onClick={() =>
        exportRows(
          `sertifikatlar-${new Date().toISOString().slice(0, 10)}`,
          [
            { key: "number", label: tr(locale, { uz: "Raqam", ru: "Номер", en: "Number", de: "Nummer" }) },
            { key: "student", label: tr(locale, { uz: "O'quvchi", ru: "Ученик", en: "Student", de: "Schüler" }) },
            { key: "program", label: tr(locale, { uz: "Dastur / daraja", ru: "Программа / уровень", en: "Program / level", de: "Programm / Niveau" }) },
            { key: "result", label: tr(locale, { uz: "Natija", ru: "Результат", en: "Result", de: "Ergebnis" }) },
            { key: "status", label: tr(locale, { uz: "Holati", ru: "Статус", en: "Status", de: "Status" }) },
          ],
          rows,
        )
      }
      disabled={rows.length === 0}
      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
    >
      ⬇ {tr(locale, { uz: "Eksport (CSV)", ru: "Экспорт (CSV)", en: "Export (CSV)", de: "Export (CSV)" })}
    </button>
  );
}

export function IssueForm({ students, locale }: { students: { id: string; fullName: string }[]; locale: Locale }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(issueCertificate, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) { ref.current?.reset(); setOpen(false); } }, [state.ok]);

  const input = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

  return (
    <>
      <button onClick={() => setOpen((v) => !v)} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
        + {tr(locale, { uz: "Sertifikat berish", ru: "Выдать сертификат", en: "Issue certificate", de: "Zertifikat ausstellen" })}
      </button>

      {open && (
        <div className="fixed inset-0 z-[80]">
          {/* Yonboshdan ochiladigan panel (ilovadagi boshqa formalar kabi) */}
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
          <form ref={ref} action={action} className="animate-slide-in-right absolute right-0 top-0 flex h-full w-[440px] max-w-[92%] flex-col space-y-3 overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-pop dark:border-white/10 dark:bg-[#15243d]">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">{tr(locale, { uz: "Sertifikat berish", ru: "Выдать сертификат", en: "Issue certificate", de: "Zertifikat ausstellen" })}</h3>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">{tr(locale, { uz: "O'quvchi", ru: "Ученик", en: "Student", de: "Schüler" })} <span className="text-red-500">*</span></label>
              <select name="studentId" required className={input} defaultValue="">
                <option value="" disabled>—</option>
                {students.map((st) => <option key={st.id} value={st.id}>{st.fullName}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">{tr(locale, { uz: "Dastur / kurs", ru: "Программа / курс", en: "Program / course", de: "Programm / Kurs" })} <span className="text-red-500">*</span></label>
              <input name="programName" required defaultValue="Nemis tili (A1–B2)" className={input} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">{tr(locale, { uz: "Daraja", ru: "Уровень", en: "Level", de: "Niveau" })}</label>
                <input name="levelCode" placeholder="A2" className={input} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">{tr(locale, { uz: "Imtihon bali (%)", ru: "Балл экзамена (%)", en: "Exam score (%)", de: "Prüfungsergebnis (%)" })}</label>
                <input name="examScore" type="number" min="0" max="100" placeholder="85" className={input} />
              </div>
            </div>

            {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error === "forbidden" ? tr(locale, { uz: "Ruxsat yo'q.", ru: "Нет доступа.", en: "No access.", de: "Kein Zugriff." }) : tr(locale, { uz: "Ma'lumot to'liq emas.", ru: "Данные заполнены не полностью.", en: "Data is incomplete.", de: "Daten sind unvollständig." })}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">{tr(locale, { uz: "Bekor qilish", ru: "Отмена", en: "Cancel", de: "Abbrechen" })}</button>
              <button type="submit" disabled={pending} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">{pending ? "..." : tr(locale, { uz: "Berish", ru: "Выдать", en: "Issue", de: "Ausstellen" })}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

export function RevokeButton({ id, locale }: { id: string; locale: Locale }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      onClick={() => {
        const reason = window.prompt(tr(locale, { uz: "Bekor qilish sababi (majburiy):", ru: "Причина отмены (обязательно):", en: "Reason for revocation (required):", de: "Grund für den Widerruf (erforderlich):" }));
        if (!reason || reason.trim().length < 3) return;
        start(async () => { await revokeCertificate(id, reason.trim()); router.refresh(); });
      }}
      disabled={pending}
      className="rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
    >
      {pending ? "..." : tr(locale, { uz: "Bekor qilish", ru: "Отменить", en: "Revoke", de: "Widerrufen" })}
    </button>
  );
}
