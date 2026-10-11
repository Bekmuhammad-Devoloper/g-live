"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatMoney, type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Icon } from "../../_components/Icon";
import { alertDialog, confirmDelete, promptDialog } from "../../_components/dialogs";
import { createExpenseCategory, renameExpenseCategory, deleteExpenseCategory, type CatResult } from "./actions";

export interface VCategory {
  id: string;
  name: string;
  count: number; // faol filialdagi xarajatlar soni
  sum: number; // faol filialdagi xarajatlar summasi
  refs: number; // barcha filiallar bo'yicha bog'langan xarajatlar
}

export default function ExpenseCategoriesView({ categories, writable, locale }: { categories: VCategory[]; writable: boolean; locale: Locale }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const nameLabel = tr(locale, { uz: "Nomi", ru: "Название", en: "Name", de: "Name" });
  const saveLabel = tr(locale, { uz: "Saqlash", ru: "Сохранить", en: "Save", de: "Speichern" });

  const report = async (res: CatResult) => {
    if (res.ok) { router.refresh(); return; }
    const msg = res.error === "duplicate"
      ? tr(locale, { uz: "Bunday nomli toifa allaqachon bor.", ru: "Категория с таким названием уже есть.", en: "A category with this name already exists.", de: "Eine Kategorie mit diesem Namen existiert bereits." })
      : res.error === "forbidden"
        ? tr(locale, { uz: "Ruxsat yo'q.", ru: "Нет доступа.", en: "No permission.", de: "Kein Zugriff." })
        : res.error === "notfound"
          ? tr(locale, { uz: "Toifa topilmadi.", ru: "Категория не найдена.", en: "Category not found.", de: "Kategorie nicht gefunden." })
          : tr(locale, { uz: "Nomi kamida 2 ta belgidan iborat bo'lsin.", ru: "Название должно содержать не менее 2 символов.", en: "Name must be at least 2 characters.", de: "Der Name muss mindestens 2 Zeichen lang sein." });
    await alertDialog({ message: msg, tone: "warning" });
  };

  const onAdd = async () => {
    const name = await promptDialog({ title: tr(locale, { uz: "Yangi toifa", ru: "Новая категория", en: "New category", de: "Neue Kategorie" }), placeholder: nameLabel, minLength: 2, confirmLabel: saveLabel });
    if (!name?.trim()) return;
    start(async () => { await report(await createExpenseCategory(name)); });
  };

  const onRename = async (c: VCategory) => {
    const name = await promptDialog({ title: tr(locale, { uz: "Toifani tahrirlash", ru: "Редактировать категорию", en: "Edit category", de: "Kategorie bearbeiten" }), placeholder: nameLabel, defaultValue: c.name, minLength: 2, confirmLabel: saveLabel });
    if (!name?.trim() || name.trim() === c.name) return;
    start(async () => { await report(await renameExpenseCategory(c.id, name)); });
  };

  const onDelete = async (c: VCategory) => {
    const warn = c.refs > 0
      ? tr(locale, {
        uz: `Bu toifaga ${c.refs} ta xarajat bog'langan. O'chirilsa, ular toifasiz qoladi.`,
        ru: `К этой категории привязано расходов: ${c.refs}. После удаления они останутся без категории.`,
        en: `${c.refs} expense(s) use this category. After deletion they will be uncategorized.`,
        de: `${c.refs} Ausgabe(n) verwenden diese Kategorie. Nach dem Löschen sind sie ohne Kategorie.`,
      })
      : undefined;
    const ok = await confirmDelete({
      title: tr(locale, { uz: `"${c.name}" toifasini o'chirasizmi?`, ru: `Удалить категорию «${c.name}»?`, en: `Delete category "${c.name}"?`, de: `Kategorie „${c.name}" löschen?` }),
      message: warn,
      confirmLabel: tr(locale, { uz: "O'chirish", ru: "Удалить", en: "Delete", de: "Löschen" }),
    });
    if (!ok) return;
    start(async () => { await report(await deleteExpenseCategory(c.id)); });
  };

  const totalSum = categories.reduce((n, c) => n + c.sum, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/finance/expenses" className="mb-1 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600">
            ← {tr(locale, { uz: "Xarajatlar", ru: "Расходы", en: "Expenses", de: "Ausgaben" })}
          </Link>
          <h1 className="text-[24px] font-bold tracking-tight text-slate-900 dark:text-slate-100">{tr(locale, { uz: "Xarajat toifalari", ru: "Категории расходов", en: "Expense categories", de: "Ausgabenkategorien" })}</h1>
        </div>
        {writable && (
          <button onClick={onAdd} disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60">
            <Icon name="plus" className="h-4 w-4" /> {tr(locale, { uz: "Yangisini qo'shish", ru: "Добавить новую", en: "Add new", de: "Neu hinzufügen" })}
          </button>
        )}
      </div>

      <div className="max-w-3xl overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-card dark:border-slate-600 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-slate-200/70 bg-slate-50/60 text-[12px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300">
              <tr>
                <th className="w-14 px-4 py-3.5">ID</th>
                <th className="px-4 py-3.5">{nameLabel}</th>
                <th className="px-4 py-3.5 text-right">{tr(locale, { uz: "Xarajatlar soni", ru: "Кол-во расходов", en: "Expenses", de: "Anzahl" })}</th>
                <th className="px-4 py-3.5 text-right">{tr(locale, { uz: "Jami summa", ru: "Общая сумма", en: "Total amount", de: "Gesamtbetrag" })}</th>
                <th className="px-4 py-3.5 text-right">{tr(locale, { uz: "Amallar", ru: "Действия", en: "Actions", de: "Aktionen" })}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {categories.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-16 text-center text-slate-400">{tr(locale, { uz: "Ko'rsatiladigan ma'lumotlar yo'q", ru: "Нет данных для отображения", en: "No data to display", de: "Keine Daten zum Anzeigen" })}</td></tr>
              ) : categories.map((c, i) => (
                <tr key={c.id} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 text-slate-400" title={c.id}>{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{c.name}</td>
                  <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{c.count}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">{formatMoney(c.sum, locale)}</td>
                  <td className="px-4 py-3 text-right">
                    {writable ? (
                      <div className="inline-flex items-center gap-1.5">
                        <button onClick={() => onRename(c)} disabled={pending} title={tr(locale, { uz: "Tahrirlash", ru: "Редактировать", en: "Edit", de: "Bearbeiten" })}
                          className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-brand-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                          <Icon name="pencil" className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => onDelete(c)} disabled={pending} title={tr(locale, { uz: "O'chirish", ru: "Удалить", en: "Delete", de: "Löschen" })}
                          className="grid h-8 w-8 place-items-center rounded-lg border border-rose-200 text-rose-600 transition hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/30">
                          <Icon name="trash" className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            {categories.length > 0 && (
              <tfoot className="border-t border-slate-200/70 bg-slate-50/60 text-sm dark:border-slate-800 dark:bg-slate-800/40">
                <tr>
                  <td colSpan={2} className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">{tr(locale, { uz: "Jami", ru: "Итого", en: "Total", de: "Gesamt" })}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-300">{categories.reduce((n, c) => n + c.count, 0)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-bold text-slate-800 dark:text-slate-100">{formatMoney(totalSum, locale)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
