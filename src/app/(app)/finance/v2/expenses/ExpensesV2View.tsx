"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatMoney, type Locale } from "@/lib/constants";
import { Badge, Card, EmptyRow, Table } from "../../../_components/ui";
import { fin, fmtDate } from "../_i18n";
import { createExpenseAction, reverseExpenseAction } from "../actions";

interface Row { id: string; name: string; amount: number; date: string; method: string; category: string | null; account: string | null; recipient: string | null; status: string; posted: boolean; reversal: boolean; note: string | null }
const todayLocal = () => new Date().toISOString().slice(0, 10);

export default function ExpensesV2View({ locale: L, canCreate, canCorrect, categories, accounts, methods, rows }: { locale: Locale; canCreate: boolean; canCorrect: boolean; categories: { id: string; name: string }[]; accounts: { id: string; name: string }[]; methods: string[]; rows: Row[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [f, setF] = useState({ name: "", amount: "", date: todayLocal(), method: "CASH", categoryId: "", accountId: "", recipient: "", note: "" });
  const submit = () => start(async () => {
    const r = await createExpenseAction({ name: f.name, amount: Math.trunc(Number(f.amount)), date: new Date(f.date), method: f.method, categoryId: f.categoryId || null, financialAccountId: f.accountId || undefined, recipient: f.recipient || null, note: f.note || null, idempotencyKey: key });
    setMsg(r.ok ? fin(L, "done") : r.message);
    if (r.ok) { setF({ ...f, name: "", amount: "", recipient: "", note: "" }); setKey(crypto.randomUUID()); }
    router.refresh();
  });
  const reverse = (row: Row) => { const reason = window.prompt(`${fin(L, "correction")} — ${fin(L, "reason")}`) ?? ""; if (reason.trim().length < 3) return; start(async () => { const r = await reverseExpenseAction(row.id, reason, crypto.randomUUID()); setMsg(r.ok ? fin(L, "done") : r.message); router.refresh(); }); };
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      {canCreate && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold">{fin(L, "addExpense")}</h3>
          <div className="space-y-2">
            <input className="input" placeholder={fin(L, "name")} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            <input className="input" type="number" min={1} placeholder={fin(L, "amount")} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
            <input className="input" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <select className="input" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>{methods.map((m) => <option key={m} value={m}>{m}</option>)}</select>
              <select className="input" value={f.accountId} onChange={(e) => setF({ ...f, accountId: e.target.value })}><option value="">{fin(L, "account")}: auto</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
            </div>
            <select className="input" value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}><option value="">{fin(L, "category")}</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <input className="input" placeholder={fin(L, "recipient")} value={f.recipient} onChange={(e) => setF({ ...f, recipient: e.target.value })} />
            <input className="input" placeholder={fin(L, "note")} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
            <button type="button" className="btn-primary w-full" disabled={pending || !f.name || !f.amount} onClick={submit}>{fin(L, "save")}</button>
            {msg && <p className="text-xs text-slate-500">{msg}</p>}
          </div>
        </Card>
      )}
      <Card padded={false} className={canCreate ? "xl:col-span-2" : "xl:col-span-3"}>
        <Table head={<tr><th className="px-4 py-3 text-left">{fin(L, "name")}</th><th className="px-3 py-3 text-right">{fin(L, "amount")}</th><th className="px-3 py-3 text-left">{fin(L, "date")}</th><th className="px-3 py-3 text-left">{fin(L, "category")}</th><th className="px-3 py-3 text-left">{fin(L, "account")}</th><th className="px-3 py-3 text-left">{fin(L, "status")}</th><th className="px-3 py-3 text-right">{fin(L, "actions")}</th></tr>}>
          {rows.length === 0 ? <EmptyRow colSpan={7} text={fin(L, "empty")} /> : rows.map((r) => (
            <tr key={r.id} className={`text-sm ${r.status === "REVERSED" ? "opacity-50 line-through" : ""}`}>
              <td className="px-4 py-2.5 font-medium">{r.name}<div className="text-[11px] text-slate-400">{r.recipient ?? ""} {r.note ? `· ${r.note}` : ""}</div></td>
              <td className={`px-3 py-2.5 text-right tabular-nums ${r.reversal ? "text-emerald-600" : ""}`}>{r.reversal ? "+" : "−"}{formatMoney(r.amount, L)}</td>
              <td className="px-3 py-2.5 text-slate-500">{fmtDate(L, r.date)}</td>
              <td className="px-3 py-2.5">{r.category ?? "—"}</td>
              <td className="px-3 py-2.5 text-slate-500">{r.account ?? (r.posted ? "—" : "legacy")}</td>
              <td className="px-3 py-2.5"><Badge tone={r.status === "REVERSED" ? "red" : r.reversal ? "purple" : "green"}>{r.reversal ? "REVERSAL" : r.status}</Badge></td>
              <td className="px-3 py-2.5 text-right">{canCorrect && r.posted && r.status === "ACTIVE" && !r.reversal && <button type="button" className="btn-ghost px-2 py-1 text-xs" disabled={pending} onClick={() => reverse(r)}>{fin(L, "correction")}</button>}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
