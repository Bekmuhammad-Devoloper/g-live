"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatMoney, type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Badge, Card, EmptyRow, Table } from "../../../_components/ui";
import { fin, fmtDate } from "../_i18n";
import { allocateHistoricalAction, leaveLegacyUnresolvedAction, markLegacyAdvanceAction, reopenLegacyReviewAction, resolveHistoricalTeacherAction } from "../actions";

export interface AllocationRow { id: string; amount: number; chargeId: string; chargeKind: string; month: string; group: string | null; earnings: { id: string; teacher: string; rateBp: number | null; amount: number; status: string }[] }
export interface ReviewRow {
  paymentId: string; studentId: string; student: string; eduStatus: string | null;
  amount: number; receivedAt: string; method: string; branch: string | null; source: string; author: string | null; createdAt: string; legacyRole: string | null; paymentStatus: string;
  classification: string; confidence: string; status: string; resolution: string | null; reason: string | null; resolvedBy: string | null; resolvedAt: string | null;
  suggestedMonth: string | null; reasons: string[]; unallocated: number; allocated: number; refunded: number;
  groups: string[]; months: string[]; teachers: string[]; memberships: string[]; audit: string[]; legacySalary: string[];
  allocations: AllocationRow[];
}
interface Props { locale: Locale; enabled: boolean; rows: ReviewRow[]; teachers: { id: string; fullName: string }[]; groups: { id: string; name: string }[]; perms: { correct: boolean; salary: boolean } }

const MIN_ADVANCE_REASON = 10;
const clsTone = (c: string) => (c === "EXACTLY_ATTRIBUTABLE" ? "green" : c === "PARTIALLY_ATTRIBUTABLE" ? "amber" : "red") as "green" | "amber" | "red";
const money = (v: string) => Math.trunc(Number(v.replace(/\s/g, "")));

export default function HistoricalReviewList({ locale: L, enabled, rows, teachers, groups, perms }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [form, setForm] = useState<{ id: string; kind: "allocate" | "teacher"; allocationId?: string } | null>(null);
  const [f, setF] = useState<Record<string, string>>({});
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) => start(async () => { const r = await fn(); setMsg(r.ok ? fin(L, "done") : (r.message ?? "xato")); if (r.ok) setForm(null); router.refresh(); });
  const ask = (label: string, min = 3): string | null => { const v = (window.prompt(label) ?? "").trim(); return v.length >= min ? v : null; };
  const canAct = enabled && perms.correct;
  const T = (uz: string, ru: string, en: string, de: string) => tr(L, { uz, ru, en, de });

  return (
    <Card padded={false}>
      <div className="overflow-x-auto">
        <Table head={<tr><th className="px-4 py-3 text-left">{fin(L, "student")}</th><th className="px-3 py-3 text-right">{fin(L, "amount")}</th><th className="px-3 py-3 text-left">{fin(L, "date")}</th><th className="px-3 py-3 text-left">{fin(L, "method")}</th><th className="px-3 py-3 text-left">{T("Asl manba", "Источник", "Original source", "Quelle")}</th><th className="px-3 py-3 text-left">{T("Ehtimoliy xizmat oyi", "Возможный месяц", "Possible service month", "Möglicher Monat")}</th><th className="px-3 py-3 text-left">{T("Ehtimoliy guruh", "Возможная группа", "Possible group", "Mögliche Gruppe")}</th><th className="px-3 py-3 text-left">{T("Ishonch / holat", "Уверенность / статус", "Confidence / status", "Vertrauen / Status")}</th><th className="px-3 py-3 text-left">{fin(L, "reason")}</th><th className="px-3 py-3" /></tr>}>
          {rows.length === 0 ? <EmptyRow colSpan={10} text={T("Ko'rib chiqish kerak bo'lgan tarixiy to'lov yo'q", "Нет исторических платежей на проверку", "No historical payments to review", "Keine historischen Zahlungen zur Prüfung")} /> : rows.map((r) => (
            <RowGroup key={r.paymentId} r={r} L={L} open={open === r.paymentId} clsTone={clsTone}>
              <div className="flex flex-wrap items-center gap-1.5">
                <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => setOpen(open === r.paymentId ? null : r.paymentId)}>{T("Dalillar", "Доказательства", "Evidence", "Nachweise")}</button>
                {canAct && r.unallocated > 0 && <button type="button" className="btn-primary px-2 py-1 text-xs" disabled={pending} onClick={() => { setForm({ id: r.paymentId, kind: "allocate" }); setF({ ym: r.suggestedMonth ?? "", amount: String(r.unallocated), groupId: "", note: "", reason: "" }); }}>{T("Tarixiy hisobga bog'lash", "Отнести к начислению", "Assign to historical charge", "Zuordnen")}</button>}
                {canAct && r.status === "NEEDS_REVIEW" && r.unallocated > 0 && <button type="button" className="btn-secondary px-2 py-1 text-xs" disabled={pending} onClick={() => { const reason = ask(T(`AVANS — faqat aniq dalil/qaror bilan (kamida ${MIN_ADVANCE_REASON} belgi). To'lov V2 kreditiga aylanadi va keyingi hisoblarga qo'llanadi. Sabab:`, `АВАНС — только с доказательством (мин. ${MIN_ADVANCE_REASON} символов). Причина:`, `ADVANCE — only with explicit evidence (min ${MIN_ADVANCE_REASON} chars). Reason:`, `VORSCHUSS — nur mit Nachweis (min. ${MIN_ADVANCE_REASON} Zeichen). Grund:`), MIN_ADVANCE_REASON); if (reason && window.confirm(fin(L, "confirm"))) run(() => markLegacyAdvanceAction(r.paymentId, reason)); }}>{T("Avans deb tasdiqlash", "Признать авансом", "Mark as advance", "Als Vorschuss")}</button>}
                {canAct && r.status === "NEEDS_REVIEW" && r.resolution !== "UNRESOLVED" && <button type="button" className="btn-ghost px-2 py-1 text-xs" disabled={pending} onClick={() => { const reason = ask(fin(L, "reason")); if (reason) run(() => leaveLegacyUnresolvedAction(r.paymentId, reason)); }}>{T("Hal qilinmagan qoldirish", "Оставить открытым", "Leave unresolved", "Offen lassen")}</button>}
                {canAct && r.status === "RESOLVED" && r.unallocated > 0 && <button type="button" className="btn-ghost px-2 py-1 text-xs" disabled={pending} onClick={() => { const reason = ask(fin(L, "reason")); if (reason) run(() => reopenLegacyReviewAction(r.paymentId, reason)); }}>{T("Qayta ochish", "Переоткрыть", "Reopen", "Wieder öffnen")}</button>}
              </div>
              {form?.id === r.paymentId && form.kind === "allocate" && (
                <div className="mt-2 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs sm:grid-cols-6">
                  <label className="flex flex-col gap-1">{T("Xizmat oyi (YYYY-MM)", "Месяц услуги", "Service month", "Leistungsmonat")}<input className="input" value={f.ym ?? ""} onChange={(e) => setF({ ...f, ym: e.target.value })} placeholder="2026-08" /></label>
                  <label className="flex flex-col gap-1">{fin(L, "amount")} (max {r.unallocated})<input className="input" value={f.amount ?? ""} onChange={(e) => setF({ ...f, amount: e.target.value })} /></label>
                  <label className="flex flex-col gap-1">{fin(L, "group")}<select className="input" value={f.groupId ?? ""} onChange={(e) => setF({ ...f, groupId: e.target.value })}><option value="">—</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
                  <label className="flex flex-col gap-1 sm:col-span-2">{T("Sabab / dalil (majburiy)", "Причина / доказательство", "Reason / evidence (required)", "Grund / Nachweis")}<input className="input" value={f.reason ?? ""} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder={T("masalan: chek №… , guruh …, avgust oyi", "например: чек №…, группа …", "e.g. receipt #…, group …, August", "z. B. Beleg Nr. …")} /></label>
                  <div className="flex items-end gap-2">
                    <button type="button" className="btn-primary px-3 py-1.5" disabled={pending || !/^\d{4}-\d{2}$/.test(f.ym ?? "") || !(money(f.amount ?? "") > 0) || (f.reason ?? "").trim().length < 5} onClick={() => run(() => allocateHistoricalAction({ paymentId: r.paymentId, amount: money(f.amount ?? ""), newCharge: { ym: f.ym, amount: money(f.amount ?? ""), groupId: f.groupId || null, note: f.note || null }, reason: f.reason }))}>{fin(L, "save")}</button>
                    <button type="button" className="btn-ghost px-3 py-1.5" onClick={() => setForm(null)}>{fin(L, "cancel")}</button>
                  </div>
                  <p className="sm:col-span-6 text-[11px] text-slate-500">{T("Yangi HISTORICAL charge yaratiladi (xizmat oyi + summa) va to'lovning shu qismi unga bog'lanadi. To'lov qatori o'zgarmaydi. Qaror AuditLog'da.", "Создаётся HISTORICAL начисление и часть платежа привязывается к нему. Платёж не меняется. Решение в AuditLog.", "Creates a HISTORICAL charge and links this part of the payment to it. The payment row never changes. Logged in AuditLog.", "Erzeugt eine HISTORICAL-Forderung und ordnet den Betrag zu. Zahlung unverändert. Im AuditLog.")}</p>
                </div>
              )}
              {r.allocations.length > 0 && (
                <ul className="mt-2 space-y-1 text-[11px] text-slate-600">
                  {r.allocations.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center gap-2">
                      <span>→ {a.month}{a.group ? ` · ${a.group}` : ""} · {a.chargeKind} · <b className="tabular-nums">{formatMoney(a.amount, L)}</b></span>
                      {a.earnings.map((e) => <Badge key={e.id} tone={e.status === "POSTED" ? "green" : e.status === "REJECTED" ? "red" : "amber"}>{e.teacher} {e.rateBp !== null ? `${e.rateBp / 100}%` : ""} {formatMoney(e.amount, L)} · {e.status}</Badge>)}
                      {enabled && perms.salary && a.earnings.length === 0 && <button type="button" className="btn-ghost px-2 py-0.5 text-[11px]" disabled={pending} onClick={() => { setForm({ id: r.paymentId, kind: "teacher", allocationId: a.id }); setF({ teacherId: "", rate: "", reason: "" }); }}>{T("O'qituvchi kontekstini hal qilish", "Указать преподавателя", "Resolve teacher context", "Lehrer zuordnen")}</button>}
                      {form?.id === r.paymentId && form.kind === "teacher" && form.allocationId === a.id && (
                        <span className="flex flex-wrap items-center gap-1">
                          <select className="input py-0.5 text-[11px]" value={f.teacherId ?? ""} onChange={(e) => setF({ ...f, teacherId: e.target.value })}><option value="">{T("o'qituvchi", "преподаватель", "teacher", "Lehrer")}</option>{teachers.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}</select>
                          <input className="input w-20 py-0.5 text-[11px]" placeholder="% (40)" value={f.rate ?? ""} onChange={(e) => setF({ ...f, rate: e.target.value })} />
                          <input className="input w-56 py-0.5 text-[11px]" placeholder={T("sabab: o'sha oy qoidasi …", "причина: правило того месяца", "reason: that month's rule …", "Grund: Regel jenes Monats")} value={f.reason ?? ""} onChange={(e) => setF({ ...f, reason: e.target.value })} />
                          <button type="button" className="btn-primary px-2 py-0.5 text-[11px]" disabled={pending || !f.teacherId || !(Number(f.rate) > 0 && Number(f.rate) <= 100) || (f.reason ?? "").trim().length < 5} onClick={() => run(() => resolveHistoricalTeacherAction({ paymentId: r.paymentId, allocationId: a.id, teacherId: f.teacherId, rateBp: Math.round(Number(f.rate) * 100), reason: f.reason }))}>{fin(L, "save")}</button>
                          <button type="button" className="btn-ghost px-2 py-0.5 text-[11px]" onClick={() => setForm(null)}>{fin(L, "cancel")}</button>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </RowGroup>
          ))}
        </Table>
      </div>
      {msg && <p className="px-4 py-2 text-xs text-slate-500">{msg}</p>}
    </Card>
  );
}

function RowGroup({ r, L, open, clsTone, children }: { r: ReviewRow; L: Locale; open: boolean; clsTone: (c: string) => "green" | "amber" | "red"; children: React.ReactNode }) {
  const T = (uz: string, ru: string, en: string, de: string) => tr(L, { uz, ru, en, de });
  const statusLabel = r.status === "NEEDS_REVIEW" ? (r.resolution === "UNRESOLVED" ? T("HAL QILINMAGAN", "ОТКРЫТО", "UNRESOLVED", "OFFEN") : T("KO'RIB CHIQISH", "ПРОВЕРКА", "NEEDS REVIEW", "PRÜFUNG")) : r.resolution === "ADVANCE" ? T("AVANS", "АВАНС", "ADVANCE", "VORSCHUSS") : T("TAQSIMLANGAN", "РАСПРЕДЕЛЕНО", "ALLOCATED", "ZUGEORDNET");
  return (
    <>
      <tr className="text-sm align-top">
        <td className="px-4 py-2"><a className="font-medium text-brand-700 hover:underline" href={`/finance/v2/students/${r.studentId}`}>{r.student}</a><div className="text-[10px] text-slate-400">{r.eduStatus ?? ""} · {r.branch ?? "—"}</div></td>
        <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatMoney(r.amount, L)}<div className="text-[10px] font-normal text-slate-400">{r.allocated ? `${T("taqsimlangan", "распред.", "allocated", "zugeordnet")} ${formatMoney(r.allocated, L)}` : ""}{r.unallocated ? ` · ${T("ochiq", "открыто", "open", "offen")} ${formatMoney(r.unallocated, L)}` : ""}{r.refunded ? ` · −${formatMoney(r.refunded, L)}` : ""}</div></td>
        <td className="px-3 py-2 whitespace-nowrap">{fmtDate(L, r.receivedAt, false)}<div className="text-[10px] text-slate-400">{T("kiritilgan", "введён", "entered", "erfasst")} {fmtDate(L, r.createdAt, false)}</div></td>
        <td className="px-3 py-2">{r.method}</td>
        <td className="px-3 py-2 max-w-[14rem] text-xs">{r.source}<div className="text-[10px] text-slate-400">{r.author ? `${T("kiritgan", "ввёл", "by", "von")}: ${r.author}` : ""} · {r.legacyRole ?? "null"} · {r.paymentStatus}</div></td>
        <td className="px-3 py-2 text-xs">{r.suggestedMonth ? <b>{r.suggestedMonth}</b> : "—"}{r.months.length > 0 && <div className="text-[10px] text-slate-400">{r.months.join("; ")}</div>}</td>
        <td className="px-3 py-2 text-xs">{r.groups.length ? r.groups.join("; ") : "—"}</td>
        <td className="px-3 py-2"><Badge tone={clsTone(r.classification)}>{r.classification.replace("_ATTRIBUTABLE", "")} · {r.confidence}</Badge><div className="mt-1"><Badge tone={r.status === "NEEDS_REVIEW" ? "amber" : "green"}>{statusLabel}</Badge></div>{r.resolvedBy && <div className="text-[10px] text-slate-400">{r.resolvedBy} · {r.resolvedAt ? fmtDate(L, r.resolvedAt, true) : ""}</div>}</td>
        <td className="px-3 py-2 max-w-[18rem] text-[11px] text-slate-600">{r.reasons.join("; ")}{r.reason && <div className="mt-1 text-slate-800">↳ {r.reason}</div>}</td>
        <td className="px-3 py-2">{children}</td>
      </tr>
      {open && (
        <tr className="bg-slate-50/60 text-[11px] text-slate-700 dark:bg-slate-900/40">
          <td colSpan={10} className="px-4 py-3">
            <div className="grid gap-3 md:grid-cols-3">
              <div><p className="mb-1 font-semibold">{T("A'zoliklar (hozirgi bazada)", "Членства", "Memberships", "Mitgliedschaften")}</p>{r.memberships.length ? <ul className="space-y-0.5">{r.memberships.map((m, i) => <li key={i}>{m}</li>)}</ul> : <p className="text-slate-400">{T("yo'q (guruh a'zoligi o'chirilgan yoki bo'lmagan)", "нет", "none", "keine")}</p>}</div>
              <div><p className="mb-1 font-semibold">{T("O'qituvchi dalillari / legacy maosh qatorlari", "Преподаватель / старые зарплаты", "Teacher evidence / legacy salary rows", "Lehrer / alte Gehaltszeilen")}</p>{r.teachers.length || r.legacySalary.length ? <ul className="space-y-0.5">{r.teachers.map((t, i) => <li key={`t${i}`}>{t}</li>)}{r.legacySalary.map((t, i) => <li key={`s${i}`} className="text-slate-500">{t}</li>)}</ul> : <p className="text-slate-400">{T("yo'q — o'qituvchi ulushi yaratilmaydi", "нет — доля не создаётся", "none — no earning will be created", "keine — kein Anteil")}</p>}</div>
              <div><p className="mb-1 font-semibold">{T("AuditLog izlari", "Следы AuditLog", "AuditLog trail", "AuditLog-Spur")}</p>{r.audit.length ? <ul className="space-y-0.5">{r.audit.map((a, i) => <li key={i} className="truncate" title={a}>{a}</li>)}</ul> : <p className="text-slate-400">—</p>}</div>
            </div>
            <p className="mt-2 text-[10px] text-slate-400">{T("Dalil bo'lmasa taxmin qilinmaydi: guruh/oy/o'qituvchi faqat hujjat, a'zolik yoki audit izi bo'lsa ko'rsatiladi.", "Без доказательств нет предположений.", "No evidence → no assumption: group/month/teacher shown only from documents, memberships or audit trail.", "Ohne Nachweis keine Annahme.")}</p>
          </td>
        </tr>
      )}
    </>
  );
}
