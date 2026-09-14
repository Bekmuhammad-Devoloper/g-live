"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { PAYMENT_STATUS_LABELS, PAYMENT_METHODS, PAYMENT_METHOD_LABELS, label, formatMoney, type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { isReceiptRequired, type ReceiptMode } from "@/lib/receiptMode";
import { getStudentPayments, acceptPayment, addStudentDebt, updatePaymentRecord, deletePaymentRecord, type StudentPayments, type MonthPay, type PayRow, type ReceiptData } from "./actions";
import { Icon } from "../_components/Icon";

// O'quvchining TO'LOV HOLATI paneli — bitta komponent, ikki joyda:
//   • ro'yxatdagi tezkor oyna (StudentDetailModal)
//   • to'liq profil sahifasi (/students/[id])
// Bu oy / o'tgan oy, majburiy to'lov ogohlantirishi, jami qarz, qarz qo'shish,
// to'lov qabul qilish (chek bilan) va so'nggi to'lovlar (tahrirlash/o'chirish).

function fmtDate(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

export default function PaymentPanel({
  studentId, locale, canManage, canPay, cashierName, receiptMode, defaultPurpose, onChanged,
}: {
  studentId: string;
  locale: Locale;
  canManage: boolean;
  canPay: boolean;
  cashierName: string;
  receiptMode: ReceiptMode;
  defaultPurpose: string;
  /** To'lov/qarz o'zgarganda (sahifa yangilash uchun) */
  onChanged?: () => void;
}) {
  const [pay, setPay] = useState<StudentPayments | null>(null);
  const [, startPay] = useTransition();
  const [payForm, setPayForm] = useState(false);
  const [debtForm, setDebtForm] = useState(false); // qarzdor holatga tushurish formasi
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  const load = () => startPay(async () => { const r = await getStudentPayments(studentId); if (r.ok && r.data) setPay(r.data); });
  const reloadPay = () => { load(); onChanged?.(); };

  useEffect(() => {
    if (!canManage && !canPay) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, canManage, canPay]);

  if (!canManage && !canPay) return null;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <Icon name="wallet" className="h-3.5 w-3.5" /> {tr(locale, { uz: "To'lov holati", ru: "Статус оплаты", en: "Payment status", de: "Zahlungsstatus" })}
        </div>
        {canPay && !payForm && !debtForm && (
          <div className="flex gap-1.5">
            {/* Qarzdor holatga tushurish — qo'lda qarz yozuvi */}
            <button onClick={() => setDebtForm(true)} className="flex items-center gap-1 rounded-lg border border-amber-300 px-2.5 py-1 text-[11px] font-semibold text-amber-700 transition hover:bg-amber-50 dark:border-amber-500/40 dark:text-amber-400 dark:hover:bg-amber-500/10">
              <Icon name="alert" className="h-3.5 w-3.5" /> {tr(locale, { uz: "Qarz qo'shish", ru: "Добавить долг", en: "Add debt", de: "Schulden hinzufügen" })}
            </button>
            <button onClick={() => setPayForm(true)} className="flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-brand-700">
              <Icon name="plus" className="h-3.5 w-3.5" /> {tr(locale, { uz: "To'lov qabul qilish", ru: "Принять оплату", en: "Accept payment", de: "Zahlung annehmen" })}
            </button>
          </div>
        )}
      </div>

      {/* Majburiy to'lov — shu oy chegaradan ko'p dars o'tilgan, lekin to'lanmagan */}
      {pay?.paymentMandatory && (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-3 dark:border-rose-900/50 dark:bg-rose-950/30">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-500/15">
              <Icon name="alert" className="h-4 w-4 text-rose-600" />
            </span>
            <div>
              <div className="text-sm font-bold text-rose-700 dark:text-rose-400">{tr(locale, { uz: "TO'LOV MAJBURIY", ru: "ОПЛАТА ОБЯЗАТЕЛЬНА", en: "PAYMENT MANDATORY", de: "ZAHLUNG ERFORDERLICH" })}</div>
              <div className="text-xs text-rose-500 dark:text-rose-400/80">
                {tr(locale, {
                  uz: `Shu oy ${pay.lessonsThisMonth} dars o'tildi (chegara: ${pay.mandatoryThreshold}), lekin to'lov qilinmagan.`,
                  ru: `В этом месяце проведено ${pay.lessonsThisMonth} уроков (лимит: ${pay.mandatoryThreshold}), оплата не произведена.`,
                  en: `${pay.lessonsThisMonth} lessons this month (limit: ${pay.mandatoryThreshold}), unpaid.`,
                  de: `${pay.lessonsThisMonth} Unterrichtsstunden diesen Monat (Limit: ${pay.mandatoryThreshold}), unbezahlt.`,
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {debtForm && (
        <AddDebtForm
          studentId={studentId}
          locale={locale}
          onCancel={() => setDebtForm(false)}
          onDone={() => { setDebtForm(false); reloadPay(); }}
        />
      )}

      {payForm && (
        <PayAcceptForm
          studentId={studentId}
          defaultPurpose={defaultPurpose}
          cashierName={cashierName}
          receiptMode={receiptMode}
          locale={locale}
          onCancel={() => setPayForm(false)}
          onDone={(r) => { setPayForm(false); setReceipt(r); reloadPay(); }}
        />
      )}

      <div className="grid grid-cols-2 gap-3">
        <PayTile label={tr(locale, { uz: "Bu oy", ru: "Этот месяц", en: "This month", de: "Diesen Monat" })} m={pay?.thisMonth} loading={!pay} locale={locale} />
        {pay && !pay.lastMonthApplicable ? (
          // Hali bir oy bo'lmagan (yaqinda kelgan) — "o'tgan oy" o'rniga qo'shilgan sanasi ko'rsatiladi
          <JoinDateTile joinDate={pay.joinDate} locale={locale} />
        ) : (
          <PayTile label={tr(locale, { uz: "O'tgan oy", ru: "Прошлый месяц", en: "Last month", de: "Letzten Monat" })} m={pay?.lastMonth} loading={!pay} locale={locale} />
        )}
      </div>

      {/* Jami qarzdorlik — qo'shilgan oydan hisoblangan + qo'lda kiritilgan */}
      {pay && (
        <div className={cn("mt-3 flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5", pay.debt > 0
          ? "border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20"
          : "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20")}>
          <div className="flex items-center gap-2">
            <span className={cn("flex h-7 w-7 items-center justify-center rounded-full", pay.debt > 0 ? "bg-amber-500/15" : "bg-emerald-500/15")}>
              <Icon name={pay.debt > 0 ? "info" : "check"} className={cn("h-4 w-4", pay.debt > 0 ? "text-amber-600" : "text-emerald-600")} />
            </span>
            <span className={cn("text-sm font-semibold", pay.debt > 0 ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400")}>
              {tr(locale, { uz: "Jami qarzdorlik", ru: "Общая задолженность", en: "Total debt", de: "Gesamtschulden" })}
            </span>
          </div>
          <span className={cn("text-base font-black tabular-nums", pay.debt > 0 ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400")}>
            {pay.debt > 0 ? formatMoney(pay.debt, locale) : tr(locale, { uz: "Yo'q", ru: "Нет", en: "None", de: "Keine" })}
          </span>
        </div>
      )}

      {/* Balans — majburiyatlardan ortiqcha (oldindan) to'langan pul; keyingi oy hisobiga o'tadi */}
      {pay && (
        <div className={cn("mt-2 flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5", pay.credit > 0
          ? "border-sky-200 bg-sky-50 dark:border-sky-900/40 dark:bg-sky-950/20"
          : "border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/[0.03]")}>
          <div className="flex items-center gap-2">
            <span className={cn("flex h-7 w-7 items-center justify-center rounded-full", pay.credit > 0 ? "bg-sky-500/15" : "bg-slate-400/15")}>
              <Icon name="wallet" className={cn("h-4 w-4", pay.credit > 0 ? "text-sky-600" : "text-slate-400")} />
            </span>
            <span className={cn("text-sm font-semibold", pay.credit > 0 ? "text-sky-700 dark:text-sky-400" : "text-slate-500 dark:text-slate-400")}>
              {tr(locale, { uz: "Balansda", ru: "На балансе", en: "On balance", de: "Guthaben" })}
              {pay.credit > 0 && <span className="ml-1 text-[11px] font-medium opacity-70">{tr(locale, { uz: "(oldindan to'langan)", ru: "(предоплата)", en: "(prepaid)", de: "(vorausbezahlt)" })}</span>}
            </span>
          </div>
          <span className={cn("text-base font-black tabular-nums", pay.credit > 0 ? "text-sky-700 dark:text-sky-400" : "text-slate-500 dark:text-slate-400")}>
            {formatMoney(pay.credit, locale)}
          </span>
        </div>
      )}

      {pay && (
        pay.recent.length > 0 ? (
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
              <span>{tr(locale, { uz: "So'nggi to'lovlar", ru: "Последние платежи", en: "Recent payments", de: "Letzte Zahlungen" })}</span>
              <span className="tabular-nums">{tr(locale, { uz: "Jami", ru: "Итого", en: "Total", de: "Gesamt" })}: {formatMoney(pay.totalPaid, locale)}</span>
            </div>
            {pay.recent.map((p) => (
              <PaymentRow
                key={p.id}
                p={p}
                locale={locale}
                canEdit={canPay || canManage}
                onChanged={() => { setPayForm(false); reloadPay(); }}
              />
            ))}
          </div>
        ) : (
          <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-400 dark:bg-white/[0.03]">{tr(locale, { uz: "Hali to'lov qilinmagan.", ru: "Оплат ещё не было.", en: "No payments yet.", de: "Noch keine Zahlungen." })}</p>
        )
      )}

      {receipt && <ReceiptModal receipt={receipt} locale={locale} onClose={() => setReceipt(null)} />}
    </div>
  );
}

// Qarzdor holatga tushurish — qo'lda qarz yozuvi (PENDING to'lov) ochadi.
export function AddDebtForm({ studentId, locale, onCancel, onDone }: {
  studentId: string; locale: Locale; onCancel: () => void; onDone: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const L = (uz: string, ru: string, en: string) => tr(locale, { uz, ru, en });
  const inp = "h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:border-amber-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100";

  const submit = () => start(async () => {
    const r = await addStudentDebt(studentId, { amount: Number(amount), purpose });
    if (r.ok) onDone();
    else setErr(r.error === "amount" ? L("Summani to'g'ri kiriting.", "Введите корректную сумму.", "Enter a valid amount.")
      : r.error === "forbidden" ? L("Ruxsat yo'q.", "Нет доступа.", "No permission.")
      : L("Saqlanmadi.", "Не сохранено.", "Not saved."));
  });

  return (
    <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-500/40 dark:bg-amber-500/10">
      <div className="mb-2 text-xs font-semibold text-amber-800 dark:text-amber-300">
        {L("Qarzdor holatga tushurish", "Перевести в должники", "Mark as debtor")}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-0.5 block text-[10px] font-semibold text-slate-500">{L("Summa (so'm)", "Сумма (сум)", "Amount (UZS)")} *</label>
          <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder="0" className={inp} />
        </div>
        <div>
          <label className="mb-0.5 block text-[10px] font-semibold text-slate-500">{L("Izoh", "Комментарий", "Note")}</label>
          <input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder={L("Kurs to'lovi qarzi", "Долг за курс", "Course fee debt")} className={inp} />
        </div>
      </div>
      {err && <p className="mt-1.5 text-[11px] font-medium text-rose-600 dark:text-rose-400">{err}</p>}
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={onCancel} disabled={pending} className="flex-1 rounded-lg border border-slate-200 bg-white py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300">
          {L("Bekor qilish", "Отмена", "Cancel")}
        </button>
        <button type="button" onClick={submit} disabled={pending || !amount} className="flex-[1.4] rounded-lg bg-amber-600 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:opacity-40">
          {pending ? "..." : L("Qarz qo'shish", "Добавить долг", "Add debt")}
        </button>
      </div>
    </div>
  );
}

// Bitta to'lov qatori — tahrirlash va o'chirish bilan (2026-08-27 talab).
// Noto'g'ri kiritilgan summa/usul/holat shu yerdan tuzatiladi.
export function PaymentRow({ p, locale, canEdit, onChanged }: {
  p: PayRow; locale: Locale; canEdit: boolean; onChanged: () => void;
}) {
  const [edit, setEdit] = useState(false);
  const [amount, setAmount] = useState(String(p.amount));
  const [method, setMethod] = useState(p.method);
  const [status, setStatus] = useState(p.status);
  const [purpose, setPurpose] = useState(p.purpose ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const L = (uz: string, ru: string, en: string) => tr(locale, { uz, ru, en });
  // Qoplangan qarz yozuvi — holati PENDING qolsa ham "Qoplandi" deb ko'rinadi
  const covered = p.status === "PENDING" && p.covered;
  const ps = covered ? { fg: "#16a34a", bg: "#16a34a1a" } : payStatusStyle(p.status);

  const save = () => start(async () => {
    const r = await updatePaymentRecord(p.id, { amount: Number(amount), method, status, purpose });
    if (r.ok) { setEdit(false); onChanged(); }
    else setErr(r.error === "forbidden" ? L("Ruxsat yo'q.", "Нет доступа.", "No permission.") : L("Saqlanmadi.", "Не сохранено.", "Not saved."));
  });

  const remove = () => start(async () => {
    const r = await deletePaymentRecord(p.id);
    if (r.ok) onChanged();
    else setErr(L("O'chirilmadi.", "Не удалено.", "Not deleted."));
  });

  const inp = "h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100";

  if (!edit) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-1.5 dark:border-white/5">
        <div className="min-w-0">
          <div className="text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-200">{formatMoney(p.amount, locale)}</div>
          <div className="truncate text-[11px] text-slate-400">{fmtDate(p.date)} · {p.method}{p.purpose ? ` · ${p.purpose}` : ""}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ color: ps.fg, background: ps.bg }}>
            {covered ? tr(locale, { uz: "Qoplandi", ru: "Погашен", en: "Covered", de: "Beglichen" }) : label(PAYMENT_STATUS_LABELS, p.status, locale)}
          </span>
          {canEdit && (
            <button
              type="button"
              onClick={() => { setEdit(true); setErr(null); }}
              title={L("Tahrirlash", "Изменить", "Edit")}
              className="grid h-6 w-6 place-items-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10"
            >
              <Icon name="pencil" className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-brand-200 bg-brand-50/50 p-2.5 dark:border-brand-500/30 dark:bg-brand-500/10">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-0.5 block text-[10px] font-semibold text-slate-500">{L("Summa", "Сумма", "Amount")}</label>
          <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={inp} />
        </div>
        <div>
          <label className="mb-0.5 block text-[10px] font-semibold text-slate-500">{L("Usul", "Способ", "Method")}</label>
          <select value={method} onChange={(e) => setMethod(e.target.value)} className={inp}>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{label(PAYMENT_METHOD_LABELS, m, locale)}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-0.5 block text-[10px] font-semibold text-slate-500">{L("Holat", "Статус", "Status")}</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inp}>
            {["PAID", "PENDING", "REFUNDED", "CANCELLED"].map((x) => <option key={x} value={x}>{label(PAYMENT_STATUS_LABELS, x, locale)}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-0.5 block text-[10px] font-semibold text-slate-500">{L("Maqsad", "Назначение", "Purpose")}</label>
          <input value={purpose} onChange={(e) => setPurpose(e.target.value)} className={inp} />
        </div>
      </div>
      {err && <p className="mt-1.5 text-[11px] font-medium text-rose-600 dark:text-rose-400">{err}</p>}
      <div className="mt-2 flex gap-1.5">
        <button type="button" onClick={() => setEdit(false)} disabled={pending} className="flex-1 rounded-md border border-slate-200 bg-white py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300">
          {L("Bekor", "Отмена", "Cancel")}
        </button>
        <button type="button" onClick={remove} disabled={pending} className="rounded-md border border-rose-200 px-2.5 py-1.5 text-[11px] font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60 dark:border-rose-500/30 dark:text-rose-400">
          {L("O'chirish", "Удалить", "Delete")}
        </button>
        <button type="button" onClick={save} disabled={pending || !amount} className="flex-1 rounded-md bg-brand-600 py-1.5 text-[11px] font-semibold text-white transition hover:bg-brand-700 disabled:opacity-40">
          {pending ? "..." : L("Saqlash", "Сохранить", "Save")}
        </button>
      </div>
    </div>
  );
}

// To'lov qabul qilish formasi (drawer ichida ochiladi) — Naqd / Karta / Bank hisobi.
// Chek majburiymi — CEO sozlamasidan keladi (receiptMode), qattiq yozilmagan.
export function PayAcceptForm({ studentId, defaultPurpose, cashierName, locale, receiptMode, onCancel, onDone }: {
  studentId: string;
  defaultPurpose: string;
  cashierName: string;
  locale: Locale;
  receiptMode: ReceiptMode;
  onCancel: () => void;
  onDone: (r: ReceiptData) => void;
}) {
  const nowLocal = () => {
    const d = new Date(); const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  const [amountStr, setAmountStr] = useState("");
  const [method, setMethod] = useState<"CASH" | "CARD" | "BANK">("CASH");
  const [paidAt, setPaidAt] = useState(nowLocal());
  const [receiptUrl, setReceiptUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [pct, setPct] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const setAmount = (v: string) => {
    const digits = v.replace(/\D/g, "");
    setAmountStr(digits ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : "");
  };

  const onPickChek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErr(null); setUploading(true); setPct(0);
    const fd = new FormData(); fd.set("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.upload.onprogress = (ev) => { if (ev.lengthComputable) setPct(Math.round((ev.loaded / ev.total) * 100)); };
    xhr.onload = () => { setUploading(false); try { const j = JSON.parse(xhr.responseText); if (xhr.status < 300 && j.url) setReceiptUrl(j.url); else setErr(tr(locale, { uz: "Chekni yuklab bo'lmadi", ru: "Не удалось загрузить чек", en: "Receipt upload failed", de: "Beleg-Upload fehlgeschlagen" })); } catch { setErr(tr(locale, { uz: "Chekni yuklab bo'lmadi", ru: "Не удалось загрузить чек", en: "Receipt upload failed", de: "Beleg-Upload fehlgeschlagen" })); } };
    xhr.onerror = () => { setUploading(false); setErr(tr(locale, { uz: "Chekni yuklab bo'lmadi", ru: "Не удалось загрузить чек", en: "Receipt upload failed", de: "Beleg-Upload fehlgeschlagen" })); };
    xhr.send(fd);
  };

  const submit = () => {
    setErr(null);
    const amount = Number(amountStr.replace(/\s/g, ""));
    if (!amount || amount <= 0) { setErr(tr(locale, { uz: "Summani kiriting", ru: "Введите сумму", en: "Enter amount", de: "Betrag eingeben" })); return; }
    if (isReceiptRequired(receiptMode, method) && !receiptUrl) {
      setErr(tr(locale, { uz: "Bu to'lov uchun chek yuklash majburiy", ru: "Для этой оплаты чек обязателен", en: "A receipt is required for this payment", de: "Für diese Zahlung ist ein Beleg erforderlich" }));
      return;
    }
    startBusy(async () => {
      const r = await acceptPayment(studentId, { amount, method, purpose: defaultPurpose, receiptUrl: receiptUrl || null, paidAt: new Date(paidAt).toISOString() });
      if (r.ok && r.receipt) onDone(r.receipt);
      else if (r.error === "receipt_required") setErr(tr(locale, { uz: "Karta to'lovi uchun chek yuklang", ru: "Загрузите чек", en: "Upload receipt", de: "Beleg hochladen" }));
      else setErr(tr(locale, { uz: "Xatolik yuz berdi", ru: "Произошла ошибка", en: "An error occurred", de: "Ein Fehler ist aufgetreten" }));
    });
  };

  const fld = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-100";
  const tab = (active: boolean) => cn("flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-sm font-semibold transition", active ? "border-brand-500 bg-brand-600 text-white" : "border-slate-300 bg-white text-slate-500 hover:border-brand-300 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-300");

  return (
    <div className="mb-3 space-y-2.5 rounded-xl border border-brand-200 bg-brand-50/50 p-3 dark:border-brand-900/50 dark:bg-brand-950/20">
      {/* To'lov turi */}
      <div>
        <label className="mb-1 block text-[11px] font-semibold text-slate-500">{tr(locale, { uz: "To'lov turi", ru: "Тип оплаты", en: "Payment type", de: "Zahlungsart" })}</label>
        <div className="flex gap-2">
          <button type="button" onClick={() => setMethod("CASH")} className={tab(method === "CASH")}><Icon name="wallet" className="h-4 w-4" /> {tr(locale, { uz: "Naqd", ru: "Наличные", en: "Cash", de: "Bar" })}</button>
          <button type="button" onClick={() => setMethod("CARD")} className={tab(method === "CARD")}><Icon name="card" className="h-4 w-4" /> {tr(locale, { uz: "Karta", ru: "Карта", en: "Card", de: "Karte" })}</button>
          <button type="button" onClick={() => setMethod("BANK")} className={tab(method === "BANK")}><Icon name="building" className="h-4 w-4" /> {tr(locale, { uz: "Bank hisobi", ru: "Банк. счёт", en: "Bank", de: "Bank" })}</button>
        </div>
      </div>

      {/* Summa */}
      <div>
        <label className="mb-1 block text-[11px] font-semibold text-slate-500">{tr(locale, { uz: "Summa (so'm)", ru: "Сумма (сум)", en: "Amount (sum)", de: "Betrag (UZS)" })}</label>
        <input inputMode="numeric" value={amountStr} onChange={(e) => setAmount(e.target.value)} placeholder="500 000" className={cn(fld, "font-semibold tabular-nums")} autoFocus />
      </div>

      {/* Vaqt */}
      <div>
        <label className="mb-1 block text-[11px] font-semibold text-slate-500">{tr(locale, { uz: "To'lov vaqti", ru: "Время оплаты", en: "Payment time", de: "Zahlungszeit" })}</label>
        <input type="datetime-local" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} className={fld} />
      </div>

      {/* Kim qabul qildi (kassir) */}
      <div className="flex items-center justify-between rounded-lg bg-white/70 px-3 py-2 text-xs dark:bg-slate-800/40">
        <span className="text-slate-400">{tr(locale, { uz: "Qabul qildi", ru: "Принял", en: "Received by", de: "Angenommen von" })}</span>
        <span className="font-semibold text-slate-600 dark:text-slate-200">{cashierName}</span>
      </div>

      {/* Chek yuklash — sozlamaga qarab (ixtiyoriy bo'lsa ham yuklash mumkin) */}
      {(
        <div>
          <label className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
            {tr(locale, { uz: "Chek (rasm yoki PDF)", ru: "Чек (фото или PDF)", en: "Receipt (image or PDF)", de: "Beleg (Bild oder PDF)" })}
            {isReceiptRequired(receiptMode, method) ? (
              <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                {tr(locale, { uz: "majburiy", ru: "обязательно", en: "required", de: "erforderlich" })}
              </span>
            ) : (
              <span className="rounded bg-slate-500/10 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                {tr(locale, { uz: "ixtiyoriy", ru: "необязательно", en: "optional", de: "optional" })}
              </span>
            )}
          </label>
          {receiptUrl ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <Icon name="check" className="h-4 w-4 shrink-0 text-emerald-500" />
              <a href={receiptUrl} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate font-medium text-emerald-700 hover:underline dark:text-emerald-400">{receiptUrl.split("/").pop()}</a>
              <button type="button" onClick={() => setReceiptUrl("")} className="shrink-0 text-rose-500 hover:text-rose-600">✕</button>
            </div>
          ) : uploading ? (
            <div className="rounded-lg border border-slate-200 p-2.5 dark:border-slate-700">
              <div className="mb-1 flex justify-between text-[11px] text-slate-500"><span>{tr(locale, { uz: "Yuklanmoqda...", ru: "Загрузка...", en: "Uploading...", de: "Wird hochgeladen..." })}</span><span className="font-semibold tabular-nums">{pct}%</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} /></div>
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 py-3 text-sm font-medium text-slate-500 transition hover:border-brand-400 hover:text-brand-600 dark:border-slate-600 dark:text-slate-400">
              <Icon name="download" className="h-4 w-4 rotate-180" /> {tr(locale, { uz: "Chek yuklash", ru: "Загрузить чек", en: "Upload receipt", de: "Beleg hochladen" })}
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={onPickChek} />
        </div>
      )}

      {err && <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{err}</p>}
      <div className="flex gap-2 pt-0.5">
        <button onClick={submit} disabled={busy || uploading} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60">
          {busy ? <Icon name="refresh" className="h-4 w-4 animate-spin" /> : <Icon name="check" className="h-4 w-4" />}
          {tr(locale, { uz: "Qabul qilish va chek", ru: "Принять и чек", en: "Accept & receipt", de: "Annehmen & Beleg" })}
        </button>
        <button onClick={onCancel} disabled={busy} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-white/10">
          {tr(locale, { uz: "Bekor", ru: "Отмена", en: "Cancel", de: "Abbrechen" })}
        </button>
      </div>
    </div>
  );
}

export const PAY_METHOD_OPTS: { v: string; l: Record<Locale, string> }[] = [
  { v: "CASH", l: { uz: "Naqd", ru: "Наличные", en: "Cash", de: "Bar" } },
  { v: "CARD", l: { uz: "Karta", ru: "Карта", en: "Card", de: "Karte" } },
  { v: "CLICK", l: { uz: "Click", ru: "Click", en: "Click", de: "Click" } },
  { v: "PAYME", l: { uz: "Payme", ru: "Payme", en: "Payme", de: "Payme" } },
  { v: "UZUM", l: { uz: "Uzum", ru: "Uzum", en: "Uzum", de: "Uzum" } },
  { v: "TRANSFER", l: { uz: "O'tkazma", ru: "Перевод", en: "Transfer", de: "Überweisung" } },
];

// ─── CHEK (to'lov kviatansiyasi) — chop etsa bo'ladi ───
export function ReceiptModal({ receipt: r, locale, onClose }: { receipt: ReceiptData; locale: Locale; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (!mounted) return null;

  const d = new Date(r.dateIso);
  const p2 = (n: number) => String(n).padStart(2, "0");
  const dateStr = `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
  const methodLabel = PAY_METHOD_OPTS.find((m) => m.v === r.method);
  const row = "flex justify-between gap-3 py-1 text-[13px]";

  return createPortal(
    <>
      <style>{`@media print {
        body > *:not(#gl-receipt-print) { display: none !important; }
        #gl-receipt-print { position: absolute !important; inset: 0 !important; background: #fff !important; }
        #gl-receipt-print .gl-no-print { display: none !important; }
        #gl-receipt-card { box-shadow: none !important; border: none !important; margin: 0 auto !important; }
      }`}</style>
      <div id="gl-receipt-print" className="fixed inset-0 z-[95] flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm sm:pt-16" onMouseDown={onClose}>
        <div onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-[360px]">
          {/* Chek qog'ozi */}
          <div id="gl-receipt-card" className="rounded-t-2xl bg-white px-6 py-6 text-slate-800 shadow-pop">
            <div className="text-center">
              <div className="text-lg font-black uppercase tracking-tight text-slate-900">{r.orgName}</div>
              {r.branchName && <div className="mt-0.5 text-xs font-medium text-slate-500">{r.branchName}</div>}
              {r.branchAddress && <div className="text-[11px] text-slate-400">{r.branchAddress}</div>}
              {r.branchPhone && <div className="text-[11px] text-slate-400">{r.branchPhone}</div>}
            </div>

            <div className="my-3 border-t border-dashed border-slate-300" />

            <div className="text-center">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{tr(locale, { uz: "To'lov cheki", ru: "Чек об оплате", en: "Payment receipt", de: "Zahlungsbeleg" })}</div>
              <div className="mt-1 font-mono text-xs text-slate-500">№ {r.docNumber}</div>
              <div className="text-[11px] text-slate-400">{dateStr}</div>
            </div>

            <div className="my-3 border-t border-dashed border-slate-300" />

            <div className="space-y-0.5">
              <div className={row}><span className="text-slate-400">{tr(locale, { uz: "O'quvchi", ru: "Ученик", en: "Student", de: "Schüler" })}</span><span className="text-right font-semibold text-slate-700">{r.studentName}</span></div>
              {r.studentPhone && <div className={row}><span className="text-slate-400">{tr(locale, { uz: "Telefon", ru: "Телефон", en: "Phone", de: "Telefon" })}</span><span className="text-right text-slate-600">{r.studentPhone}</span></div>}
              <div className={row}><span className="text-slate-400">{tr(locale, { uz: "Maqsad", ru: "Назначение", en: "Purpose", de: "Zweck" })}</span><span className="text-right text-slate-600">{r.purpose}</span></div>
              <div className={row}><span className="text-slate-400">{tr(locale, { uz: "Usul", ru: "Способ", en: "Method", de: "Methode" })}</span><span className="text-right text-slate-600">{methodLabel ? tr(locale, methodLabel.l) : r.method}</span></div>
              <div className={row}><span className="text-slate-400">{tr(locale, { uz: "Kassir", ru: "Кассир", en: "Cashier", de: "Kassierer" })}</span><span className="text-right text-slate-600">{r.cashier}</span></div>
            </div>

            <div className="my-3 border-t border-dashed border-slate-300" />

            <div className="flex items-center justify-between">
              <span className="text-sm font-bold uppercase text-slate-500">{tr(locale, { uz: "Jami", ru: "Итого", en: "Total", de: "Gesamt" })}</span>
              <span className="text-xl font-black tabular-nums text-slate-900">{formatMoney(r.amount, locale)}</span>
            </div>

            <div className="mt-4 text-center text-[11px] italic text-slate-400">{r.footer}</div>
          </div>

          {/* Yuklangan chek fayli (karta to'lovi) — chop etilmaydi */}
          {r.receiptUrl && (
            <a href={r.receiptUrl} target="_blank" rel="noreferrer" className="gl-no-print flex items-center gap-2 bg-white/95 px-4 pt-2 text-xs font-medium text-brand-600 hover:underline">
              <Icon name="card" className="h-4 w-4" /> {tr(locale, { uz: "Yuklangan chekni ko'rish", ru: "Открыть загруженный чек", en: "View uploaded receipt", de: "Hochgeladenen Beleg ansehen" })}
            </a>
          )}

          {/* Amallar (chekda chop etilmaydi) */}
          <div className="gl-no-print flex gap-2 rounded-b-2xl bg-white/95 px-4 pb-4 pt-1">
            <button onClick={() => window.print()} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700">
              <Icon name="printer" className="h-4 w-4" /> {tr(locale, { uz: "Chop etish", ru: "Печать", en: "Print", de: "Drucken" })}
            </button>
            <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-500 transition hover:bg-slate-100">
              {tr(locale, { uz: "Yopish", ru: "Закрыть", en: "Close", de: "Schließen" })}
            </button>
          </div>
        </div>
      </div>
    </>, document.body);
}

// Oy to'lovi katakchasi — to'langan (yashil) yoki to'lanmagan (qizil)
// Yaqinda kelgan (hali bir oy bo'lmagan) o'quvchi uchun "o'tgan oy" o'rniga qo'shilgan sanasi
export function JoinDateTile({ joinDate, locale }: { joinDate: string | null; locale: Locale }) {
  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50/60 px-3.5 py-2.5 dark:border-brand-900/40 dark:bg-brand-950/20">
      <div className="text-[11px] font-medium text-slate-400">{tr(locale, { uz: "Kelgan sanasi", ru: "Дата прихода", en: "Join date", de: "Beitrittsdatum" })}</div>
      <div className="mt-1 flex items-center gap-1.5 text-sm font-bold text-brand-700 dark:text-brand-300">
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-500/15"><Icon name="calendar" className="h-3 w-3" /></span>
        {joinDate ? fmtDate(joinDate) : "—"}
      </div>
      <div className="mt-0.5 text-[11px] text-slate-400">{tr(locale, { uz: "Hali 1 oy bo'lmagan", ru: "Ещё нет месяца", en: "Less than a month", de: "Weniger als ein Monat" })}</div>
    </div>
  );
}

export function PayTile({ label: lbl, m, loading, locale }: { label: string; m?: MonthPay; loading: boolean; locale: Locale }) {
  if (loading || !m) {
    return (
      <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 py-2.5 dark:border-white/5 dark:bg-white/[0.03]">
        <div className="text-[11px] font-medium text-slate-400">{lbl}</div>
        <div className="mt-1.5 h-4 w-20 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
      </div>
    );
  }
  return (
    <div className={cn("rounded-xl border px-3.5 py-2.5", m.paid
      ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20"
      : "border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/20")}>
      <div className="text-[11px] font-medium text-slate-400">{lbl}</div>
      <div className={cn("mt-1 flex items-center gap-1.5 text-sm font-bold", m.paid ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
        <span className={cn("flex h-4 w-4 items-center justify-center rounded-full", m.paid ? "bg-emerald-500/15" : "bg-rose-500/15")}><Icon name={m.paid ? "check" : "close"} className="h-3 w-3" /></span>
        {m.paid ? tr(locale, { uz: "To'langan", ru: "Оплачено", en: "Paid", de: "Bezahlt" }) : tr(locale, { uz: "To'lanmagan", ru: "Не оплачено", en: "Unpaid", de: "Unbezahlt" })}
      </div>
      {m.paid && (
        <div className="mt-0.5 text-[11px] font-semibold tabular-nums text-slate-500 dark:text-slate-400">
          {formatMoney(m.amount, locale)}{m.date ? ` · ${fmtDate(m.date)}` : ""}
        </div>
      )}
    </div>
  );
}

// To'lov statusi rangi (chip)
export function payStatusStyle(status: string): { fg: string; bg: string } {
  switch (status) {
    case "PAID": return { fg: "#16a34a", bg: "#16a34a1a" };
    case "PENDING": return { fg: "#d97706", bg: "#d977061a" };
    case "REFUNDED": return { fg: "#0891b2", bg: "#0891b21a" };
    case "CANCELLED": return { fg: "#dc2626", bg: "#dc26261a" };
    default: return { fg: "#64748b", bg: "#64748b1a" };
  }
}

