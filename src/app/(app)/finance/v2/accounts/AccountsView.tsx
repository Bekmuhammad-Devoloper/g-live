"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatMoney, type Locale } from "@/lib/constants";
import { FINANCIAL_ACCOUNT_TYPES, type FinancialAccountType } from "@/lib/finance/constants";
import { Badge, Card } from "../../../_components/ui";
import { fin } from "../_i18n";
import { createAccountAction, transferAction, updateAccountAction } from "../actions";

interface Row { id: string; name: string; type: string; branch: string; isActive: boolean; inflow: number; outflow: number; balance: number; note: string | null }

export default function AccountsView({ locale: L, enabled, canManage, branches, rows }: { locale: Locale; enabled: boolean; canManage: boolean; branches: { id: string; name: string }[]; rows: Row[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [tr, setTr] = useState({ from: rows[0]?.id ?? "", to: rows[1]?.id ?? "", amount: "", note: "" });
  const [acc, setAcc] = useState({ name: "", type: "CUSTOM" as FinancialAccountType, branchId: "", opening: "" });
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) => start(async () => { const r = await fn(); setMsg(r.ok ? fin(L, "done") : r.message ?? fin(L, "error")); router.refresh(); });
  const active = rows.filter((r) => r.isActive);
  return (
    <div className="space-y-4">
      {msg && <p className="text-xs text-slate-500">{msg}</p>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((r) => (
          <Link key={r.id} href={`/finance/v2/accounts/${r.id}`} className={`card p-4 transition hover:border-brand-200 ${r.isActive ? "" : "opacity-50"}`}>
            <div className="flex items-center justify-between gap-2"><span className="font-semibold text-slate-800 dark:text-slate-100">{r.name}</span><Badge tone="slate">{r.type}</Badge></div>
            <div className="mt-1 text-[11px] text-slate-400">{r.branch}</div>
            <div className={`mt-2 text-lg font-bold tabular-nums ${r.balance < 0 ? "text-red-600" : "text-slate-900 dark:text-white"}`}>{formatMoney(r.balance, L)}</div>
            <div className="mt-1 flex justify-between text-[11px] text-slate-500"><span>{fin(L, "inflow")}: {formatMoney(r.inflow, L)}</span><span>{fin(L, "outflow")}: {formatMoney(r.outflow, L)}</span></div>
            {canManage && enabled && <button type="button" className="btn-ghost mt-2 px-2 py-1 text-xs" onClick={(e) => { e.preventDefault(); const name = window.prompt(fin(L, "name"), r.name); if (!name) return; const activeStr = window.confirm(`${fin(L, "enabled")}? (OK = ${fin(L, "enabled")}, Cancel = ${fin(L, "disabledShort")})`); run(() => updateAccountAction(r.id, name, activeStr, r.note)); }}>{fin(L, "save")}</button>}
          </Link>
        ))}
      </div>
      {canManage && enabled && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <h3 className="mb-3 text-sm font-semibold">{fin(L, "transfer")}</h3>
            <div className="space-y-2">
              <select className="input" value={tr.from} onChange={(e) => setTr({ ...tr, from: e.target.value })}>{active.map((a) => <option key={a.id} value={a.id}>{fin(L, "from")}: {a.name} ({formatMoney(a.balance, L)})</option>)}</select>
              <select className="input" value={tr.to} onChange={(e) => setTr({ ...tr, to: e.target.value })}>{active.map((a) => <option key={a.id} value={a.id}>{fin(L, "to")}: {a.name}</option>)}</select>
              <input className="input" type="number" min={1} placeholder={fin(L, "amount")} value={tr.amount} onChange={(e) => setTr({ ...tr, amount: e.target.value })} />
              <input className="input" placeholder={fin(L, "note")} value={tr.note} onChange={(e) => setTr({ ...tr, note: e.target.value })} />
              <button type="button" className="btn-primary" disabled={pending || !tr.amount} onClick={() => run(() => transferAction({ fromAccountId: tr.from, toAccountId: tr.to, amount: Math.trunc(Number(tr.amount)), occurredAt: new Date(), note: tr.note || null, idempotencyKey: crypto.randomUUID() }))}>{fin(L, "transfer")}</button>
            </div>
          </Card>
          <Card>
            <h3 className="mb-3 text-sm font-semibold">{fin(L, "newAccount")}</h3>
            <div className="space-y-2">
              <input className="input" placeholder={fin(L, "name")} value={acc.name} onChange={(e) => setAcc({ ...acc, name: e.target.value })} />
              <select className="input" value={acc.type} onChange={(e) => setAcc({ ...acc, type: e.target.value as FinancialAccountType })}>{FINANCIAL_ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
              <select className="input" value={acc.branchId} onChange={(e) => setAcc({ ...acc, branchId: e.target.value })}><option value="">GLOBAL</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
              <input className="input" type="number" min={0} placeholder={`${fin(L, "opening")} (${fin(L, "amount")})`} value={acc.opening} onChange={(e) => setAcc({ ...acc, opening: e.target.value })} />
              <button type="button" className="btn-primary" disabled={pending || !acc.name} onClick={() => run(() => createAccountAction(acc.name, acc.type, acc.branchId || null, Math.trunc(Number(acc.opening || 0))))}>{fin(L, "save")}</button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
