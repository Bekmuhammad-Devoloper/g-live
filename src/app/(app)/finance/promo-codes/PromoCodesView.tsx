"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import { formatMoney, type Locale } from "@/lib/constants";
import { Icon } from "../../_components/Icon";
import { confirmDelete, alertDialog } from "../../_components/dialogs";
import { savePromo, setPromoActive, deletePromo } from "./actions";

export interface VPromo {
  id: string;
  code: string;
  discount: number;
  minCourses: number | null;
  note: string | null;
  isActive: boolean;
  uses: number;
  totalDiscount: number;
  createdAt: string;
}
export interface VPromoUse {
  id: string;
  date: string;
  code: string;
  student: string;
  studentId: string;
  amount: number;
  discount: number;
  author: string | null;
}

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
};

export default function PromoCodesView({ locale, promos, uses, canManage }: {
  locale: Locale;
  promos: VPromo[];
  uses: VPromoUse[];
  canManage: boolean;
}) {
  const L = (uz: string, ru: string, en: string, de: string) => tr(locale, { uz, ru, en, de });
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState<{ id: string | null; code: string; discount: string; minCourses: string; note: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const errText = (e?: string) =>
    e === "code" ? L("Kod 2–30 belgi: lotin harflar, raqamlar, - yoki _", "Код 2–30 символов: латиница, цифры, - или _", "Code: 2–30 chars, letters, digits, - or _", "Code: 2–30 Zeichen, Buchstaben, Ziffern, - oder _")
    : e === "discount" ? L("Chegirma summasini kiriting", "Укажите сумму скидки", "Enter the discount amount", "Rabattbetrag eingeben")
    : e === "exists" ? L("Bunday kod allaqachon bor", "Такой код уже существует", "This code already exists", "Dieser Code existiert bereits")
    : e === "used_rename" ? L("Bu kod bilan to'lovlar bor — nomini o'zgartirib bo'lmaydi", "По коду уже есть платежи — переименовать нельзя", "Payments exist with this code — it cannot be renamed", "Es gibt Zahlungen mit diesem Code — Umbenennen nicht möglich")
    : e === "forbidden" ? L("Ruxsat yo'q", "Нет доступа", "No permission", "Keine Berechtigung")
    : L("Xatolik yuz berdi", "Произошла ошибка", "An error occurred", "Ein Fehler ist aufgetreten");

  const openNew = () => { setErr(null); setForm({ id: null, code: "", discount: "", minCourses: "", note: "" }); };
  const openEdit = (p: VPromo) => { setErr(null); setForm({ id: p.id, code: p.code, discount: String(p.discount), minCourses: p.minCourses ? String(p.minCourses) : "", note: p.note ?? "" }); };

  const submit = () => {
    if (!form) return;
    setErr(null);
    start(async () => {
      const r = await savePromo({
        id: form.id, code: form.code, discount: Number(form.discount.replace(/\s/g, "")),
        minCourses: form.minCourses ? Number(form.minCourses) : null, note: form.note,
      });
      if (r.ok) { setForm(null); router.refresh(); } else setErr(errText(r.error));
    });
  };

  const toggle = (p: VPromo) => start(async () => {
    const r = await setPromoActive(p.id, !p.isActive);
    if (r.ok) router.refresh(); else await alertDialog(errText(r.error));
  });

  const remove = async (p: VPromo) => {
    if (!(await confirmDelete({ title: L("Promokodni o'chirish", "Удалить промокод", "Delete promo code", "Promo-Code löschen"), message: p.code }))) return;
    start(async () => {
      const r = await deletePromo(p.id);
      if (r.ok) router.refresh();
      else await alertDialog(r.error === "used"
        ? L("Bu kod bilan to'lovlar bor. O'chirish o'rniga uni o'chirib qo'ying (faolsizlantiring).", "По коду есть платежи. Вместо удаления отключите его.", "Payments exist with this code. Disable it instead of deleting.", "Es gibt Zahlungen mit diesem Code. Deaktivieren statt löschen.")
        : errText(r.error));
    });
  };

  const fld = "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";
  const shownUses = filter ? uses.filter((u) => u.code === filter) : uses;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{L("Promokodlar", "Промокоды", "Promo codes", "Promo-Codes")}</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {L("Chegirma kodlari. To'lov qabul qilishda tanlanadi, chegirma qarzdorlikdan ayriladi.", "Коды скидок. Выбираются при приёме оплаты, скидка уменьшает долг.", "Discount codes. Chosen when accepting a payment; the discount reduces the debt.", "Rabattcodes. Bei der Zahlungsannahme gewählt; der Rabatt mindert die Schuld.")}
          </p>
        </div>
        {canManage && (
          <button type="button" onClick={openNew} className="btn-primary inline-flex items-center gap-1.5">
            <Icon name="plus" className="h-4 w-4" /> {L("Yangi promokod", "Новый промокод", "New promo code", "Neuer Promo-Code")}
          </button>
        )}
      </div>

      {form && (
        <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-4 dark:border-brand-900/50 dark:bg-brand-950/20">
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">{L("Kod", "Код", "Code", "Code")} *</label>
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="2KURS" className={cn(fld, "font-mono uppercase")} autoFocus />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">{L("Chegirma (so'm)", "Скидка (сум)", "Discount (UZS)", "Rabatt (UZS)")} *</label>
              <input inputMode="numeric" value={form.discount} onChange={(e) => { const d = e.target.value.replace(/\D/g, ""); setForm({ ...form, discount: d ? d.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : "" }); }} placeholder="50 000" className={cn(fld, "tabular-nums")} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">{L("Kamida kurslar soni", "Мин. число курсов", "Min. courses", "Min. Kurse")}</label>
              <select value={form.minCourses} onChange={(e) => setForm({ ...form, minCourses: e.target.value })} className={fld}>
                <option value="">{L("Shartsiz", "Без условия", "No condition", "Ohne Bedingung")}</option>
                {[2, 3, 4, 5].map((n) => <option key={n} value={n}>{L(`${n} va undan ko'p kurs`, `${n} и более курсов`, `${n}+ courses`, `${n}+ Kurse`)}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">{L("Izoh", "Комментарий", "Note", "Notiz")}</label>
              <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={200} placeholder={L("2 ta kursda o'qiydiganlar", "Учащимся на 2 курсах", "Students in 2 courses", "Schüler in 2 Kursen")} className={fld} />
            </div>
          </div>
          {err && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{err}</p>}
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => setForm(null)} className="btn-ghost">{L("Bekor qilish", "Отмена", "Cancel", "Abbrechen")}</button>
            <button type="button" onClick={submit} disabled={pending} className="btn-primary">{pending ? "..." : L("Saqlash", "Сохранить", "Save", "Speichern")}</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500 dark:bg-slate-800/60">
            <tr>
              <th className="px-4 py-3">{L("Kod", "Код", "Code", "Code")}</th>
              <th className="px-4 py-3">{L("Chegirma", "Скидка", "Discount", "Rabatt")}</th>
              <th className="px-4 py-3">{L("Shart", "Условие", "Condition", "Bedingung")}</th>
              <th className="px-4 py-3">{L("Ishlatilgan", "Использован", "Used", "Verwendet")}</th>
              <th className="px-4 py-3">{L("Jami chegirma", "Всего скидок", "Total discount", "Rabatt gesamt")}</th>
              <th className="px-4 py-3">{L("Holati", "Статус", "Status", "Status")}</th>
              {canManage && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {promos.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">{L("Hali promokod yo'q", "Промокодов пока нет", "No promo codes yet", "Noch keine Promo-Codes")}</td></tr>
            )}
            {promos.map((p) => (
              <tr key={p.id} className={cn(!p.isActive && "opacity-60")}>
                <td className="px-4 py-3">
                  <div className="font-mono font-bold text-slate-800 dark:text-slate-100">{p.code}</div>
                  {p.note && <div className="text-xs text-slate-400">{p.note}</div>}
                </td>
                <td className="px-4 py-3 font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">−{formatMoney(p.discount, locale)}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{p.minCourses ? L(`${p.minCourses}+ kurs`, `${p.minCourses}+ курса`, `${p.minCourses}+ courses`, `${p.minCourses}+ Kurse`) : "—"}</td>
                <td className="px-4 py-3">
                  {p.uses > 0
                    ? <button type="button" onClick={() => setFilter(filter === p.code ? "" : p.code)} className="font-semibold text-brand-600 hover:underline">{p.uses} {L("ta to'lov", "платежей", "payments", "Zahlungen")}</button>
                    : <span className="text-slate-400">0</span>}
                </td>
                <td className="px-4 py-3 tabular-nums text-slate-600 dark:text-slate-300">{formatMoney(p.totalDiscount, locale)}</td>
                <td className="px-4 py-3">
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", p.isActive ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-slate-100 text-slate-500 dark:bg-slate-800")}>
                    {p.isActive ? L("Faol", "Активен", "Active", "Aktiv") : L("O'chirilgan", "Отключён", "Disabled", "Deaktiviert")}
                  </span>
                </td>
                {canManage && (
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => openEdit(p)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800" title={L("Tahrirlash", "Редактировать", "Edit", "Bearbeiten")}><Icon name="edit" className="h-4 w-4" /></button>
                      <button type="button" onClick={() => toggle(p)} disabled={pending} className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                        {p.isActive ? L("O'chirib qo'yish", "Отключить", "Disable", "Deaktivieren") : L("Yoqish", "Включить", "Enable", "Aktivieren")}
                      </button>
                      <button type="button" onClick={() => remove(p)} disabled={pending} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10" title={L("O'chirish", "Удалить", "Delete", "Löschen")}><Icon name="trash" className="h-4 w-4" /></button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {L("Promokod bilan to'laganlar", "Оплатившие с промокодом", "Paid with a promo code", "Mit Promo-Code bezahlt")}
            {filter && <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 font-mono text-xs text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">{filter}</span>}
          </h2>
          {filter && <button type="button" onClick={() => setFilter("")} className="text-xs font-semibold text-slate-400 hover:text-slate-600">{L("Hammasi", "Все", "All", "Alle")}</button>}
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500 dark:bg-slate-800/60">
              <tr>
                <th className="px-4 py-3">{L("Sana", "Дата", "Date", "Datum")}</th>
                <th className="px-4 py-3">{L("O'quvchi", "Ученик", "Student", "Schüler")}</th>
                <th className="px-4 py-3">{L("Promokod", "Промокод", "Promo code", "Promo-Code")}</th>
                <th className="px-4 py-3">{L("To'landi", "Оплачено", "Paid", "Bezahlt")}</th>
                <th className="px-4 py-3">{L("Chegirma", "Скидка", "Discount", "Rabatt")}</th>
                <th className="px-4 py-3">{L("Qabul qildi", "Принял", "Accepted by", "Angenommen von")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {shownUses.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">{L("Hali promokod bilan to'lov yo'q", "Платежей с промокодом пока нет", "No promo payments yet", "Noch keine Promo-Zahlungen")}</td></tr>
              )}
              {shownUses.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3 text-slate-500">{fmtDate(u.date)}</td>
                  <td className="px-4 py-3"><a href={`/students/${u.studentId}`} className="font-medium text-slate-800 hover:text-brand-600 dark:text-slate-100">{u.student}</a></td>
                  <td className="px-4 py-3 font-mono font-semibold text-slate-700 dark:text-slate-200">{u.code}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-700 dark:text-slate-200">{formatMoney(u.amount, locale)}</td>
                  <td className="px-4 py-3 font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">−{formatMoney(u.discount, locale)}</td>
                  <td className="px-4 py-3 text-slate-500">{u.author ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
