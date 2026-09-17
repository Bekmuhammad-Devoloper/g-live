// Finance V2 — BILLING / GO-LIVE READINESS. Flag yoqishdan oldin (va istalgan vaqtda) avtomatik tekshiruv:
// narxsiz o'quvchi/guruh, MAIN o'qituvchisiz guruh, qoidasiz o'qituvchi, yaroqsiz foiz, kassa xaritasi,
// sozlamalar, migratsiya holati, backfill (V2'ga kiritilmagan legacy to'lovlar), faol DIRECTOR, NEEDS_REVIEW.
// Natija: READY (BLOCKER yo'q) yoki NOT READY (sabablar, havolalar). Faqat o'qiydi.

import { ROLES } from "@/lib/constants";
import { FINANCE_SETTING_KEYS, FINANCE_V2_DEFAULT_CUTOVER_ISO } from "./constants";
import { accountTypeForMethod } from "./accounts/accounts";
import { PAYMENT_METHOD_TO_ACCOUNT_TYPE } from "./constants";
import { paymentAvailability } from "./billing/balance";
import { resolveFee, resolveListFee } from "./billing/fees";
import { legacyPreservationInvariant } from "./legacy/preserve";
import type { FinanceDb } from "./db";
import { isTashkentMonthStart, tashkentYearMonth, yearMonthKey, type YearMonth } from "./period";
import { isRuleUsable, resolveRule } from "./salary/rules";

export type ReadinessSeverity = "BLOCKER" | "WARNING" | "INFO";

export interface ReadinessItem {
  id: string;
  label: string;
  /** UI havolasi (tahrirlash joyi) */
  href?: string;
  extra?: string;
}

export interface ReadinessIssue {
  code:
    | "UNPRICED_STUDENTS" | "UNPRICED_GROUPS" | "GROUP_NO_MAIN_TEACHER" | "TEACHER_NO_RULE" | "INVALID_RULES"
    | "UNMAPPED_METHODS" | "INVALID_SETTINGS" | "MIGRATION_NOT_APPLIED" | "LEGACY_UNPOSTED" | "NO_ACTIVE_DIRECTOR"
    | "NEEDS_REVIEW" | "NO_GLOBAL_RULE" | "LEGACY_CREDIT" | "LEGACY_PRESERVATION" | "LEGACY_HISTORICAL_REVIEW" | "NO_ACTIVE_MEMBERSHIPS";
  severity: ReadinessSeverity;
  /** qisqa sabab (UI lug'ati shu kod bo'yicha) */
  count: number;
  items: ReadinessItem[];
  /** qo'shimcha kontekst */
  note?: string;
}

export interface ReadinessReport {
  ready: boolean;
  checkedAt: string;
  month: string;
  blockers: number;
  warnings: number;
  issues: ReadinessIssue[];
  stats: { activeStudents: number; activeGroups: number; teachers: number; legacyPaymentsUnposted: number; needsReview: number };
}

async function tableExists(db: FinanceDb, name: string): Promise<boolean> {
  const rows = await db.$queryRawUnsafe<{ n: number | bigint }[]>(`SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name = '${name.replace(/'/g, "''")}'`);
  return Number(rows[0]?.n ?? 0) > 0;
}

const ACTIVE_STUDENT = { notIn: ["ARCHIVED", "EXPELLED", "TRANSFERRED", "PROGRAM_DONE", "CERTIFIED"] };
const MAX_ITEMS = 200;

/** Go-live / billing readiness (faqat o'qiydi) */
export async function financeReadiness(db: FinanceDb, opts: { now?: Date; month?: YearMonth } = {}): Promise<ReadinessReport> {
  const now = opts.now ?? new Date();
  const ym = opts.month ?? tashkentYearMonth(now);
  const issues: ReadinessIssue[] = [];
  const push = (code: ReadinessIssue["code"], severity: ReadinessSeverity, items: ReadinessItem[], note?: string) => {
    if (items.length === 0) return;
    issues.push({ code, severity, count: items.length, items: items.slice(0, MAX_ITEMS), note });
  };

  // 1–2. Narx: faol a'zoliklar (o'quvchi faol, guruh faol/rejalashtirilgan)
  const memberships = await db.groupStudent.findMany({
    where: { isActive: true, leftAt: null, student: { eduStatus: ACTIVE_STUDENT }, group: { status: { in: ["PLANNED", "ACTIVE"] } } },
    select: { studentId: true, groupId: true, student: { select: { fullName: true, branchId: true } }, group: { select: { name: true, branchId: true, programId: true, program: { select: { name: true } } } } },
  });
  const unpricedStudents: ReadinessItem[] = [];
  const groupPriced = new Map<string, boolean>();
  for (const m of memberships) {
    const fee = await resolveFee(db, { studentId: m.studentId, groupId: m.groupId, branchId: m.group.branchId ?? m.student.branchId, serviceMonth: ym });
    if (!fee) unpricedStudents.push({ id: m.studentId, label: m.student.fullName, href: `/finance/v2/students/${m.studentId}`, extra: `${m.group.name} · ${m.group.program?.name ?? "—"}` });
    if (!groupPriced.has(m.groupId)) groupPriced.set(m.groupId, !!(await resolveListFee(db, m.groupId, m.group.branchId)));
  }
  push("UNPRICED_STUDENTS", "BLOCKER", unpricedStudents, "Guruh/kurs narxi, filial/global standart narx yoki o'quvchi bilan kelishilgan narx kiritilishi shart — aks holda charge yaratilmaydi (0 deb taxmin qilinmaydi)");

  const activeGroups = await db.group.findMany({ where: { status: { in: ["PLANNED", "ACTIVE"] } }, select: { id: true, name: true, branchId: true, teacherId: true, programId: true, program: { select: { name: true, monthlyFee: true } }, monthlyFee: true, _count: { select: { students: { where: { isActive: true, leftAt: null } } } } } });
  const unpricedGroups: ReadinessItem[] = [];
  for (const g of activeGroups) {
    const priced = groupPriced.get(g.id) ?? !!(await resolveListFee(db, g.id, g.branchId));
    if (!priced) unpricedGroups.push({ id: g.id, label: g.name, href: `/groups/${g.id}`, extra: `kurs: ${g.program?.name ?? "—"} · o'quvchi: ${g._count.students}` });
  }
  // Guruh narxsiz, lekin barcha o'quvchilari kelishilgan narxda bo'lsa — faqat ogohlantirish
  push("UNPRICED_GROUPS", unpricedGroups.some((g) => unpricedStudents.some((s) => s.extra?.startsWith(g.label + " ·"))) ? "BLOCKER" : "WARNING", unpricedGroups, "Guruh yoki uning kursi uchun oylik narx kiriting (Guruhlar → guruh → narx; Kurslar → kurs → narx)");

  // 3. MAIN o'qituvchisiz guruhlar (o'quvchisi bor)
  const noMain: ReadinessItem[] = [];
  for (const g of activeGroups) {
    if (g._count.students === 0) continue;
    const open = g.teacherId ? 1 : await db.groupTeacherAssignment.count({ where: { groupId: g.id, role: "MAIN", effectiveTo: null } });
    if (!open) noMain.push({ id: g.id, label: g.name, href: `/groups/${g.id}`, extra: `o'quvchi: ${g._count.students}` });
  }
  push("GROUP_NO_MAIN_TEACHER", "BLOCKER", noMain, "O'qituvchisiz guruh to'lovlaridan ulush hisoblanmaydi — guruhga asosiy o'qituvchi biriktiring");

  // 4. Qoidalar: global PERCENT qoida bormi; har faol o'qituvchi uchun PERCENT qoida hal bo'ladimi
  const rulesAll = await db.salaryRule.findMany();
  const invalid = rulesAll.filter((r) => !isRuleUsable(r)).map((r) => ({ id: r.id, label: `${r.scope}${r.targetName ? " · " + r.targetName : ""}: ${r.amountType} ${r.rateBp ?? r.amount}`, href: "/finance/v2/salary/settings" }));
  push("INVALID_RULES", "BLOCKER", invalid, "Foiz 0..100 oralig'ida bo'lishi kerak (legacy qoida yaroqsiz — dvigatel uni e'tiborsiz qoldiradi, lekin ko'rib chiqing)");
  const globalRule = await resolveRule(db, { serviceMonth: ym }, "PERCENT", ["GLOBAL"]);
  if (!globalRule) push("NO_GLOBAL_RULE", "WARNING", [{ id: "GLOBAL", label: "GLOBAL PERCENT qoidasi yo'q", href: "/finance/v2/salary/settings" }], "Global standart foiz bo'lmasa har o'qituvchi/guruh uchun alohida qoida kerak");
  const teacherNoRule: ReadinessItem[] = [];
  const teachersSeen = new Set<string>();
  for (const g of activeGroups) {
    if (!g.teacherId || teachersSeen.has(`${g.teacherId}:${g.id}`)) continue;
    teachersSeen.add(`${g.teacherId}:${g.id}`);
    const pct = await resolveRule(db, { serviceMonth: ym, teacherId: g.teacherId, groupId: g.id, programId: g.programId, branchId: g.branchId }, "PERCENT");
    const fixed = await resolveRule(db, { serviceMonth: ym, teacherId: g.teacherId, groupId: g.id, programId: g.programId, branchId: g.branchId }, "FIXED");
    if (!pct && !fixed) {
      const t = await db.user.findUnique({ where: { id: g.teacherId }, select: { fullName: true } });
      teacherNoRule.push({ id: g.teacherId, label: t?.fullName ?? g.teacherId, href: "/finance/v2/salary/settings", extra: `guruh: ${g.name}` });
    }
  }
  push("TEACHER_NO_RULE", "WARNING", teacherNoRule, "Qoidasiz o'qituvchi to'lovlari NEEDS_REVIEW (NO_RULE) bo'ladi — foiz yoki fiks qoida kiriting");

  // 5. To'lov usullari → kassa xaritasi (legacy to'lovlardagi usullar)
  const methods = await db.payment.groupBy({ by: ["method"], _count: { _all: true } });
  const unmapped: ReadinessItem[] = [];
  for (const m of methods) {
    const key = m.method.toUpperCase();
    const mapped = PAYMENT_METHOD_TO_ACCOUNT_TYPE[key] !== undefined || (await accountTypeForMethod(db, key)) !== "MAIN_CASH" || key === "CASH";
    if (!mapped) unmapped.push({ id: m.method, label: m.method, href: "/finance/v2/settings", extra: `${m._count._all} ta to'lov → MAIN_CASH (standart)` });
  }
  push("UNMAPPED_METHODS", "WARNING", unmapped, "Noma'lum usul standart bo'yicha asosiy kassaga tushadi — Sozlamalar → usul→kassa xaritasi");

  // 6. Sozlamalar
  const settings = await db.setting.findMany({ where: { key: { in: [FINANCE_SETTING_KEYS.enabled, FINANCE_SETTING_KEYS.cutoverAt] } } });
  const cutRaw = settings.find((s) => s.key === FINANCE_SETTING_KEYS.cutoverAt)?.value;
  const invalidSettings: ReadinessItem[] = [];
  if (cutRaw !== undefined) {
    const d = new Date(cutRaw);
    if (Number.isNaN(d.getTime()) || !isTashkentMonthStart(d)) invalidSettings.push({ id: "cutoverAt", label: `finance.v2.cutoverAt = "${cutRaw}" — Tashkent oy boshi emas (standart ${FINANCE_V2_DEFAULT_CUTOVER_ISO} qo'llanadi)`, href: "/finance/v2/settings" });
  }
  push("INVALID_SETTINGS", "WARNING", invalidSettings);

  // 7. Migratsiya holati (V2 jadvallari va _prisma_migrations)
  const migrationItems: ReadinessItem[] = [];
  const hasCharge = await tableExists(db, "StudentCharge");
  const hasMig = await tableExists(db, "_prisma_migrations");
  let migrationSeverity: ReadinessSeverity = "BLOCKER";
  if (!hasCharge) migrationItems.push({ id: "tables", label: "Finance V2 jadvallari yo'q — migratsiya qo'llanmagan" });
  else if (!hasMig) { migrationSeverity = "WARNING"; migrationItems.push({ id: "_prisma_migrations", label: "_prisma_migrations jadvali yo'q (db push rejimi — dev/test) — prod'da baseline qabul qilinishi shart" }); }
  else {
    const rows = await db.$queryRawUnsafe<{ migration_name: string; finished_at: string | null; rolled_back_at: string | null }[]>(`SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations`);
    for (const need of ["0_baseline", "20260915000000_finance_v2_core"]) {
      const r = rows.find((x) => x.migration_name === need);
      if (!r || !r.finished_at || r.rolled_back_at) migrationItems.push({ id: need, label: `${need}: ${!r ? "yo'q" : r.rolled_back_at ? "rolled back" : "tugallanmagan"}` });
    }
  }
  push("MIGRATION_NOT_APPLIED", migrationSeverity, migrationItems, "Deploy (update-b.sh) migratsiyani qo'llaydi");

  // 8. Backfill: V2'ga kiritilmagan legacy PAID to'lovlar / xarajatlar
  const unpostedPayments = hasCharge ? await db.payment.count({ where: { status: "PAID", postedAt: null, legacyRole: null } }) : 0;
  const unpostedExpenses = hasCharge ? await db.expense.count({ where: { postedAt: null } }) : 0;
  const legacyItems: ReadinessItem[] = [];
  if (unpostedPayments > 0) legacyItems.push({ id: "payments", label: `${unpostedPayments} ta PAID to'lov V2'ga kiritilmagan (backfill payments)` });
  if (unpostedExpenses > 0) legacyItems.push({ id: "expenses", label: `${unpostedExpenses} ta xarajat V2'ga kiritilmagan (backfill expenses)` });
  push("LEGACY_UNPOSTED", "BLOCKER", legacyItems, "Backfill bajarilmaguncha V2 balanslari legacy pulni ko'rmaydi");

  // 8b. Legacy real to'lovlar (cutover'dan oldingi): saqlash invarianti va ko'rib chiqish holati
  if (hasCharge) {
    const inv = await legacyPreservationInvariant(db);
    const bad: ReadinessItem[] = [];
    if (inv.lostAmount > 0) bad.push({ id: "lost", label: `Yo'qolgan summa: ${inv.lostAmount.toLocaleString("ru-RU")} so'm (to'lov ↔ ko'rib chiqish/ledger mos emas)` });
    if (inv.duplicateLedger > 0) bad.push({ id: "dup", label: `Ikki marta hisoblangan ledger yozuvlari: ${inv.duplicateLedger}` });
    if (inv.unposted > 0) bad.push({ id: "unposted", label: `${inv.unposted} ta legacy to'lov hali ledger'ga yozilmagan (backfill payments)` });
    if (inv.ledgerInCount !== inv.legacyCount || inv.ledgerInTotal !== inv.legacyTotal) bad.push({ id: "ledger", label: `Ledger IN ${inv.ledgerInCount}/${inv.legacyCount} (${inv.ledgerInTotal.toLocaleString("ru-RU")} / ${inv.legacyTotal.toLocaleString("ru-RU")} so'm)` });
    push("LEGACY_PRESERVATION", "BLOCKER", bad, `Legacy real to'lovlar: ${inv.legacyCount} ta, ${inv.legacyTotal.toLocaleString("ru-RU")} so'm — bir so'm ham yo'qolmasligi va ikki marta hisoblanmasligi shart`);
    if (inv.fakeCreditCount > 0) {
      const legacyPays = await db.payment.findMany({ where: { status: "PAID", legacyRole: null, postedAt: { not: null }, receivedAt: { lt: new Date(inv.cutoverAt) } }, select: { id: true, studentId: true, student: { select: { fullName: true } } } });
      const avail = await paymentAvailability(db, legacyPays.map((p) => p.id));
      const items = legacyPays.filter((p) => (avail.get(p.id)?.unallocated ?? 0) > 0).map((p) => ({ id: p.id, label: p.student.fullName, href: `/finance/v2/students/${p.studentId}`, extra: `${(avail.get(p.id)?.unallocated ?? 0).toLocaleString("ru-RU")} so'm V2 krediti sifatida turibdi` }));
      push("LEGACY_CREDIT", "BLOCKER", items, "Cutover'dan oldingi real to'lov taqsimlanmagan holda V2 KREDITI bo'lib turibdi — backfill preserve-legacy bosqichi bajarilmagan (HISTORICAL + ko'rib chiqish) yoki avans qarori dalilsiz");
    }
    if (inv.historical > 0 && inv.reviews.needsReview > 0) {
      const pending = await db.legacyPaymentReview.findMany({ where: { status: "NEEDS_REVIEW" }, include: { payment: { select: { studentId: true, student: { select: { fullName: true } } } } }, take: MAX_ITEMS });
      push("LEGACY_HISTORICAL_REVIEW", "WARNING", pending.map((r) => ({ id: r.paymentId, label: r.payment.student.fullName, href: "/finance/v2/historical", extra: `${r.amount.toLocaleString("ru-RU")} so'm · ${r.classification} · ${new Date(r.receivedAt).toISOString().slice(0, 10)}` })), `Tarixiy real to'lovlar ko'rib chiqishni kutmoqda (${inv.historicalUnallocated.toLocaleString("ru-RU")} so'm taqsimlanmagan) — summalari saqlangan, kredit emas, o'qituvchi ulushi yaratilmagan`);
    }
  }

  // 9. Faol DIRECTOR
  const directors = await db.user.count({ where: { role: ROLES.DIRECTOR, isActive: true } });
  if (directors === 0) push("NO_ACTIVE_DIRECTOR", "BLOCKER", [{ id: "director", label: "Faol DIRECTOR yo'q (flag, tasdiq, qayta ochish uchun kerak)", href: "/users" }]);

  // 9b. Faol a'zolik yo'q — hisob (charge) yaratilmaydi; guruh/a'zoliklar qayta yaratilishi kerak (bloker emas: kod emas, biznes ma'lumot)
  if (memberships.length === 0) push("NO_ACTIVE_MEMBERSHIPS", "WARNING", [{ id: "memberships", label: "Faol guruh a'zoligi yo'q — oylik hisoblar yaratilmaydi; guruhlar va o'quvchi a'zoliklarini kiriting", href: "/groups" }], "Cutover'dan keyin o'quvchilar guruhlarga biriktirilgach billing sync hisoblarni yaratadi");

  // 10. NEEDS_REVIEW
  const needsReview = hasCharge ? await db.teacherEarning.count({ where: { status: "NEEDS_REVIEW" } }) : 0;
  if (needsReview > 0) push("NEEDS_REVIEW", "WARNING", [{ id: "review", label: `${needsReview} ta earning ko'rib chiqilmagan`, href: "/finance/v2/salary" }], "Tasdiqlashdan oldin ko'rib chiqiladi (davr tasdig'i bloklanadi)");

  const blockers = issues.filter((i) => i.severity === "BLOCKER").length;
  const warnings = issues.filter((i) => i.severity === "WARNING").length;
  const teachers = await db.user.count({ where: { role: ROLES.TEACHER, isActive: true } });
  return {
    ready: blockers === 0,
    checkedAt: now.toISOString(),
    month: yearMonthKey(ym),
    blockers, warnings, issues,
    stats: { activeStudents: new Set(memberships.map((m) => m.studentId)).size, activeGroups: activeGroups.length, teachers, legacyPaymentsUnposted: unpostedPayments, needsReview },
  };
}
