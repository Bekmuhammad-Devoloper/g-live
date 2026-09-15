"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatMoney, type Locale } from "@/lib/constants";
import { Badge, Card, EmptyRow, Table } from "../../../_components/ui";
import { fin } from "../_i18n";
import { approvePeriodAction, closePeriodAction, payoutAction, recalculatePeriodAction, reopenPeriodAction } from "../actions";

export interface PeriodRow { periodId: string | null; teacherId: string; teacherName: string; status: string; gross: number; commission: number; fixed: number; paid: number; remaining: number; needsReview: number; source: string }
export interface AccountOpt { id: string; name: string }
type Perms = { recalc: boolean; approve: boolean; pay: boolean; close: boolean; reopen: boolean };

const tone = (s: string) => (s === "CLOSED" ? "slate" : s === "PAID" ? "green" : s === "APPROVED" || s === "PARTIALLY_PAID" ? "blue" : s === "CALCULATED" ? "amber" : "slate");

export default function SalaryPeriodsView({ locale: L, ym, rows, accounts, perms }: { locale: Locale; ym: string; rows: PeriodRow[]; accounts: AccountOpt[]; perms: Perms }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) => start(async () => { const r = await fn(); setMsg(r.ok ? fin(L, "done") : r.message ?? fin(L, "error")); router.refresh(); });
  const payout = (r: PeriodRow) => {
    const amount = window.prompt(`${fin(L, "payout")} — ${fin(L, "amount")} (max ${r.remaining})`, String(r.remaining));
    if (!amount || !r.periodId) return;
    const accountId = accounts.length === 1 ? accounts[0].id : window.prompt(`${fin(L, "account")}:\n${accounts.map((a, i) => `${i + 1}. ${a.name}`).join("\n")}`, "1");
    const acc = accounts[Number(accountId) - 1] ?? accounts.find((a) => a.id === accountId);
    if (!acc) return;
    run(() => payoutAction({ salaryPeriodId: r.periodId!, amount: Math.trunc(Number(amount)), financialAccountId: acc.id, paidAt: new Date(), idempotencyKey: crypto.randomUUID() }));
  };
  const withReason = (label: string, fn: (reason: string) => Promise<{ ok: boolean; message?: string }>) => { const reason = window.prompt(`${label} — ${fin(L, "reason")}`) ?? ""; if (reason.trim().length >= 3) run(() => fn(reason)); };
  return (
    <>
      {msg && <p className="mb-3 text-xs text-slate-500">{msg}</p>}
      <Card padded={false}>
        <Table head={<tr><th className="px-4 py-3 text-left">{fin(L, "teacher")}</th><th className="px-3 py-3 text-left">{fin(L, "status")}</th><th className="px-3 py-3 text-right">{fin(L, "fixed")}</th><th className="px-3 py-3 text-right">{fin(L, "earning")}</th><th className="px-3 py-3 text-right">{fin(L, "gross")}</th><th className="px-3 py-3 text-right">{fin(L, "paid")}</th><th className="px-3 py-3 text-right">{fin(L, "remaining")}</th><th className="px-3 py-3 text-right">{fin(L, "actions")}</th></tr>}>
          {rows.length === 0 ? <EmptyRow colSpan={8} text={fin(L, "empty")} /> : rows.map((r) => (
            <tr key={r.teacherId} className="text-sm">
              <td className="px-4 py-2.5 font-medium">{r.periodId ? <Link className="text-brand-700 hover:underline" href={`/finance/v2/salary/${r.periodId}`}>{r.teacherName}</Link> : r.teacherName}{r.needsReview > 0 && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">{fin(L, "needsReview")}: {r.needsReview}</span>}{r.source === "LEGACY" && <span className="ml-2 text-[11px] text-slate-400">legacy</span>}</td>
              <td className="px-3 py-2.5"><Badge tone={tone(r.status)}>{r.status}</Badge></td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatMoney(r.fixed, L)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatMoney(r.commission, L)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums font-semibold">{formatMoney(r.gross, L)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-emerald-600">{formatMoney(r.paid, L)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-amber-600">{formatMoney(r.remaining, L)}</td>
              <td className="px-3 py-2.5 text-right">
                <div className="flex flex-wrap justify-end gap-1">
                  {perms.recalc && (r.status === "OPEN" || r.status === "CALCULATED" || r.status === "—") && <button type="button" className="btn-ghost px-2 py-1 text-xs" disabled={pending} onClick={() => run(() => recalculatePeriodAction(r.teacherId, ym))}>{fin(L, "recalculate")}</button>}
                  {perms.approve && r.periodId && r.status === "CALCULATED" && <button type="button" className="btn-primary px-2 py-1 text-xs" disabled={pending} onClick={() => { if (window.confirm(fin(L, "confirm"))) run(() => approvePeriodAction(r.periodId!)); }}>{fin(L, "approve")}</button>}
                  {perms.pay && r.periodId && (r.status === "APPROVED" || r.status === "PARTIALLY_PAID") && r.remaining > 0 && <button type="button" className="btn-primary px-2 py-1 text-xs" disabled={pending} onClick={() => payout(r)}>{fin(L, "payout")}</button>}
                  {perms.close && r.periodId && r.status === "PAID" && <button type="button" className="btn-ghost px-2 py-1 text-xs" disabled={pending} onClick={() => withReason(fin(L, "close"), (reason) => closePeriodAction(r.periodId!, reason))}>{fin(L, "close")}</button>}
                  {perms.reopen && r.periodId && (r.status === "CLOSED" || r.status === "PAID" || r.status === "APPROVED" || r.status === "PARTIALLY_PAID") && <button type="button" className="btn-ghost px-2 py-1 text-xs" disabled={pending} onClick={() => withReason(fin(L, "reopen"), (reason) => reopenPeriodAction(r.periodId!, reason))}>{fin(L, "reopen")}</button>}
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
