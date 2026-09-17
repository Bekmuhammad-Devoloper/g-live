// Finance V2 — LEGACY (cutover'dan oldingi) REAL TO'LOV uchun dalil dossyesi va konservativ klassifikatsiya.
//
// Manbalar: Payment qatori, o'quvchi, hozirgi a'zoliklar (GroupStudent), V2 tarix intervallari (bo'lsa),
// AuditLog (to'lov/o'quvchi/guruh yozuvlari, o'chirilgan guruh nomi), Lead ↔ o'quvchi, guruh o'qituvchisi /
// tayinlashlar, TeacherSalary qatorlari, narx manbalari, mavjud taqsimotlar. FAQAT O'QIYDI.
//
// Klassifikatsiya (taxminsiz):
//   EXACTLY_ATTRIBUTABLE   — a'zolik (guruh mavjud) + narx manbai aniq (guruh/kurs narxi) yoki to'lov allaqachon
//                            to'liq taqsimlangan: xizmat davri deterministik tiklanadi
//   PARTIALLY_ATTRIBUTABLE — to'lov real, guruh/oy haqida qisman dalil bor (masalan o'chirilgan guruh nomi,
//                            purpose'da oy), lekin narx yoki davr ishonchli emas
//   UNATTRIBUTABLE         — qaysi xizmat/oyga tegishli ekani ishonchli aniqlanmaydi

import type { FinanceDb } from "../db";
import { resolveListFee } from "../billing/fees";
import { tashkentYearMonth, yearMonthKey } from "../period";

export type LegacyClassification = "EXACTLY_ATTRIBUTABLE" | "PARTIALLY_ATTRIBUTABLE" | "UNATTRIBUTABLE";

export interface EvidenceItem { source: string; note?: string }
export interface GroupEvidence extends EvidenceItem { groupId: string; groupName: string | null; deleted: boolean; programName?: string | null }
export interface MonthEvidence extends EvidenceItem { month: string }
export interface TeacherEvidence extends EvidenceItem { teacherId: string; teacherName: string | null }
export interface FeeEvidence extends EvidenceItem { amount: number }

export interface LegacyPaymentDossier {
  payment: {
    id: string; studentId: string; amount: number; method: string; purpose: string | null; docNumber: string | null; note: string | null; status: string;
    createdAt: string; receivedAt: string | null; legacyRole: string | null; postedAt: string | null; authorName: string | null; transactionId: string | null; receiptUrl: string | null;
  };
  student: { id: string; fullName: string; phone: string | null; eduStatus: string; branchId: string | null; createdAt: string; currentLevel: string | null } | null;
  branch: string | null;
  memberships: { groupId: string; groupName: string; joinedAt: string; leftAt: string | null; isActive: boolean; programName: string | null; feeAmount: number | null; feeSource: string | null }[];
  historyIntervals: { groupId: string; from: string; to: string | null; source: string }[];
  groupEvidence: GroupEvidence[];
  serviceMonthEvidence: MonthEvidence[];
  teacherEvidence: TeacherEvidence[];
  feeEvidence: FeeEvidence[];
  auditEntries: { createdAt: string; action: string; entityType: string; entityId: string | null; reason: string | null; snippet: string }[];
  existingAllocations: { chargeId: string; month: string; amount: number; kind: string }[];
  refundedAmount: number;
  teacherSalaryRows: { teacherId: string; teacherName: string; year: number; month: number; fiksa: number; bonus: number; kpi: number; penalty: number; closed: boolean }[];
  review: { classification: string; status: string; resolution: string | null; reason: string | null } | null;
  classification: { kind: LegacyClassification; confidence: "HIGH" | "MEDIUM" | "LOW"; reasons: string[]; suggestedServiceMonth: string | null };
}

const MONTHS_UZ: Record<string, number> = { yanvar: 1, fevral: 2, mart: 3, aprel: 4, may: 5, iyun: 6, iyul: 7, avgust: 8, sentabr: 9, sentyabr: 9, oktabr: 10, oktyabr: 10, noyabr: 11, dekabr: 12 };
const MONTHS_RU: Record<string, number> = { январ: 1, феврал: 2, март: 3, апрел: 4, ма: 5, июн: 6, июл: 7, август: 8, сентябр: 9, октябр: 10, ноябр: 11, декабр: 12 };

/** Matnda oy nomi / YYYY-MM bo'lsa — dalil (yil ko'rsatilmasa qabul yili) */
export function monthsMentioned(text: string | null | undefined, receiptYear: number): string[] {
  if (!text) return [];
  const out = new Set<string>();
  const lower = text.toLowerCase();
  for (const m of lower.matchAll(/(20\d{2})[-./](0?[1-9]|1[0-2])\b/g)) out.add(`${m[1]}-${String(parseInt(m[2], 10)).padStart(2, "0")}`);
  for (const [name, num] of Object.entries(MONTHS_UZ)) if (lower.includes(name)) out.add(`${receiptYear}-${String(num).padStart(2, "0")}`);
  for (const [name, num] of Object.entries(MONTHS_RU)) if (lower.includes(name)) out.add(`${receiptYear}-${String(num).padStart(2, "0")}`);
  return [...out];
}

async function tableExists(db: FinanceDb, name: string): Promise<boolean> {
  const rows = await db.$queryRawUnsafe<{ n: number | bigint }[]>(`SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name = '${name.replace(/'/g, "''")}'`);
  return Number(rows[0]?.n ?? 0) > 0;
}

const parseJson = (s: string | null): Record<string, unknown> => { try { return s ? (JSON.parse(s) as Record<string, unknown>) : {}; } catch { return {}; } };

export async function collectLegacyPaymentEvidence(db: FinanceDb, paymentId: string): Promise<Omit<LegacyPaymentDossier, "classification">> {
  const p = await db.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { author: { select: { fullName: true } }, student: { include: { branch: { select: { name: true } }, enrollments: { include: { group: { include: { program: { select: { name: true, monthlyFee: true } } } } } } } } } });
  const receiptAt = p.receivedAt ?? p.createdAt;
  const receiptYm = tashkentYearMonth(receiptAt);
  const hasV2 = await tableExists(db, "StudentCharge");
  const student = p.student;

  // Hozirgi a'zoliklar + narx manbai
  const memberships: LegacyPaymentDossier["memberships"] = [];
  for (const e of student.enrollments) {
    const fee = await resolveListFee(db, e.groupId, e.group.branchId ?? student.branchId);
    memberships.push({ groupId: e.groupId, groupName: e.group.name, joinedAt: e.joinedAt.toISOString(), leftAt: e.leftAt?.toISOString() ?? null, isActive: e.isActive, programName: e.group.program?.name ?? null, feeAmount: fee?.amount ?? null, feeSource: fee?.source ?? null });
  }
  const historyIntervals = hasV2 ? (await db.groupStudentHistory.findMany({ where: { studentId: student.id }, orderBy: { effectiveFrom: "asc" } })).map((h) => ({ groupId: h.groupId, from: h.effectiveFrom.toISOString(), to: h.effectiveTo?.toISOString() ?? null, source: h.source })) : [];

  // AuditLog: to'lov, o'quvchi, guruh yozuvlari (id yoki JSON ichida)
  const audit = await db.auditLog.findMany({
    where: { OR: [{ entityId: p.id }, { entityType: "Student", entityId: student.id }, { newValue: { contains: student.id } }, { oldValue: { contains: student.id } }, { newValue: { contains: p.id } }, { oldValue: { contains: p.id } }] },
    orderBy: { createdAt: "asc" }, take: 200,
  });
  const groupIds = new Set<string>(memberships.map((m) => m.groupId));
  const groupEvidence: GroupEvidence[] = memberships.map((m) => ({ groupId: m.groupId, groupName: m.groupName, deleted: false, programName: m.programName, source: "GroupStudent", note: `${m.joinedAt.slice(0, 10)} → ${m.leftAt?.slice(0, 10) ?? "…"}` }));
  for (const h of historyIntervals) if (!groupIds.has(h.groupId)) { groupIds.add(h.groupId); groupEvidence.push({ groupId: h.groupId, groupName: null, deleted: true, source: `GroupStudentHistory[${h.source}]`, note: `${h.from.slice(0, 10)} → ${h.to?.slice(0, 10) ?? "…"}` }); }
  const auditEntries: LegacyPaymentDossier["auditEntries"] = [];
  for (const a of audit) {
    const nv = parseJson(a.newValue); const ov = parseJson(a.oldValue);
    auditEntries.push({ createdAt: a.createdAt.toISOString(), action: a.action, entityType: a.entityType, entityId: a.entityId, reason: a.reason, snippet: JSON.stringify({ ...ov, ...nv }).slice(0, 160) });
    const gid = (nv.groupId ?? ov.groupId) as string | undefined;
    if (gid && !groupIds.has(gid)) { groupIds.add(gid); groupEvidence.push({ groupId: gid, groupName: null, deleted: true, source: `AuditLog:${a.entityType}.${a.action}`, note: a.createdAt.toISOString().slice(0, 10) }); }
  }
  // Lead ↔ o'quvchi (guruh/daraja ma'lumoti)
  const lead = await db.lead.findFirst({ where: { studentId: student.id }, select: { groupId: true, level: true, interestCourse: true, createdAt: true } }).catch(() => null);
  if (lead?.groupId && !groupIds.has(lead.groupId)) { groupIds.add(lead.groupId); groupEvidence.push({ groupId: lead.groupId, groupName: null, deleted: true, source: "Lead.groupId", note: lead.createdAt.toISOString().slice(0, 10) }); }
  // Guruh nomlari: mavjud bo'lsa jadvaldan, o'chirilgan bo'lsa Group.DELETE audit'idan
  for (const g of groupEvidence) {
    if (g.groupName) continue;
    const row = await db.group.findUnique({ where: { id: g.groupId }, select: { name: true, program: { select: { name: true } } } });
    if (row) { g.groupName = row.name; g.deleted = false; g.programName = row.program?.name ?? null; continue; }
    const del = await db.auditLog.findFirst({ where: { entityType: "Group", action: "DELETE", entityId: g.groupId }, orderBy: { createdAt: "desc" } });
    const created = await db.auditLog.findFirst({ where: { entityType: "Group", action: "CREATE", entityId: g.groupId } });
    g.groupName = (parseJson(del?.oldValue ?? null).name as string | undefined) ?? (parseJson(created?.newValue ?? null).name as string | undefined) ?? null;
    if (del) g.note = `${g.note ?? ""} o'chirilgan ${del.createdAt.toISOString().slice(0, 10)}`.trim();
  }

  // Xizmat oyi dalili: purpose/note/docNumber matni (oy nomi yoki YYYY-MM)
  const serviceMonthEvidence: MonthEvidence[] = [];
  for (const [src, text] of [["purpose", p.purpose], ["note", p.note], ["docNumber", p.docNumber]] as const) {
    for (const m of monthsMentioned(text, receiptYm.year)) serviceMonthEvidence.push({ month: m, source: src, note: text ?? undefined });
  }
  // Mavjud taqsimotlar (V2) — bu ham dalil (allaqachon bog'langan xizmat oyi)
  const existingAllocations: LegacyPaymentDossier["existingAllocations"] = [];
  if (hasV2) {
    const allocs = await db.paymentAllocation.findMany({ where: { paymentId: p.id }, include: { charge: { select: { serviceYear: true, serviceMonth: true } } } });
    for (const a of allocs) { const month = yearMonthKey({ year: a.charge.serviceYear, month: a.charge.serviceMonth }); existingAllocations.push({ chargeId: a.chargeId, month, amount: a.amount, kind: a.kind }); if (a.kind === "ALLOCATION") serviceMonthEvidence.push({ month, source: "allocation", note: `charge ${a.chargeId.slice(-6)}` }); }
  }

  // O'qituvchi dalili: guruh o'qituvchisi, V2 tayinlash tarixi, o'sha oy TeacherSalary qatorlari (kuchsiz)
  const teacherEvidence: TeacherEvidence[] = [];
  const teacherSalaryRows: LegacyPaymentDossier["teacherSalaryRows"] = [];
  for (const g of groupEvidence.filter((x) => !x.deleted)) {
    const row = await db.group.findUnique({ where: { id: g.groupId }, select: { teacherId: true, teacher: { select: { fullName: true } } } });
    if (row?.teacherId) teacherEvidence.push({ teacherId: row.teacherId, teacherName: row.teacher?.fullName ?? null, source: `Group.teacherId(${g.groupName ?? g.groupId})` });
    if (hasV2) for (const a of await db.groupTeacherAssignment.findMany({ where: { groupId: g.groupId }, include: { teacher: { select: { fullName: true } } } })) teacherEvidence.push({ teacherId: a.teacherId, teacherName: a.teacher.fullName, source: `GroupTeacherAssignment[${a.source}] ${a.role}`, note: `${a.effectiveFrom.toISOString().slice(0, 10)} → ${a.effectiveTo?.toISOString().slice(0, 10) ?? "…"}` });
  }
  for (const t of teacherEvidence) {
    for (const r of await db.teacherSalary.findMany({ where: { teacherId: t.teacherId, year: receiptYm.year, month: receiptYm.month } })) teacherSalaryRows.push({ teacherId: r.teacherId, teacherName: t.teacherName ?? r.teacherId, year: r.year, month: r.month, fiksa: r.fiksa, bonus: r.bonus, kpi: r.kpi, penalty: r.penalty, closed: r.closed });
  }

  // Narx dalili: a'zolik guruhlari narxi (hozirgi konfiguratsiya — tarixiy narx alohida saqlanmagan!)
  const feeEvidence: FeeEvidence[] = memberships.filter((m) => m.feeAmount).map((m) => ({ amount: m.feeAmount!, source: `${m.feeSource} (${m.groupName})`, note: "hozirgi konfiguratsiya" }));

  const refundedAmount = hasV2 ? (await db.refund.aggregate({ _sum: { amount: true }, where: { originalPaymentId: p.id, status: "DONE" } }))._sum.amount ?? 0 : 0;
  const review = hasV2 && (await tableExists(db, "LegacyPaymentReview")) ? await db.legacyPaymentReview.findUnique({ where: { paymentId: p.id }, select: { classification: true, status: true, resolution: true, reason: true } }) : null;

  return {
    payment: { id: p.id, studentId: p.studentId, amount: p.amount, method: p.method, purpose: p.purpose, docNumber: p.docNumber, note: p.note, status: p.status, createdAt: p.createdAt.toISOString(), receivedAt: p.receivedAt?.toISOString() ?? null, legacyRole: p.legacyRole, postedAt: p.postedAt?.toISOString() ?? null, authorName: p.author?.fullName ?? null, transactionId: p.transactionId, receiptUrl: p.receiptUrl },
    student: { id: student.id, fullName: student.fullName, phone: student.phone, eduStatus: student.eduStatus, branchId: student.branchId, createdAt: student.createdAt.toISOString(), currentLevel: student.currentLevel },
    branch: student.branch?.name ?? null,
    memberships, historyIntervals, groupEvidence, serviceMonthEvidence, teacherEvidence, feeEvidence, auditEntries, existingAllocations, refundedAmount, teacherSalaryRows, review,
  };
}

/** Konservativ klassifikatsiya — taxmin yo'q */
export function classifyLegacyPayment(d: Omit<LegacyPaymentDossier, "classification">): LegacyPaymentDossier["classification"] {
  const reasons: string[] = [];
  const allocated = d.existingAllocations.filter((a) => a.kind === "ALLOCATION").reduce((s, a) => s + a.amount, 0) - d.existingAllocations.filter((a) => a.kind === "REVERSAL").reduce((s, a) => s + a.amount, 0);
  if (allocated >= d.payment.amount - d.refundedAmount && allocated > 0) {
    reasons.push(`to'liq taqsimlangan (${allocated}) — xizmat oylari: ${[...new Set(d.existingAllocations.map((a) => a.month))].join(", ")}`);
    return { kind: "EXACTLY_ATTRIBUTABLE", confidence: "HIGH", reasons, suggestedServiceMonth: d.existingAllocations[0]?.month ?? null };
  }
  const receiptMonth = yearMonthKey(tashkentYearMonth(new Date(d.payment.receivedAt ?? d.payment.createdAt)));
  const liveMembership = d.memberships.filter((m) => new Date(m.joinedAt) <= new Date(`${receiptMonth}-28T00:00:00Z`) || true);
  const withFee = liveMembership.filter((m) => m.feeAmount && (m.feeSource === "group" || m.feeSource === "program"));
  if (withFee.length > 0) {
    reasons.push(`a'zolik mavjud: ${withFee.map((m) => `${m.groupName} (${m.feeSource} ${m.feeAmount})`).join(", ")} — xizmat davri a'zolik + narxdan deterministik tiklanadi (backfill FIFO)`);
    if (d.serviceMonthEvidence.length) reasons.push(`oy dalili: ${d.serviceMonthEvidence.map((m) => `${m.month}[${m.source}]`).join(", ")}`);
    return { kind: "EXACTLY_ATTRIBUTABLE", confidence: withFee.length === 1 ? "HIGH" : "MEDIUM", reasons, suggestedServiceMonth: d.serviceMonthEvidence[0]?.month ?? null };
  }
  if (liveMembership.length > 0) {
    reasons.push(`a'zolik bor (${liveMembership.map((m) => m.groupName).join(", ")}), lekin narx manbai yo'q — davr tiklanmaydi`);
    return { kind: "PARTIALLY_ATTRIBUTABLE", confidence: "MEDIUM", reasons, suggestedServiceMonth: d.serviceMonthEvidence[0]?.month ?? null };
  }
  if (d.groupEvidence.length > 0 || d.serviceMonthEvidence.length > 0) {
    if (d.groupEvidence.length) reasons.push(`guruh dalili faqat tarixdan: ${d.groupEvidence.map((g) => `${g.groupName ?? g.groupId}${g.deleted ? " (o'chirilgan)" : ""} [${g.source}]`).join(", ")}`);
    if (d.serviceMonthEvidence.length) reasons.push(`oy dalili matndan: ${d.serviceMonthEvidence.map((m) => `${m.month}[${m.source}]`).join(", ")}`);
    reasons.push("a'zolik/narx yo'q — xizmat davri ishonchli emas, qo'lda ko'rib chiqiladi");
    return { kind: "PARTIALLY_ATTRIBUTABLE", confidence: "LOW", reasons, suggestedServiceMonth: d.serviceMonthEvidence[0]?.month ?? null };
  }
  reasons.push("a'zolik, guruh yoki oy haqida dalil yo'q (guruhlar o'chirilgan, purpose umumiy) — faqat qabul sanasi va summa ma'lum");
  return { kind: "UNATTRIBUTABLE", confidence: "LOW", reasons, suggestedServiceMonth: null };
}
