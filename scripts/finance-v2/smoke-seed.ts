// Finance V2 UI smoke seed: vaqtinchalik bazaga minimal ma'lumot + sessiya tokenlari.
// Ishlatish (scripts/finance-v2/smoke-routes.sh chaqiradi):
//   npx tsx scripts/finance-v2/smoke-seed.ts /abs/smoke.db > out.json
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";
import { acceptPayment } from "@/lib/finance/payments/accept";
import { createSalaryRule } from "@/lib/finance/salary/rules";
import { syncGroupTeacherAssignment } from "@/lib/finance/salary/assignments";
import { monthStart } from "@/lib/finance/period";
import { createExpense } from "@/lib/finance/expenses/expenses";
import { recalculateSalaryPeriod } from "@/lib/finance/salary/periods";

const p = new PrismaClient({ datasourceUrl: `file:${process.argv[2]}` });
async function main() {
  const branch = await p.branch.create({ data: { name: "Markaz" } });
  const d = await p.user.create({ data: { fullName: "Direktor", email: "d@smoke.local", passwordHash: "x", role: "DIRECTOR" } });
  const t = await p.user.create({ data: { fullName: "Akmal", email: "t@smoke.local", passwordHash: "x", role: "TEACHER", branchId: branch.id } });
  const prog = await p.program.create({ data: { name: "IELTS", monthlyFee: 1_000_000 } });
  const g = await p.group.create({ data: { name: "IELTS-12", programId: prog.id, branchId: branch.id, teacherId: t.id, createdAt: new Date("2026-08-01T05:00:00Z") } });
  const s = await p.student.create({ data: { fullName: "Ali Karimov", branchId: branch.id, eduStatus: "ACTIVE", createdAt: new Date("2026-08-01T05:00:00Z") } });
  await p.groupStudent.create({ data: { groupId: g.id, studentId: s.id, joinedAt: new Date("2026-08-01T05:00:00Z") } });
  await p.setting.create({ data: { key: "finance.v2.enabled", value: "true" } });
  await p.expenseCategory.create({ data: { name: "Ijara" } });
  await syncGroupTeacherAssignment(p, g.id, { at: new Date("2026-08-01T05:00:00Z"), cutoverAt: new Date("2026-07-31T19:00:00Z") });
  await createSalaryRule(p, { scope: "GLOBAL", component: "PERCENT", rateBp: 4000, effectiveFrom: monthStart({ year: 2026, month: 8 }) });
  const actor = { userId: d.id, role: "DIRECTOR", branchId: null };
  await acceptPayment(p, { studentId: s.id, amount: 1_500_000, method: "CASH", receivedAt: new Date(), purpose: "Kurs", idempotencyKey: "smoke-pay-0001" }, actor);
  await createExpense(p, { name: "Ijara", amount: 300_000, date: new Date(), method: "CASH", idempotencyKey: "smoke-exp-0001" }, actor);
  const now = new Date();
  const ym = { year: now.getFullYear(), month: now.getMonth() + 1 };
  await recalculateSalaryPeriod(p, t.id, ym, { userId: d.id });
  const period = await p.salaryPeriod.findFirstOrThrow({ where: { teacherId: t.id } });
  const secret = new TextEncoder().encode("smoke-secret");
  const jwt = await new SignJWT({ userId: d.id, role: "DIRECTOR", fullName: "Direktor", locale: "uz", branchId: null }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1d").sign(secret);
  const teacherJwt = await new SignJWT({ userId: t.id, role: "TEACHER", fullName: "Akmal", locale: "uz", branchId: branch.id }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1d").sign(secret);
  console.log(JSON.stringify({ jwt, teacherJwt, periodId: period.id, accountId: (await p.financialAccount.findFirstOrThrow()).id }));
}
main().finally(() => p.$disconnect());
