"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatMoney, type Locale } from "@/lib/constants";
import { Badge, Card, EmptyRow, Table } from "../../../_components/ui";
import { fin, fmtDate } from "../_i18n";
import { acceptPaymentAction, refundAction, reversePaymentAction } from "../actions";

export interface PaymentRow { id: string; student: string; amount: number; method: string; account: string; receivedAt: string; status: string; docNumber: string | null; allocated: number; refunded: number; unallocated: number }
export interface StudentOpt { id: string; name: string; phone: string | null }
export interface AccountOpt { id: string; name: string; type: string }

const nowLocal = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export default function PaymentsView({ locale: L, rows, students, accounts, methods, canCreate, canCancel, canCorrect }: { locale: Locale; rows: PaymentRow[]; students: StudentOpt[]; accounts: AccountOpt[]; methods: string[]; canCreate: boolean; canCancel: boolean; canCorrect: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [key, setKey] = useState(() => crypto.randomUUID()); // double-click himoyasi: bitta forma = bitta kalit
  const [form, setForm] = useState({ studentId: "", amount: "", method: methods[0] ?? "CASH", accountId: "", receivedAt: nowLocal(), purpose: "Kurs to'lovi", note: "" });
  const [q, setQ] = useState("");
  const filtered = useMemo(() => students.filter((s) => s.name.toLowerCase().includes(q.toLowerCase()) || (s.phone ?? "").includes(q)).slice(0, 50), [students, q]);

  const submit = () => {
    if (!form.studentId || !form.amount) { setMsg({ ok: false, text: fin(L, "error") }); return; }
    start(async () => {
      const r = await acceptPaymentAction({ studentId: form.studentId, amount: Math.trunc(Number(form.amount)), method: form.method, receivedAt: new Date(form.receivedAt), purpose: form.purpose, note: form.note || null, financialAccountId: form.accountId || undefined, idempotencyKey: key });
      if (r.ok) {
        setMsg({ ok: true, text: `${fin(L, "done")}: ${fin(L, "allocated")} ${formatMoney(r.data!.allocated, L)}, ${fin(L, "credit")} ${formatMoney(r.data!.credit, L)}${r.data!.docNumber ? ` · № ${r.data!.docNumber}` : ""}` });
        setForm((f) => ({ ...f, amount: "", note: "" }));
        setKey(crypto.randomUUID());
        router.refresh();
      } else setMsg({ ok: false, text: r.message });
    });
  };

  const refund = (row: PaymentRow) => {
    const amountStr = window.prompt(`${fin(L, "refund")} — ${fin(L, "amount")} (max ${row.amount - row.refunded})`, String(row.amount - row.refunded));
    if (!amountStr) return;
    const reason = window.prompt(fin(L, "reason")) ?? "";
    if (reason.trim().length < 3) return;
    start(async () => {
      const r = await refundAction({ paymentId: row.id, amount: Math.trunc(Number(amountStr)), reason, refundedAt: new Date(), idempotencyKey: crypto.randomUUID() });
      setMsg(r.ok ? { ok: true, text: `${fin(L, "done")} (${fin(L, "allocated")} −${formatMoney(r.data!.reversed, L)})` } : { ok: false, text: r.message });
      router.refresh();
    });
  };

  const reverse = (row: PaymentRow) => {
    const reason = window.prompt(`${fin(L, "correction")} — ${fin(L, "reason")}`) ?? "";
    if (reason.trim().length < 3) return;
    const newAmount = window.prompt(`${fin(L, "amount")} (to'g'ri summa; bo'sh = faqat bekor qilish)`, String(row.amount));
    start(async () => {
      const replacement = newAmount && Number(newAmount) > 0 ? { amount: Math.trunc(Number(newAmount)), method: row.method, receivedAt: new Date(row.receivedAt), purpose: "Tuzatilgan to'lov", idempotencyKey: "x" } : null;
      const r = await reversePaymentAction(row.id, reason, crypto.randomUUID(), replacement);
      setMsg(r.ok ? { ok: true, text: fin(L, "done") } : { ok: false, text: r.message });
      router.refresh();
    });
  };

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      {canCreate && (
        <Card className="xl:col-span-1">
          <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">{fin(L, "acceptPayment")}</h3>
          <div className="space-y-2.5">
            <input className="input" placeholder={fin(L, "student")} value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="input" value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })}>
              <option value="">—</option>
              {filtered.map((s) => <option key={s.id} value={s.id}>{s.name}{s.phone ? ` · ${s.phone}` : ""}</option>)}
            </select>
            <input className="input" type="number" min={1} step={1} placeholder={fin(L, "amount")} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <select className="input" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>{methods.map((m) => <option key={m} value={m}>{m}</option>)}</select>
              <select className="input" value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })}>
                <option value="">{fin(L, "account")}: auto</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <label className="block text-xs text-slate-500">{fin(L, "receivedAt")}<input className="input mt-1" type="datetime-local" value={form.receivedAt} onChange={(e) => setForm({ ...form, receivedAt: e.target.value })} /></label>
            <input className="input" placeholder={fin(L, "purpose")} value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
            <input className="input" placeholder={fin(L, "note")} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            <button type="button" className="btn-primary w-full" disabled={pending} onClick={submit}>{fin(L, "acceptPayment")}</button>
            {msg && <p className={`text-xs ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</p>}
          </div>
        </Card>
      )}
      <Card padded={false} className={canCreate ? "xl:col-span-2" : "xl:col-span-3"}>
        <Table head={<tr><th className="px-4 py-3 text-left">{fin(L, "student")}</th><th className="px-3 py-3 text-right">{fin(L, "amount")}</th><th className="px-3 py-3 text-right">{fin(L, "allocated")}</th><th className="px-3 py-3 text-right">{fin(L, "credit")}</th><th className="px-3 py-3 text-left">{fin(L, "method")}</th><th className="px-3 py-3 text-left">{fin(L, "receivedAt")}</th><th className="px-3 py-3 text-left">{fin(L, "status")}</th><th className="px-3 py-3 text-right">{fin(L, "actions")}</th></tr>}>
          {rows.length === 0 ? <EmptyRow colSpan={8} text={fin(L, "empty")} /> : rows.map((r) => (
            <tr key={r.id} className="text-sm">
              <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-100">{r.student}<div className="text-[11px] text-slate-400">{r.docNumber ?? ""} · {r.account}</div></td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatMoney(r.amount, L)}{r.refunded > 0 && <div className="text-[11px] text-red-500">−{formatMoney(r.refunded, L)}</div>}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatMoney(r.allocated, L)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-amber-600">{r.unallocated > 0 ? formatMoney(r.unallocated, L) : "—"}</td>
              <td className="px-3 py-2.5"><Badge tone="slate">{r.method}</Badge></td>
              <td className="px-3 py-2.5 text-slate-500">{fmtDate(L, r.receivedAt, true)}</td>
              <td className="px-3 py-2.5"><Badge tone={r.status === "PAID" ? "green" : r.status === "REVERSED" ? "red" : "slate"}>{r.status}</Badge></td>
              <td className="px-3 py-2.5 text-right">
                {r.status === "PAID" && (canCancel || canCorrect) && (
                  <div className="flex justify-end gap-1">
                    {canCancel && r.amount - r.refunded > 0 && <button type="button" className="btn-ghost px-2 py-1 text-xs" disabled={pending} onClick={() => refund(r)}>{fin(L, "refund")}</button>}
                    {canCorrect && <button type="button" className="btn-ghost px-2 py-1 text-xs" disabled={pending} onClick={() => reverse(r)}>{fin(L, "correction")}</button>}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
