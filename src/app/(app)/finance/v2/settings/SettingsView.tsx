"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/constants";
import { Badge, Card } from "../../../_components/ui";
import { fin } from "../_i18n";
import { lockFinancePeriodAction, setAccountMap, setDefaultFeeAction, setFinanceV2Enabled, unlockFinancePeriodAction } from "../actions";

interface Lock { id: string; period: string; branchId: string | null; isLocked: boolean; reason: string; by: string; reopenReason: string | null }

export default function SettingsView({ locale: L, enabled, isDirector, canReopen, canRules, defaultFees, month, branches, accountMap, locks }: { locale: Locale; enabled: boolean; isDirector: boolean; canReopen: boolean; canRules: boolean; defaultFees: { global: number | null; byBranch: Record<string, number | null> }; month: string; branches: { id: string; name: string }[]; accountMap: string; locks: Lock[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [lock, setLock] = useState({ ym: month, branchId: "", reason: "" });
  const [map, setMap] = useState(accountMap);
  const [fees, setFees] = useState<Record<string, string>>({ global: defaultFees.global ? String(defaultFees.global) : "", ...Object.fromEntries(Object.entries(defaultFees.byBranch).map(([k, v]) => [k, v ? String(v) : ""])) });
  const saveFee = (branchId: string | null) => { const raw = fees[branchId ?? "global"]?.replace(/\s/g, "") ?? ""; const n = raw ? Number(raw) : null; if (n !== null && (!Number.isInteger(n) || n <= 0)) { setMsg(fin(L, "error")); return; } run(() => setDefaultFeeAction(branchId, n)); };
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) => start(async () => { const r = await fn(); setMsg(r.ok ? fin(L, "done") : r.message ?? fin(L, "error")); router.refresh(); });
  const name = (id: string | null) => (id ? branches.find((b) => b.id === id)?.name ?? id : "GLOBAL");
  return (
    <div className="space-y-4">
      {msg && <p className="text-xs text-slate-500">{msg}</p>}
      {isDirector && (
        <Card>
          <h3 className="mb-2 text-sm font-semibold">Finance V2 — feature flag</h3>
          <p className="mb-3 text-xs text-slate-500">O'chiq bo'lsa mavjud (legacy) moliya oqimi ishlaydi; yoqilsa to'lov/xarajat/maosh V2 dvigatelidan o'tadi. Cutover: 2026-10-01.</p>
          <button type="button" className={enabled ? "btn-ghost" : "btn-primary"} disabled={pending} onClick={() => { if (window.confirm(fin(L, "confirm"))) run(() => setFinanceV2Enabled(!enabled)); }}>{enabled ? fin(L, "disabledShort") : fin(L, "enabled")}</button>
        </Card>
      )}
      <Card>
        <h3 className="mb-1 text-sm font-semibold">{fin(L, "defaultFee")}</h3>
        <p className="mb-3 text-xs text-slate-500">{fin(L, "feeSource")}: {fin(L, "agreedPrice")} → {fin(L, "group")} → kurs → filial → global. Bo'sh = standart narx yo'q (charge yaratilmaydi).</p>
        <div className="grid gap-2 md:grid-cols-3">
          {[{ id: null as string | null, name: "GLOBAL" }, ...branches.map((b) => ({ id: b.id as string | null, name: b.name }))].map((b) => (
            <div key={b.id ?? "global"} className="flex items-center gap-2">
              <span className="w-28 truncate text-sm">{b.name}</span>
              <input className="input" inputMode="numeric" placeholder="so'm/oy" value={fees[b.id ?? "global"] ?? ""} onChange={(e) => setFees({ ...fees, [b.id ?? "global"]: e.target.value })} />
              <button type="button" className="btn-primary px-2 py-1 text-xs" disabled={pending} onClick={() => saveFee(b.id)}>{fin(L, "save")}</button>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <h3 className="mb-2 text-sm font-semibold">{fin(L, "period")} — lock</h3>
        <div className="grid gap-2 md:grid-cols-4">
          <input className="input" type="month" value={lock.ym} onChange={(e) => setLock({ ...lock, ym: e.target.value })} />
          <select className="input" value={lock.branchId} onChange={(e) => setLock({ ...lock, branchId: e.target.value })}><option value="">GLOBAL</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
          <input className="input" placeholder={fin(L, "reason")} value={lock.reason} onChange={(e) => setLock({ ...lock, reason: e.target.value })} />
          <button type="button" className="btn-primary" disabled={pending || !enabled || lock.reason.trim().length < 3} onClick={() => run(() => lockFinancePeriodAction(lock.ym, lock.branchId || null, lock.reason))}>{fin(L, "close")}</button>
        </div>
        <ul className="mt-3 space-y-1 text-sm">
          {locks.map((l) => <li key={l.id} className="flex flex-wrap items-center justify-between gap-2"><span>{l.period} · {name(l.branchId)} · <Badge tone={l.isLocked ? "red" : "slate"}>{l.isLocked ? "LOCKED" : "OPEN"}</Badge> <span className="text-xs text-slate-500">{l.reason} — {l.by}{l.reopenReason ? ` · reopen: ${l.reopenReason}` : ""}</span></span>
            {l.isLocked && canReopen && enabled && <button type="button" className="btn-ghost px-2 py-1 text-xs" disabled={pending} onClick={() => { const reason = window.prompt(fin(L, "reason")) ?? ""; if (reason.trim().length >= 3) run(() => unlockFinancePeriodAction(l.period, l.branchId, reason)); }}>{fin(L, "reopen")}</button>}</li>)}
        </ul>
      </Card>
      {canRules && (
        <Card>
          <h3 className="mb-2 text-sm font-semibold">{fin(L, "method")} → {fin(L, "account")} (JSON)</h3>
          <textarea className="input font-mono text-xs" rows={8} value={map} onChange={(e) => setMap(e.target.value)} />
          <button type="button" className="btn-primary mt-2" disabled={pending || !enabled} onClick={() => { try { JSON.parse(map); run(() => setAccountMap(map)); } catch { setMsg("JSON noto'g'ri"); } }}>{fin(L, "save")}</button>
        </Card>
      )}
    </div>
  );
}
