"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatMoney, type Locale } from "@/lib/constants";
import { bpToPercentString } from "@/lib/finance/money";
import { Badge, Card, EmptyRow, Table } from "../../../../_components/ui";
import { fin } from "../../_i18n";
import { assignTeacherAction, createSalaryPolicyAction, createSalaryRuleAction, endAssignmentAction, endSalaryRuleAction } from "../../actions";

export interface RuleRow { id: string; scope: string; target: string; component: string; rateBp: number | null; fixedAmount: number | null; effectiveFrom: string; effectiveTo: string | null; legacy: boolean }
export interface PolicyRow { id: string; name: string; version: number; branchId: string | null; salaryBaseMode: string; attendanceMode: string; requireConfirmedAttendance: boolean; includeArchivedStudents: boolean; includeFrozenStudents: boolean; includeZeroAmounts: boolean; effectiveFrom: string; effectiveTo: string | null; noLessonsMode: string; assignmentSplitMode: string; attendanceCountedStatuses: string[] }
export interface Opt { id: string; name: string }

const SCOPES = ["GLOBAL", "BRANCH", "COURSE", "GROUP", "TEACHER", "STUDENT", "ASSIGNMENT"] as const;

export interface AssignmentRow { id: string; group: string; teacher: string; role: string; source: string; from: string; rule: string | null }

export default function SalarySettingsView({ locale: L, enabled, rules, policies, opts, branches, assignments, nextMonth }: { locale: Locale; enabled: boolean; rules: RuleRow[]; policies: PolicyRow[]; opts: Record<string, Opt[]>; branches: Opt[]; assignments: AssignmentRow[]; nextMonth: string }) {
  const [asg, setAsg] = useState({ groupId: "", teacherId: "", role: "MAIN", from: nextMonth, ruleId: "", replaceMain: true });
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [rule, setRule] = useState({ scope: "GLOBAL", targetId: "", component: "PERCENT", ratePercent: "40", fixedAmount: "", effectiveFrom: nextMonth, note: "" });
  const [policy, setPolicy] = useState({ name: "Standart", branchId: "", effectiveFrom: nextMonth, salaryBaseMode: "REAL_PAID_AMOUNT", attendanceMode: "NONE", requireConfirmedAttendance: false, includeArchivedStudents: true, includeFrozenStudents: true, includeZeroAmounts: false });
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) => start(async () => { const r = await fn(); setMsg(r.ok ? fin(L, "done") : r.message ?? fin(L, "error")); router.refresh(); });
  const active = rules.filter((r) => !r.effectiveTo || r.effectiveTo > nextMonth);
  const defaultRule = active.find((r) => r.scope === "GLOBAL" && r.component === "PERCENT");
  const conflicts = active.filter((r) => active.some((o) => o !== r && o.scope === r.scope && o.target === r.target && o.component === r.component));

  return (
    <div className="space-y-5">
      {msg && <p className="text-xs text-slate-500">{msg}</p>}
      {/* 2. Standart qoida */}
      <Card>
        <h3 className="mb-1 text-sm font-semibold">{fin(L, "rule")} — GLOBAL</h3>
        <p className="mb-3 text-xs text-slate-500">Barcha o'qituvchilar uchun standart qoida. {defaultRule ? `${bpToPercentString(defaultRule.rateBp ?? 0)} (${defaultRule.effectiveFrom} dan)` : "—"}</p>
        {conflicts.length > 0 && <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">⚠ Bir xil qamrov/nishon uchun bir nechta faol qoida: {conflicts.map((c) => `${c.scope}:${c.target}`).join(", ")} — eng yangi effectiveFrom yutadi.</div>}
        {/* 3. Maxsus qoida yaratish */}
        {enabled && (
          <div className="grid gap-2 md:grid-cols-6">
            <select className="input" value={rule.scope} onChange={(e) => setRule({ ...rule, scope: e.target.value, targetId: "" })}>{SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
            {rule.scope !== "GLOBAL" && (rule.scope === "STUDENT" ? <input className="input" placeholder="Student ID" value={rule.targetId} onChange={(e) => setRule({ ...rule, targetId: e.target.value })} /> : (
              <select className="input" value={rule.targetId} onChange={(e) => setRule({ ...rule, targetId: e.target.value })}><option value="">{fin(L, "target")}</option>{(opts[rule.scope] ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
            ))}
            <select className="input" value={rule.component} onChange={(e) => setRule({ ...rule, component: e.target.value })}><option value="PERCENT">{fin(L, "percent")}</option><option value="FIXED">{fin(L, "fixed")}</option></select>
            {rule.component === "PERCENT" ? <input className="input" type="number" min={0} max={100} step={0.5} value={rule.ratePercent} onChange={(e) => setRule({ ...rule, ratePercent: e.target.value })} /> : <input className="input" type="number" min={0} step={1000} placeholder={fin(L, "fixed")} value={rule.fixedAmount} onChange={(e) => setRule({ ...rule, fixedAmount: e.target.value })} />}
            <input className="input" type="month" value={rule.effectiveFrom} onChange={(e) => setRule({ ...rule, effectiveFrom: e.target.value })} />
            <button type="button" className="btn-primary" disabled={pending} onClick={() => run(() => createSalaryRuleAction({ scope: rule.scope as never, targetId: rule.targetId || null, targetName: (opts[rule.scope] ?? []).find((o) => o.id === rule.targetId)?.name ?? null, component: rule.component as "PERCENT" | "FIXED", ratePercent: Number(rule.ratePercent), fixedAmount: rule.fixedAmount ? Math.trunc(Number(rule.fixedAmount)) : undefined, effectiveFrom: rule.effectiveFrom, note: rule.note || null }))}>{fin(L, "save")}</button>
          </div>
        )}
      </Card>
      {/* Qoidalar ro'yxati */}
      <Card padded={false}>
        <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800"><h3 className="text-sm font-semibold">{fin(L, "rule")} ({rules.length})</h3></div>
        <Table head={<tr><th className="px-4 py-3 text-left">{fin(L, "scope")}</th><th className="px-3 py-3 text-left">{fin(L, "target")}</th><th className="px-3 py-3 text-left">{fin(L, "type")}</th><th className="px-3 py-3 text-right">{fin(L, "rate")}</th><th className="px-3 py-3 text-left">{fin(L, "effectiveFrom")}</th><th className="px-3 py-3 text-right">{fin(L, "actions")}</th></tr>}>
          {rules.length === 0 ? <EmptyRow colSpan={6} text={fin(L, "empty")} /> : rules.map((r) => (
            <tr key={r.id} className={`text-sm ${r.effectiveTo && r.effectiveTo <= nextMonth ? "opacity-50" : ""}`}>
              <td className="px-4 py-2.5"><Badge tone={r.scope === "GLOBAL" ? "brand" : "slate"}>{r.scope}</Badge>{r.legacy && <span className="ml-1 text-[11px] text-slate-400">legacy</span>}</td>
              <td className="px-3 py-2.5">{r.target}</td>
              <td className="px-3 py-2.5">{r.component}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{r.component === "PERCENT" ? bpToPercentString(r.rateBp ?? 0) : formatMoney(r.fixedAmount ?? 0, L)}</td>
              <td className="px-3 py-2.5 text-slate-500">{r.effectiveFrom}{r.effectiveTo ? ` → ${r.effectiveTo}` : ""}</td>
              <td className="px-3 py-2.5 text-right">{enabled && !r.effectiveTo && <button type="button" className="btn-ghost px-2 py-1 text-xs" disabled={pending} onClick={() => { const to = window.prompt(`${fin(L, "effectiveFrom")} (YYYY-MM, yopilish oyi)`, nextMonth); const reason = to ? window.prompt(fin(L, "reason")) ?? "" : ""; if (to && reason.trim().length >= 3) run(() => endSalaryRuleAction(r.id, to, reason)); }}>{fin(L, "close")}</button>}</td>
            </tr>
          ))}
        </Table>
      </Card>
      {/* Tayinlashlar: guruh → o'qituvchi (MAIN/ASSISTANT), sana, yordamchi qoidasi */}
      <Card>
        <h3 className="mb-2 text-sm font-semibold">{fin(L, "assignments")}</h3>
        <div className="grid gap-2 md:grid-cols-6">
          <select className="input" value={asg.groupId} onChange={(e) => setAsg({ ...asg, groupId: e.target.value })}><option value="">{fin(L, "group")}</option>{(opts.GROUP ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
          <select className="input" value={asg.teacherId} onChange={(e) => setAsg({ ...asg, teacherId: e.target.value })}><option value="">{fin(L, "teacher")}</option>{(opts.TEACHER ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
          <select className="input" value={asg.role} onChange={(e) => setAsg({ ...asg, role: e.target.value })}><option value="MAIN">MAIN</option><option value="ASSISTANT">ASSISTANT</option></select>
          <input className="input" type="month" value={asg.from} onChange={(e) => setAsg({ ...asg, from: e.target.value })} />
          <select className="input" value={asg.ruleId} onChange={(e) => setAsg({ ...asg, ruleId: e.target.value })}><option value="">{fin(L, "rule")}: —</option>{rules.filter((r) => r.scope === "ASSIGNMENT" && !r.effectiveTo).map((r) => <option key={r.id} value={r.id}>{r.target} · {r.rateBp !== null ? `${r.rateBp / 100}%` : r.fixedAmount}</option>)}</select>
          <button type="button" className="btn-primary" disabled={pending || !enabled || !asg.groupId || !asg.teacherId} onClick={() => run(() => assignTeacherAction(asg.groupId, asg.teacherId, asg.role as "MAIN" | "ASSISTANT", asg.from, asg.ruleId || null, asg.replaceMain))}>{fin(L, "save")}</button>
        </div>
        <label className="mt-2 flex items-center gap-2 text-xs text-slate-500"><input type="checkbox" checked={asg.replaceMain} onChange={(e) => setAsg({ ...asg, replaceMain: e.target.checked })} /> MAIN: oldingi asosiy o'qituvchini almashtirish (belgilanmasa — ikki MAIN → NEEDS_REVIEW)</label>
        <ul className="mt-3 space-y-1 text-sm">
          {assignments.length === 0 && <li className="text-slate-400">{fin(L, "empty")}</li>}
          {assignments.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>{a.group} · {a.teacher} · <Badge tone={a.role === "MAIN" ? "brand" : "slate"}>{a.role}</Badge> · {a.from} → … · <span className="text-xs text-slate-500">{a.source}{a.rule ? ` · ${a.rule}` : ""}</span></span>
              {enabled && <button type="button" className="btn-ghost px-2 py-1 text-xs" disabled={pending} onClick={() => { const to = window.prompt(`${fin(L, "end")} (YYYY-MM)`, nextMonth) ?? ""; const reason = to ? window.prompt(fin(L, "reason")) ?? "" : ""; if (to && reason.trim().length >= 3) run(() => endAssignmentAction(a.id, to, reason)); }}>{fin(L, "end")}</button>}
            </li>
          ))}
        </ul>
      </Card>

      {/* 1/4/5. Umumiy sozlamalar — policy versiyasi */}
      <Card>
        <h3 className="mb-3 text-sm font-semibold">{fin(L, "policy")} — {fin(L, "version")}</h3>
        {enabled && (
          <div className="grid gap-2 md:grid-cols-4">
            <input className="input" placeholder={fin(L, "name")} value={policy.name} onChange={(e) => setPolicy({ ...policy, name: e.target.value })} />
            <select className="input" value={policy.branchId} onChange={(e) => setPolicy({ ...policy, branchId: e.target.value })}><option value="">GLOBAL</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
            <input className="input" type="month" value={policy.effectiveFrom} onChange={(e) => setPolicy({ ...policy, effectiveFrom: e.target.value })} />
            <select className="input" value={policy.salaryBaseMode} onChange={(e) => setPolicy({ ...policy, salaryBaseMode: e.target.value })}><option value="REAL_PAID_AMOUNT">REAL_PAID_AMOUNT (chegirma hisobga olinadi)</option><option value="FULL_PRICE_EQUIVALENT">FULL_PRICE_EQUIVALENT (chegirmani markaz ko'taradi)</option></select>
            <select className="input" value={policy.attendanceMode} onChange={(e) => setPolicy({ ...policy, attendanceMode: e.target.value })}><option value="NONE">Davomat: NONE</option><option value="PRESENT_RATIO">Davomat: PRESENT_RATIO</option></select>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={policy.requireConfirmedAttendance} onChange={(e) => setPolicy({ ...policy, requireConfirmedAttendance: e.target.checked })} />Faqat ustoz tasdiqlagan davomat</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={policy.includeArchivedStudents} onChange={(e) => setPolicy({ ...policy, includeArchivedStudents: e.target.checked })} />Arxivlangan o'quvchilarni hisoblash</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={policy.includeFrozenStudents} onChange={(e) => setPolicy({ ...policy, includeFrozenStudents: e.target.checked })} />Muzlatilgan o'quvchilarni hisoblash</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!policy.includeZeroAmounts} onChange={(e) => setPolicy({ ...policy, includeZeroAmounts: !e.target.checked })} />0 summali natijalarni yashirish</label>
            <p className="text-xs text-slate-500 md:col-span-3">Dars yozuvi bo'lmagan oy → NEEDS_REVIEW (avtomatik to'liq maosh yo'q). Oy o'rtasida o'qituvchi almashsa → NEEDS_REVIEW. Sinov o'quvchi tushunchasi tizimda yo'q.</p>
            <button type="button" className="btn-primary" disabled={pending} onClick={() => run(() => createSalaryPolicyAction({ ...policy, branchId: policy.branchId || null }))}>{fin(L, "save")}</button>
          </div>
        )}
        {/* 7. Versiya tarixi */}
        <div className="mt-4">
          <Table head={<tr><th className="px-4 py-3 text-left">{fin(L, "name")}</th><th className="px-3 py-3 text-left">{fin(L, "version")}</th><th className="px-3 py-3 text-left">{fin(L, "base")}</th><th className="px-3 py-3 text-left">Davomat</th><th className="px-3 py-3 text-left">{fin(L, "effectiveFrom")}</th></tr>}>
            {policies.length === 0 ? <EmptyRow colSpan={5} text={fin(L, "empty")} /> : policies.map((p) => (
              <tr key={p.id} className={`text-sm ${p.effectiveTo ? "opacity-60" : ""}`}>
                <td className="px-4 py-2.5">{p.name}{p.branchId ? "" : " (GLOBAL)"}</td><td className="px-3 py-2.5">v{p.version}</td><td className="px-3 py-2.5">{p.salaryBaseMode}</td>
                <td className="px-3 py-2.5">{p.attendanceMode}{p.requireConfirmedAttendance ? " · confirmed" : ""} · {p.includeArchivedStudents ? "arch✓" : "arch✗"} {p.includeFrozenStudents ? "frozen✓" : "frozen✗"}</td>
                <td className="px-3 py-2.5 text-slate-500">{p.effectiveFrom}{p.effectiveTo ? ` → ${p.effectiveTo}` : ""}</td>
              </tr>
            ))}
          </Table>
        </div>
      </Card>
    </div>
  );
}
