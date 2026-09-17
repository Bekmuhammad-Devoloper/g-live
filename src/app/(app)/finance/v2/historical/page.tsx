import { prisma } from "@/lib/db";
import { ROLES, formatMoney } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { paymentAvailability } from "@/lib/finance/billing/balance";
import { legacyPreservationInvariant } from "@/lib/finance/legacy/preserve";
import type { LegacyPaymentDossier } from "@/lib/finance/legacy/evidence";
import { yearMonthKey } from "@/lib/finance/period";
import { Card, Forbidden, PageHeader, StatCard } from "../../../_components/ui";
import { fin } from "../_i18n";
import { financePage } from "../_shared";
import HistoricalReviewList, { type AllocationRow, type ReviewRow } from "./HistoricalReviewList";

// Finance → Tarixiy real to'lovlar (cutover'dan oldingi) — ko'rib chiqish. FINAL QAROR: bu pul REAL, o'chirilmaydi,
// summasi o'zgarmaydi, kredit emas, o'qituvchi ulushi taxmin bilan yaratilmaydi. Har qaror inson tomonidan, sabab bilan, AuditLog'da.
export const dynamic = "force-dynamic";

type Dossier = Omit<LegacyPaymentDossier, "classification">;
const parseDossier = (raw: string): Dossier | null => { try { return JSON.parse(raw) as Dossier; } catch { return null; } };
const parseReasons = (raw: string): string[] => { try { const v = JSON.parse(raw); return Array.isArray(v) ? v.map(String) : []; } catch { return []; } };

export default async function HistoricalPaymentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { session, can, flags, branchId } = await financePage();
  const L = session.locale;
  if (!can("PAYMENT_CORRECT") && !can("SALARY_APPROVE")) return <Forbidden title={fin(L, "forbiddenTitle")} body={fin(L, "forbidden")} />;
  const sp = await searchParams;
  const showAll = sp.all === "1";
  const [inv, reviews, teachers] = await Promise.all([
    legacyPreservationInvariant(prisma),
    prisma.legacyPaymentReview.findMany({
      where: { ...(showAll ? {} : { status: "NEEDS_REVIEW" }), ...(branchId ? { payment: { branchId } } : {}) },
      orderBy: [{ status: "desc" }, { receivedAt: "asc" }],
      include: { payment: { select: { method: true, docNumber: true, purpose: true, note: true, createdAt: true, receivedAt: true, legacyRole: true, status: true, branch: { select: { name: true } }, author: { select: { fullName: true } } } }, resolvedBy: { select: { fullName: true } } },
    }),
    prisma.user.findMany({ where: { role: ROLES.TEACHER, isActive: true }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
  ]);
  const paymentIds = reviews.map((r) => r.paymentId);
  const [avail, allocations, students, groups] = await Promise.all([
    paymentAvailability(prisma, paymentIds),
    prisma.paymentAllocation.findMany({ where: { paymentId: { in: paymentIds }, kind: "ALLOCATION" }, include: { charge: { select: { id: true, serviceYear: true, serviceMonth: true, kind: true, finalAmount: true, group: { select: { name: true } } } }, earnings: { select: { id: true, teacherId: true, rateBp: true, amount: true, status: true, teacher: { select: { fullName: true } } } } }, orderBy: { createdAt: "asc" } }),
    prisma.student.findMany({ where: { id: { in: reviews.map((r) => r.studentId) } }, select: { id: true, fullName: true, phone: true, eduStatus: true } }),
    prisma.group.findMany({ where: { status: { in: ["PLANNED", "ACTIVE"] }, ...(branchId ? { branchId } : {}) }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const studentMap = new Map(students.map((s) => [s.id, s]));
  const allocByPayment = new Map<string, AllocationRow[]>();
  for (const a of allocations) {
    const row: AllocationRow = { id: a.id, amount: a.amount, chargeId: a.chargeId, chargeKind: a.charge.kind, month: yearMonthKey({ year: a.charge.serviceYear, month: a.charge.serviceMonth }), group: a.charge.group?.name ?? null, earnings: a.earnings.map((e) => ({ id: e.id, teacher: e.teacher.fullName, rateBp: e.rateBp, amount: e.amount, status: e.status })) };
    allocByPayment.set(a.paymentId, [...(allocByPayment.get(a.paymentId) ?? []), row]);
  }
  const rows: ReviewRow[] = reviews.map((r) => {
    const d = parseDossier(r.evidence);
    const st = studentMap.get(r.studentId);
    const a = avail.get(r.paymentId);
    return {
      paymentId: r.paymentId, studentId: r.studentId, student: st?.fullName ?? d?.student?.fullName ?? "?", eduStatus: st?.eduStatus ?? d?.student?.eduStatus ?? null,
      amount: r.amount, receivedAt: r.receivedAt.toISOString(), method: r.payment.method, branch: r.payment.branch?.name ?? d?.branch ?? null,
      source: [r.payment.docNumber, r.payment.purpose, r.payment.note].filter(Boolean).join(" · ") || "—", author: r.payment.author?.fullName ?? null, createdAt: r.payment.createdAt.toISOString(),
      legacyRole: r.payment.legacyRole, paymentStatus: r.payment.status,
      classification: r.classification, confidence: r.confidence, status: r.status, resolution: r.resolution, reason: r.reason, resolvedBy: r.resolvedBy?.fullName ?? null, resolvedAt: r.resolvedAt?.toISOString() ?? null,
      suggestedMonth: r.suggestedMonth, reasons: parseReasons(r.reasons),
      unallocated: a?.unallocated ?? r.amount, allocated: (a?.allocated ?? 0) - (a?.reversed ?? 0), refunded: a?.refunded ?? 0,
      groups: d?.groupEvidence.map((g) => `${g.groupName ?? g.groupId}${g.deleted ? ` (${tr(L, { uz: "o'chirilgan", ru: "удалена", en: "deleted", de: "gelöscht" })})` : ""} [${g.source}]`) ?? [],
      months: d?.serviceMonthEvidence.map((m) => `${m.month} [${m.source}]`) ?? [],
      teachers: d?.teacherEvidence.map((t) => `${t.teacherName ?? t.teacherId} [${t.source}]`) ?? [],
      memberships: d?.memberships.map((m) => `${m.groupName} ${m.joinedAt.slice(0, 10)}→${m.leftAt?.slice(0, 10) ?? "…"}${m.feeAmount ? ` · ${m.feeAmount} (${m.feeSource})` : ""}`) ?? [],
      audit: d?.auditEntries.slice(0, 12).map((e) => `${e.createdAt.slice(0, 16).replace("T", " ")} ${e.action} ${e.entityType}${e.reason ? ` — ${e.reason}` : ""}${e.snippet ? ` · ${e.snippet}` : ""}`) ?? [],
      legacySalary: d?.teacherSalaryRows.map((t) => `${t.teacherName} ${t.year}-${String(t.month).padStart(2, "0")}${t.closed ? " (yopiq)" : ""}`) ?? [],
      allocations: allocByPayment.get(r.paymentId) ?? [],
    };
  });
  const perms = { correct: can("PAYMENT_CORRECT"), salary: can("SALARY_APPROVE") };
  return (
    <>
      <PageHeader title={fin(L, "historical")} subtitle={tr(L, { uz: "Cutover'dan oldingi REAL to'lovlar — o'chirilmaydi, summasi o'zgarmaydi, V2 krediti emas. Taqsimlash faqat dalil bilan; o'qituvchi ulushi faqat aniq davr va foiz bilan.", ru: "РЕАЛЬНЫЕ платежи до cutover — не удаляются, сумма не меняется, не кредит V2. Распределение только по доказательствам.", en: "REAL pre-cutover payments — never deleted or changed, not V2 credit. Allocate only with evidence.", de: "ECHTE Zahlungen vor Cutover — nie gelöscht/geändert, kein V2-Guthaben. Zuordnung nur mit Nachweis." })} />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={tr(L, { uz: "Legacy real to'lovlar", ru: "Старые реальные платежи", en: "Legacy real payments", de: "Alte echte Zahlungen" })} value={`${inv.legacyCount} · ${formatMoney(inv.legacyTotal, L)}`} hint={`${tr(L, { uz: "saqlangan", ru: "сохранено", en: "preserved", de: "erhalten" })}: ${formatMoney(inv.preservedTotal, L)}`} icon="card" />
        <StatCard label={tr(L, { uz: "Ko'rib chiqish kutmoqda", ru: "Ожидают проверки", en: "Awaiting review", de: "Prüfung ausstehend" })} value={`${inv.reviews.needsReview} · ${formatMoney(inv.historicalUnallocated, L)}`} tone={inv.reviews.needsReview > 0 ? "amber" : "green"} icon="clock" />
        <StatCard label={tr(L, { uz: "Hal qilingan (taqsimlangan / avans / ochiq)", ru: "Решено (распред. / аванс / открыто)", en: "Resolved (allocated / advance / open)", de: "Gelöst (zugeordnet / Vorschuss / offen)" })} value={`${inv.reviews.resolvedAllocated} / ${inv.reviews.resolvedAdvance} / ${inv.reviews.unresolved}`} icon="check" />
        <StatCard label={tr(L, { uz: "Invariant: yo'qolgan / dublikat / soxta kredit", ru: "Инвариант: потеряно / дубли / ложный кредит", en: "Invariant: lost / duplicate / fake credit", de: "Invariante: verloren / doppelt / Scheinguthaben" })} value={`${formatMoney(inv.lostAmount, L)} / ${inv.duplicateLedger} / ${inv.fakeCreditCount}`} tone={inv.ok ? "green" : "red"} hint={inv.ok ? "OK" : tr(L, { uz: "BUZILGAN — texnik tekshiruv kerak", ru: "НАРУШЕН — нужна проверка", en: "VIOLATED — needs investigation", de: "VERLETZT — Prüfung nötig" })} icon="shieldCheck" />
      </div>
      {!flags.enabled && <Card className="mb-4 border-amber-200 bg-amber-50/40"><p className="text-sm text-amber-800">{tr(L, { uz: "Finance V2 hali yoqilmagan — ro'yxat faqat ko'rish uchun; qarorlar (taqsimlash/avans) Finance V2 yoqilgandan keyin qabul qilinadi.", ru: "Finance V2 ещё не включён — список только для просмотра; решения принимаются после включения.", en: "Finance V2 is not enabled yet — read-only; decisions are made after enabling.", de: "Finance V2 ist noch nicht aktiv — nur Ansicht; Entscheidungen nach Aktivierung." })}</p></Card>}
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <a href="/finance/v2/historical" className={`rounded-lg px-3 py-1.5 font-semibold ${!showAll ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700"}`}>{fin(L, "needsReview")} ({inv.reviews.needsReview})</a>
        <a href="/finance/v2/historical?all=1" className={`rounded-lg px-3 py-1.5 font-semibold ${showAll ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700"}`}>{tr(L, { uz: "Hammasi", ru: "Все", en: "All", de: "Alle" })}</a>
      </div>
      <HistoricalReviewList locale={L} enabled={flags.enabled} rows={rows} teachers={teachers} groups={groups} perms={perms} />
    </>
  );
}
