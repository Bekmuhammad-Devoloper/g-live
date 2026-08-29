"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { formatMoney, type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Icon } from "../../_components/Icon";
import { Avatar, CAT_ICON, CAT_LABEL, kpiColor, nf, RankBadge, type Cat, type VKpiRow } from "./KpiShared";
import { saveKpiPay } from "./actions";

// Eski loyihadagi jadval: operator/admin uchun 10 ustun, ROP uchun 7 ustun.
// canEdit — oylik/bonusni tahrirlash huquqi (ish haqi moduli); qolgan ustunlar hisoblanadi.
export default function KpiTable({ rows, tab, locale, canEdit = false }: { rows: VKpiRow[]; tab: Cat; locale: Locale; canEdit?: boolean }) {
  const isRop = tab === "rop";
  const cols = (isRop ? 7 : 10) + (canEdit ? 1 : 0);
  const [editing, setEditing] = useState<VKpiRow | null>(null);

  const t = {
    employee: tr(locale, { uz: "Xodim", ru: "Сотрудник", en: "Employee", de: "Mitarbeiter" }),
    total: tr(locale, { uz: "Jami lidlar", ru: "Всего лидов", en: "Total leads", de: "Leads gesamt" }),
    success: tr(locale, { uz: "Muvaffaqiyat", ru: "Успех", en: "Success", de: "Erfolg" }),
    blocked: tr(locale, { uz: "Bloklangan", ru: "Заблокировано", en: "Blocked", de: "Blockiert" }),
    operators: tr(locale, { uz: "Operatorlar", ru: "Операторы", en: "Operators", de: "Operatoren" }),
    conv: tr(locale, { uz: "Konversiya", ru: "Конверсия", en: "Conversion", de: "Konversion" }),
    salary: tr(locale, { uz: "Oylik to'lov", ru: "Оклад", en: "Monthly pay", de: "Monatliches Gehalt" }),
    earned: tr(locale, { uz: "Yig'gan (oy)", ru: "Заработано (мес.)", en: "Earned (month)", de: "Verdient (Monat)" }),
    workDays: tr(locale, { uz: "Ish kunlari", ru: "Рабочие дни", en: "Work days", de: "Arbeitstage" }),
    lead: tr(locale, { uz: "lid", ru: "лид", en: "leads", de: "Leads" }),
    days: tr(locale, { uz: "kun", ru: "дн.", en: "days", de: "Tage" }),
    empty: tr(locale, { uz: "Ma'lumot topilmadi", ru: "Данные не найдены", en: "No data found", de: "Keine Daten gefunden" }),
    actions: tr(locale, { uz: "Amallar", ru: "Действия", en: "Actions", de: "Aktionen" }),
    edit: tr(locale, { uz: "Oylik va bonusni tahrirlash", ru: "Изменить оклад и бонус", en: "Edit pay and bonus", de: "Gehalt und Bonus bearbeiten" }),
  };

  const th = "px-4 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500";

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <table className={`w-full text-left text-sm ${isRop ? "min-w-[760px]" : "min-w-[1100px]"}`}>
          <thead className="border-b border-slate-200/70 bg-slate-50/60 dark:border-slate-800 dark:bg-white/[0.02]">
            <tr>
              <th className={`${th} w-14 text-center`}>#</th>
              <th className={th}>{t.employee}</th>
              <th className={`${th} text-center`}>{t.total}</th>
              <th className={`${th} text-center`}>{t.success}</th>
              <th className={`${th} text-center`}>{isRop ? t.operators : t.blocked}</th>
              <th className={`${th} text-center`}>{t.conv}</th>
              <th className={`${th} text-center`}>KPI</th>
              {!isRop && (
                <>
                  <th className={`${th} text-center`}>{t.salary}</th>
                  <th className={`${th} text-center`}>{t.earned}</th>
                  <th className={`${th} text-center`}>{t.workDays}</th>
                </>
              )}
              {canEdit && <th className={`${th} text-right`}>{t.actions}</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={cols} className="px-5 py-16 text-center">
                  <Icon name="users" className="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-slate-700" />
                  <p className="text-sm font-medium text-slate-400">{t.empty}</p>
                </td>
              </tr>
            ) : (
              rows.map((o, i) => {
                const rank = i + 1;
                const c = kpiColor(o.kpiPct);
                return (
                  <tr key={o.id} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    {/* Reyting */}
                    <td className="px-4 py-3.5">
                      <RankBadge rank={rank} />
                    </td>
                    {/* Xodim */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={o.name} cat={o.cat} size={36} imageUrl={o.imageUrl} />
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-slate-800 dark:text-slate-100">{o.name}</div>
                          <div className="flex items-center gap-1 text-[11px] text-slate-400">
                            <Icon name={CAT_ICON[o.cat]} className="h-3 w-3" />
                            {tr(locale, CAT_LABEL[o.cat])}
                          </div>
                        </div>
                      </div>
                    </td>
                    {/* Jami lidlar */}
                    <td className="px-4 py-3.5 text-center font-semibold tabular-nums text-slate-700 dark:text-slate-200">{o.total}</td>
                    {/* Muvaffaqiyat */}
                    <td className="px-4 py-3.5 text-center">
                      <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                        <Icon name="arrowUpRight" className="h-3.5 w-3.5" />
                        {o.won}
                      </span>
                    </td>
                    {/* Bloklangan (operator/admin) yoki Operatorlar soni (ROP) */}
                    <td className="px-4 py-3.5 text-center">
                      {isRop ? (
                        <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-blue-600 dark:text-blue-400">
                          <Icon name="users" className="h-3.5 w-3.5" />
                          {o.opsCount}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-rose-500">
                          <Icon name="arrowDownLeft" className="h-3.5 w-3.5" />
                          {o.blocked}
                        </span>
                      )}
                    </td>
                    {/* Konversiya */}
                    <td className="px-4 py-3.5 text-center font-bold tabular-nums" style={{ color: kpiColor(o.conv) }}>
                      {o.conv}%
                    </td>
                    {/* KPI (pul) */}
                    <td className="px-4 py-3.5 text-center">
                      <div className="font-bold tabular-nums" style={{ color: c }}>
                        {formatMoney(o.kpiMoney, locale)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {o.won} {t.lead} × {nf(o.bonus)}
                      </div>
                    </td>
                    {!isRop && (
                      <>
                        {/* Oylik to'lov (fiksa) */}
                        <td className="px-4 py-3.5 text-center">
                          <div className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">{formatMoney(o.fiksa, locale)}</div>
                          <div className="text-[10px] text-emerald-500">+{nf(o.bonus)}/{t.lead}</div>
                        </td>
                        {/* Yig'gan (oy) */}
                        <td className="px-4 py-3.5 text-center">
                          <div className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{formatMoney(o.earnedMonth, locale)}</div>
                          <div className="text-[10px] text-slate-400">
                            {o.wonMonth} {t.lead} × {nf(o.bonus)}
                          </div>
                        </td>
                        {/* Ish kunlari */}
                        <td className="px-4 py-3.5 text-center">
                          <span className="font-semibold tabular-nums text-blue-600 dark:text-blue-400">{o.workDays}</span>{" "}
                          <span className="text-[10px] text-slate-400">{t.days}</span>
                        </td>
                      </>
                    )}
                    {canEdit && (
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={() => setEditing(o)}
                          title={t.edit}
                          className="inline-grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-800"
                        >
                          <Icon name="pencil" className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {editing && <EditPayModal row={editing} locale={locale} onClose={() => setEditing(null)} />}
    </div>
  );
}

// ─── Oylik to'lov + lid bonusini tahrirlash oynasi ───
function EditPayModal({ row, locale, onClose }: { row: VKpiRow; locale: Locale; onClose: () => void }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [fiksa, setFiksa] = useState(nf(row.fiksa));
  const [bonus, setBonus] = useState(nf(row.bonus));
  const [err, setErr] = useState<string | null>(null);
  const [busy, start] = useTransition();

  useEffect(() => {
    setMounted(true);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (!mounted) return null;

  const money = (v: string) => v.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const num = (v: string) => Number(v.replace(/\s/g, "")) || 0;

  const submit = () => {
    setErr(null);
    start(async () => {
      const r = await saveKpiPay(row.id, num(fiksa), num(bonus));
      if (r.ok) { onClose(); router.refresh(); }
      else setErr(r.error === "forbidden"
        ? tr(locale, { uz: "Sizda ish haqini tahrirlash huquqi yo'q", ru: "Нет прав на изменение зарплаты", en: "No permission to edit pay", de: "Sie haben keine Berechtigung, das Gehalt zu bearbeiten" })
        : tr(locale, { uz: "Saqlab bo'lmadi", ru: "Не удалось сохранить", en: "Could not save", de: "Konnte nicht gespeichert werden" }));
    });
  };

  const inp = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold tabular-nums text-slate-800 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100";
  const lbl = "mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400";

  // Joriy oy uchun taxminiy hisob — kiritilayotgan qiymatlar bo'yicha
  const preview = num(fiksa) + row.wonMonth * num(bonus);

  return createPortal(
    <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-900/50 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div onMouseDown={(e) => e.stopPropagation()} className="w-[400px] max-w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-pop dark:border-slate-700 dark:bg-slate-900">
        {/* Sarlavha */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={row.name} cat={row.cat} size={38} imageUrl={row.imageUrl} />
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{row.name}</div>
              <div className="flex items-center gap-1 text-[11px] text-slate-400">
                <Icon name={CAT_ICON[row.cat]} className="h-3 w-3" />
                {tr(locale, CAT_LABEL[row.cat])}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800">
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3.5 px-5 py-4">
          <div>
            <label className={lbl}>{tr(locale, { uz: "Oylik to'lov (fiksa, so'm)", ru: "Оклад (фикс, сум)", en: "Monthly pay (fixed, UZS)", de: "Monatliches Gehalt (fest, UZS)" })}</label>
            <input inputMode="numeric" value={fiksa} onChange={(e) => setFiksa(money(e.target.value))} placeholder="5 000 000" className={inp} autoFocus />
          </div>
          <div>
            <label className={lbl}>{tr(locale, { uz: "Har bir muvaffaqiyatli lid uchun bonus (so'm)", ru: "Бонус за успешный лид (сум)", en: "Bonus per won lead (UZS)", de: "Bonus pro gewonnenem Lead (UZS)" })}</label>
            <input inputMode="numeric" value={bonus} onChange={(e) => setBonus(money(e.target.value))} placeholder="200 000" className={inp} />
          </div>

          {/* Taxminiy hisob */}
          <div className="rounded-xl bg-slate-50 px-3.5 py-3 text-xs dark:bg-white/[0.03]">
            <div className="flex items-center justify-between text-slate-500">
              <span>{tr(locale, { uz: "Shu oyda yopilgan lidlar", ru: "Закрыто лидов в этом месяце", en: "Leads won this month", de: "Diesen Monat gewonnene Leads" })}</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">{row.wonMonth}</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between border-t border-slate-200/70 pt-1.5 dark:border-slate-700">
              <span className="font-medium text-slate-600 dark:text-slate-300">{tr(locale, { uz: "Taxminiy oylik jami", ru: "Примерно за месяц", en: "Estimated month total", de: "Geschätzte Monatssumme" })}</span>
              <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{formatMoney(preview, locale)}</span>
            </div>
          </div>

          {err && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{err}</p>}
        </div>

        <div className="flex gap-2 border-t border-slate-100 px-5 py-4 dark:border-slate-800">
          <button onClick={onClose} disabled={busy} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
            {tr(locale, { uz: "Bekor", ru: "Отмена", en: "Cancel", de: "Abbrechen" })}
          </button>
          <button onClick={submit} disabled={busy} className={cn("flex-[1.4] rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700", busy && "opacity-60")}>
            {busy ? tr(locale, { uz: "Saqlanmoqda...", ru: "Сохранение...", en: "Saving...", de: "Wird gespeichert..." }) : tr(locale, { uz: "Saqlash", ru: "Сохранить", en: "Save", de: "Speichern" })}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
