"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatMoney, type Locale } from "@/lib/constants";
import { Badge, Card, EmptyRow, Table } from "../../../../_components/ui";
import { fin, fmtDate } from "../../_i18n";
import { acceptPaymentAction, adjustChargeAction, cancelChargeAction, createDiscountAction, endDiscountAction, manualDebtAction, refundAction, replaceChargeAction, setAgreedPriceAction, setMembershipStartAction } from "../../actions";

export interface ChargeRow { id: string; month: string; group: string | null; kind: string; status: string; original: number; discount: number; final: number; allocated: number; remaining: number; feeSource: string | null; replacesChargeId: string | null; adjustsChargeId: string | null; cancelledAt: string | null }
export interface PaymentRow { id: string; receivedAt: string; amount: number; method: string; account: string | null; status: string; docNumber: string | null; allocated: number; refunded: number; unallocated: number }
export interface DiscountRow { id: string; type: string; value: number; group: string | null; from: string; to: string | null; isActive: boolean; reason: string }
export interface EarningRow { id: string; teacher: string; type: string; amount: number; rateBp: number | null; serviceMonth: string | null; earningMonth: string; status: string; reviewReason: string | null }

const nowLocal = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const ymNow = () => new Date().toISOString().slice(0, 7);
const tone = (s: string) => (s === "PAID" || s === "POSTED" ? "green" : s === "OPEN" || s === "NEEDS_REVIEW" ? "amber" : s === "CANCELLED" || s === "REJECTED" || s === "REVERSED" ? "red" : "slate");

export default function StudentFinanceView({ locale: L, enabled, studentId, groups, accounts, methods, charges, payments, discounts, earnings, perms }: {
  locale: Locale; enabled: boolean; studentId: string; groups: { id: string; name: string }[]; accounts: { id: string; name: string }[]; methods: string[];
  charges: ChargeRow[]; payments: PaymentRow[]; discounts: DiscountRow[]; earnings: EarningRow[]; perms: { pay: boolean; correct: boolean; refund: boolean; salary: boolean };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pay, setPay] = useState({ amount: "", method: methods[0] ?? "CASH", accountId: "", receivedAt: nowLocal(), purpose: "Kurs to'lovi" });
  const [price, setPrice] = useState({ amount: "", from: ymNow(), groupId: "", reason: "Kelishilgan narx" });
  const [debt, setDebt] = useState({ amount: "", month: ymNow(), note: "" });
  const [mstart, setMstart] = useState({ groupId: groups[0]?.id ?? "", ym: ymNow() });
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>, okText?: string) => start(async () => {
    const r = await fn();
    setMsg(r.ok ? { ok: true, text: okText ?? fin(L, "done") } : { ok: false, text: r.message ?? fin(L, "error") });
    if (r.ok) setKey(crypto.randomUUID());
    router.refresh();
  });
  const ask = (label: string, def = "") => { const v = window.prompt(label, def); return v === null ? null : v.trim(); };
  const money = (v: string) => Math.trunc(Number(v.replace(/\s/g, "")));
  const disabled = pending || !enabled;

  return (
    <div className="space-y-4">
      {msg && <p className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`} role="status">{msg.text}</p>}
      {!enabled && <p className="text-xs text-amber-700">{fin(L, "disabledShort")}</p>}

      {perms.pay && (
        <Card>
          <h3 className="mb-2 text-sm font-semibold">{fin(L, "acceptPayment")}</h3>
          <div className="grid gap-2 md:grid-cols-5">
            <input className="input" inputMode="numeric" placeholder={fin(L, "amount")} value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
            <select className="input" value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>{methods.map((m) => <option key={m} value={m}>{m}</option>)}</select>
            <select className="input" value={pay.accountId} onChange={(e) => setPay({ ...pay, accountId: e.target.value })}><option value="">{fin(L, "account")}: auto</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
            <input className="input" type="datetime-local" value={pay.receivedAt} onChange={(e) => setPay({ ...pay, receivedAt: e.target.value })} />
            <button type="button" className="btn-primary" disabled={disabled || !pay.amount} onClick={() => { if (!window.confirm(`${fin(L, "confirm")} ${formatMoney(money(pay.amount), L)}?`)) return; run(() => acceptPaymentAction({ studentId, amount: money(pay.amount), method: pay.method, receivedAt: new Date(pay.receivedAt), purpose: pay.purpose, financialAccountId: pay.accountId || undefined, idempotencyKey: key }), fin(L, "done")); setPay({ ...pay, amount: "" }); }}>{fin(L, "acceptPayment")}</button>
          </div>
        </Card>
      )}

      <Card padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3">
          <h3 className="text-sm font-semibold">{fin(L, "charges")}</h3>
          {perms.correct && groups.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-500">{fin(L, "membershipStart")}:</span>
              <select className="input py-1" value={mstart.groupId} onChange={(e) => setMstart({ ...mstart, groupId: e.target.value })}>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
              <input className="input py-1" type="month" value={mstart.ym} onChange={(e) => setMstart({ ...mstart, ym: e.target.value })} />
              <button type="button" className="btn-ghost px-2 py-1" disabled={disabled || !mstart.groupId} onClick={() => { const r = ask(fin(L, "reason")); if (r && r.length >= 3) run(() => setMembershipStartAction(studentId, mstart.groupId, mstart.ym, r)); }}>{fin(L, "save")}</button>
            </div>
          )}
          {perms.correct && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <input className="input py-1" inputMode="numeric" placeholder={`${fin(L, "manualDebt")}: ${fin(L, "amount")}`} value={debt.amount} onChange={(e) => setDebt({ ...debt, amount: e.target.value })} />
              <input className="input py-1" type="month" value={debt.month} onChange={(e) => setDebt({ ...debt, month: e.target.value })} />
              <input className="input py-1" placeholder={fin(L, "note")} value={debt.note} onChange={(e) => setDebt({ ...debt, note: e.target.value })} />
              <button type="button" className="btn-ghost px-2 py-1" disabled={disabled || !debt.amount} onClick={() => run(() => manualDebtAction(studentId, money(debt.amount), debt.month, debt.note))}>{fin(L, "manualDebt")}</button>
            </div>
          )}
        </div>
        <Table head={<tr><th className="px-4 py-3 text-left">{fin(L, "serviceMonth")}</th><th className="px-3 py-3 text-left">{fin(L, "group")}</th><th className="px-3 py-3 text-right">{fin(L, "original")}</th><th className="px-3 py-3 text-right">{fin(L, "discountAdd")}</th><th className="px-3 py-3 text-right">{fin(L, "amount")}</th><th className="px-3 py-3 text-right">{fin(L, "allocated")}</th><th className="px-3 py-3 text-right">{fin(L, "remaining")}</th><th className="px-3 py-3 text-left">{fin(L, "status")}</th><th className="px-3 py-3" /></tr>}>
          {charges.length === 0 ? <EmptyRow colSpan={9} text={fin(L, "empty")} /> : charges.map((c) => (
            <tr key={c.id} className={`text-sm ${c.status === "CANCELLED" ? "opacity-50" : ""}`}>
              <td className="px-4 py-2 font-medium">{c.month} <span className="text-[10px] text-slate-400">{c.kind}{c.feeSource ? ` · ${c.feeSource}` : ""}{c.replacesChargeId ? " · repl" : ""}{c.adjustsChargeId ? " · adj" : ""}</span></td>
              <td className="px-3 py-2">{c.group ?? "—"}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatMoney(c.original, L)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{c.discount ? `−${formatMoney(c.discount, L)}` : "—"}</td>
              <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatMoney(c.final, L)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatMoney(c.allocated, L)}</td>
              <td className={`px-3 py-2 text-right tabular-nums ${c.remaining > 0 ? "text-red-600" : ""}`}>{formatMoney(c.remaining, L)}</td>
              <td className="px-3 py-2"><Badge tone={tone(c.status)}>{c.status}</Badge></td>
              <td className="px-3 py-2 text-right">
                {perms.correct && c.status !== "CANCELLED" && (
                  <div className="flex flex-wrap justify-end gap-1">
                    {c.allocated === 0 && <button type="button" className="btn-ghost px-2 py-1 text-xs" disabled={disabled} onClick={() => { const r = ask(fin(L, "reason")); if (r && r.length >= 3) run(() => cancelChargeAction(c.id, r)); }}>{fin(L, "cancelCharge")}</button>}
                    <button type="button" className="btn-ghost px-2 py-1 text-xs" disabled={disabled} onClick={() => { const a = ask(`${fin(L, "replaceCharge")} — ${fin(L, "original")}`, String(c.original)); if (a === null) return; const d = ask(fin(L, "discountAdd"), String(c.discount)); if (d === null) return; const r = ask(fin(L, "reason")); if (r && r.length >= 3) run(() => replaceChargeAction(c.id, money(a), money(d || "0"), r)); }}>{fin(L, "replaceCharge")}</button>
                    <button type="button" className="btn-ghost px-2 py-1 text-xs" disabled={disabled} onClick={() => { const a = ask(`${fin(L, "adjustCharge")} (+)`); if (!a) return; const r = ask(fin(L, "reason")); if (r && r.length >= 3) run(() => adjustChargeAction(c.id, money(a), r)); }}>{fin(L, "adjustCharge")}</button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card padded={false}>
        <h3 className="px-4 pt-3 text-sm font-semibold">{fin(L, "payments")}</h3>
        <Table head={<tr><th className="px-4 py-3 text-left">{fin(L, "date")}</th><th className="px-3 py-3 text-right">{fin(L, "amount")}</th><th className="px-3 py-3 text-left">{fin(L, "method")}</th><th className="px-3 py-3 text-left">{fin(L, "account")}</th><th className="px-3 py-3 text-right">{fin(L, "allocated")}</th><th className="px-3 py-3 text-right">{fin(L, "credit")}</th><th className="px-3 py-3 text-right">{fin(L, "refund")}</th><th className="px-3 py-3 text-left">{fin(L, "status")}</th><th className="px-3 py-3" /></tr>}>
          {payments.length === 0 ? <EmptyRow colSpan={9} text={fin(L, "empty")} /> : payments.map((p) => (
            <tr key={p.id} className="text-sm">
              <td className="px-4 py-2">{fmtDate(L, p.receivedAt, true)} <span className="text-[10px] text-slate-400">{p.docNumber ?? ""}</span></td>
              <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatMoney(p.amount, L)}</td>
              <td className="px-3 py-2">{p.method}</td>
              <td className="px-3 py-2">{p.account ?? "—"}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatMoney(p.allocated, L)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{p.unallocated ? formatMoney(p.unallocated, L) : "—"}</td>
              <td className="px-3 py-2 text-right tabular-nums text-red-600">{p.refunded ? `−${formatMoney(p.refunded, L)}` : "—"}</td>
              <td className="px-3 py-2"><Badge tone={tone(p.status)}>{p.status}</Badge></td>
              <td className="px-3 py-2 text-right">{perms.refund && p.status === "PAID" && p.amount - p.refunded > 0 && <button type="button" className="btn-ghost px-2 py-1 text-xs" disabled={disabled} onClick={() => { const a = ask(`${fin(L, "refund")} — ${fin(L, "amount")} (max ${p.amount - p.refunded})`, String(p.amount - p.refunded)); if (!a) return; const r = ask(fin(L, "reason")); if (r && r.length >= 3) run(() => refundAction({ paymentId: p.id, amount: money(a), reason: r, refundedAt: new Date(), idempotencyKey: crypto.randomUUID() })); }}>{fin(L, "refund")}</button>}</td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{fin(L, "agreedPrice")} / {fin(L, "discountAdd")}</h3>
          {perms.correct && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <input className="input py-1" inputMode="numeric" placeholder={`${fin(L, "agreedPrice")} (so'm/oy)`} value={price.amount} onChange={(e) => setPrice({ ...price, amount: e.target.value })} />
              <input className="input py-1" type="month" value={price.from} onChange={(e) => setPrice({ ...price, from: e.target.value })} />
              <select className="input py-1" value={price.groupId} onChange={(e) => setPrice({ ...price, groupId: e.target.value })}><option value="">{fin(L, "group")}: *</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
              <input className="input py-1" placeholder={fin(L, "reason")} value={price.reason} onChange={(e) => setPrice({ ...price, reason: e.target.value })} />
              <button type="button" className="btn-primary px-2 py-1" disabled={disabled || !price.amount} onClick={() => run(() => setAgreedPriceAction(studentId, money(price.amount), price.from, price.reason, price.groupId || null))}>{fin(L, "agreedPrice")}</button>
              <button type="button" className="btn-ghost px-2 py-1" disabled={disabled} onClick={() => { const pct = ask(`${fin(L, "discountAdd")} % (masalan 20)`); if (!pct) return; const r = ask(fin(L, "reason")); if (r && r.length >= 3) run(() => createDiscountAction(studentId, "PERCENT", Math.round(Number(pct) * 100), price.from, r, price.groupId || null)); }}>{fin(L, "discountAdd")} %</button>
            </div>
          )}
        </div>
        <ul className="space-y-1 text-sm">
          {discounts.length === 0 && <li className="text-slate-400">{fin(L, "empty")}</li>}
          {discounts.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2">
              <span><Badge tone={d.isActive && !d.to ? "green" : "slate"}>{d.type}</Badge> {d.type === "PERCENT" ? `${d.value / 100}%` : formatMoney(d.value, L)} · {d.group ?? "*"} · {fmtDate(L, d.from)} → {d.to ? fmtDate(L, d.to) : "…"} · <span className="text-xs text-slate-500">{d.reason}</span></span>
              {perms.correct && d.isActive && !d.to && <button type="button" className="btn-ghost px-2 py-1 text-xs" disabled={disabled} onClick={() => { const r = ask(fin(L, "reason")); if (r && r.length >= 3) run(() => endDiscountAction(d.id, r)); }}>{fin(L, "end")}</button>}
            </li>
          ))}
        </ul>
      </Card>

      {perms.salary && (
        <Card padded={false}>
          <h3 className="px-4 pt-3 text-sm font-semibold">{fin(L, "earningsOfStudent")}</h3>
          <Table head={<tr><th className="px-4 py-3 text-left">{fin(L, "teacher")}</th><th className="px-3 py-3 text-left">{fin(L, "serviceMonth")}</th><th className="px-3 py-3 text-left">{fin(L, "earningMonth")}</th><th className="px-3 py-3 text-right">%</th><th className="px-3 py-3 text-right">{fin(L, "amount")}</th><th className="px-3 py-3 text-left">{fin(L, "status")}</th></tr>}>
            {earnings.length === 0 ? <EmptyRow colSpan={6} text={fin(L, "empty")} /> : earnings.map((e) => (
              <tr key={e.id} className="text-sm">
                <td className="px-4 py-2">{e.teacher} <span className="text-[10px] text-slate-400">{e.type}</span></td>
                <td className="px-3 py-2">{e.serviceMonth ?? "—"}</td>
                <td className="px-3 py-2">{e.earningMonth}</td>
                <td className="px-3 py-2 text-right tabular-nums">{e.rateBp !== null ? `${e.rateBp / 100}%` : "—"}</td>
                <td className={`px-3 py-2 text-right tabular-nums font-semibold ${e.amount < 0 ? "text-red-600" : ""}`}>{formatMoney(e.amount, L)}</td>
                <td className="px-3 py-2"><Badge tone={tone(e.status)}>{e.status}</Badge>{e.reviewReason ? <span className="ml-1 text-[10px] text-amber-700">{e.reviewReason}</span> : null}</td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </div>
  );
}
