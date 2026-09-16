// Finance V2 jadvallari — sonlar va pul yig'indilari (JSON). Idempotency (A vs B) va hisobot uchun.
//   npx tsx scripts/finance-v2/v2-counts.ts --db /abs/copy.db [--out a.json]
import { writeFileSync } from "node:fs";
import { openSqlite, tableExists } from "@/lib/finance/ops/sqlite";
import { fail, parseArgs, resolveDbPath } from "./_cli";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const db = openSqlite(resolveDbPath(args));
  const num = (v: unknown) => Number(v ?? 0);
  const q = async (sql: string) => (await db.$queryRawUnsafe<Record<string, unknown>[]>(sql)).map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "bigint" ? Number(v) : v])));
  const one = async (sql: string) => { const r = await q(sql); return num(r[0] ? Object.values(r[0])[0] : 0); };
  try {
    const out: Record<string, unknown> = {};
    const has = async (t: string) => tableExists(db, t);
    out.legacy = {
      Student: await one(`select count(*) from Student`), Group: await one(`select count(*) from "Group"`), GroupStudent: await one(`select count(*) from GroupStudent`),
      Payment: await one(`select count(*) from Payment`), PaymentPaidTotal: await one(`select coalesce(sum(amount),0) from Payment where status='PAID'`),
      PaymentPendingTotal: await one(`select coalesce(sum(amount),0) from Payment where status='PENDING'`),
      PaymentByStatus: await q(`select status, count(*) n, coalesce(sum(amount),0) total from Payment group by status order by status`),
      Expense: await one(`select count(*) from Expense`), ExpenseTotal: await one(`select coalesce(sum(amount),0) from Expense`),
      TeacherSalary: await one(`select count(*) from TeacherSalary`), TeacherSalaryFiksaTotal: await one(`select coalesce(sum(fiksa+bonus+kpi-penalty),0) from TeacherSalary`),
      SalaryRule: await one(`select count(*) from SalaryRule`), AuditLog: await one(`select count(*) from AuditLog`),
    };
    if (!(await has("StudentCharge"))) { out.v2 = null; console.log(JSON.stringify(out)); return; }
    out.v2 = {
      PaymentPosted: await one(`select count(*) from Payment where postedAt is not null`),
      PaymentPostedTotal: await one(`select coalesce(sum(amount),0) from Payment where postedAt is not null`),
      PaymentWithBranch: await one(`select count(*) from Payment where branchId is not null`),
      StudentCharge: await one(`select count(*) from StudentCharge`),
      StudentChargeByKindStatus: await q(`select kind, status, count(*) n, coalesce(sum(finalAmount),0) total from StudentCharge group by kind, status order by kind, status`),
      StudentChargeFinalTotal: await one(`select coalesce(sum(finalAmount),0) from StudentCharge where status <> 'CANCELLED'`),
      PaymentAllocation: await one(`select count(*) from PaymentAllocation`),
      PaymentAllocationByKind: await q(`select kind, source, count(*) n, coalesce(sum(amount),0) total from PaymentAllocation group by kind, source order by kind, source`),
      AllocationTotal: await one(`select coalesce(sum(case when kind='ALLOCATION' then amount else 0 end),0) - coalesce(sum(case when kind='REVERSAL' then amount else 0 end),0) from PaymentAllocation`),
      StudentCreditTotal: await one(`select coalesce(sum(p.amount),0) - coalesce((select sum(case when kind='ALLOCATION' then amount else -amount end) from PaymentAllocation),0) from Payment p where p.postedAt is not null and p.status='PAID'`),
      Refund: await one(`select count(*) from Refund`), RefundTotal: await one(`select coalesce(sum(amount),0) from Refund`),
      TeacherEarning: await one(`select count(*) from TeacherEarning`),
      TeacherEarningByTypeStatus: await q(`select type, status, count(*) n, coalesce(sum(amount),0) total from TeacherEarning group by type, status order by type, status`),
      TeacherEarningNeedsReview: await one(`select count(*) from TeacherEarning where status='NEEDS_REVIEW'`),
      TeacherEarningReviewReasons: await q(`select reviewReason, count(*) n from TeacherEarning where status='NEEDS_REVIEW' group by reviewReason`),
      SalaryPeriod: await one(`select count(*) from SalaryPeriod`), SalaryPeriodByStatus: await q(`select status, count(*) n, coalesce(sum(grossAmount),0) gross, coalesce(sum(paidAmount),0) paid from SalaryPeriod group by status`),
      SalaryPayout: await one(`select count(*) from SalaryPayout`),
      ExpensePosted: await one(`select count(*) from Expense where postedAt is not null`), ExpensePostedTotal: await one(`select coalesce(sum(amount),0) from Expense where postedAt is not null`),
      FinancialAccount: await one(`select count(*) from FinancialAccount`),
      FinancialTransaction: await one(`select count(*) from FinancialTransaction`),
      LedgerByType: await q(`select type, direction, count(*) n, coalesce(sum(amount),0) total from FinancialTransaction group by type, direction order by type, direction`),
      LedgerIn: await one(`select coalesce(sum(amount),0) from FinancialTransaction where direction='IN'`), LedgerOut: await one(`select coalesce(sum(amount),0) from FinancialTransaction where direction='OUT'`),
      GroupStudentHistory: await one(`select count(*) from GroupStudentHistory`), GroupStudentHistoryBySource: await q(`select source, count(*) n from GroupStudentHistory group by source`),
      GroupTeacherAssignment: await one(`select count(*) from GroupTeacherAssignment`), GroupTeacherAssignmentBySource: await q(`select source, role, count(*) n from GroupTeacherAssignment group by source, role`),
      StudentStatusHistory: await one(`select count(*) from StudentStatusHistory`),
      BillingPolicy: await one(`select count(*) from BillingPolicy`), SalaryPolicy: await one(`select count(*) from SalaryPolicy`),
      AuditLogFinance: await one(`select count(*) from AuditLog where entityType in ('Payment','PaymentAllocation','Refund','StudentCharge','StudentDiscount','BillingPolicy','SalaryPolicy','SalaryRule','GroupTeacherAssignment','TeacherEarning','SalaryPeriod','SalaryPayout','FinancialAccount','Transfer','Expense','FinancePeriodLock','FinancialTransaction')`),
      // Dublikat tekshiruvi — unique kalitlar bo'yicha (0 bo'lishi shart)
      DupChargeKeys: await one(`select count(*) from (select chargeKey from StudentCharge group by chargeKey having count(*)>1)`),
      DupAllocationKeys: await one(`select count(*) from (select idempotencyKey from PaymentAllocation group by idempotencyKey having count(*)>1)`),
      DupEarningKeys: await one(`select count(*) from (select idempotencyKey from TeacherEarning where idempotencyKey is not null group by idempotencyKey having count(*)>1)`),
      DupLedgerKeys: await one(`select count(*) from (select idempotencyKey from FinancialTransaction group by idempotencyKey having count(*)>1)`),
      DupPaymentKeys: await one(`select count(*) from (select idempotencyKey from Payment where idempotencyKey is not null group by idempotencyKey having count(*)>1)`),
      DupExpenseKeys: await one(`select count(*) from (select idempotencyKey from Expense where idempotencyKey is not null group by idempotencyKey having count(*)>1)`),
      // Invariantlar
      OverAllocatedPayments: await one(`select count(*) from (select p.id, p.amount, coalesce(sum(case when a.kind='ALLOCATION' then a.amount else -a.amount end),0) alloc from Payment p join PaymentAllocation a on a.paymentId=p.id group by p.id having alloc > p.amount)`),
      OverRefundedPayments: await one(`select count(*) from (select p.id, p.amount, coalesce(sum(r.amount),0) ref from Payment p join Refund r on r.paymentId=p.id and r.status='DONE' group by p.id having ref > p.amount)`),
      OverPaidCharges: await one(`select count(*) from (select c.id, c.finalAmount, coalesce(sum(case when a.kind='ALLOCATION' then a.amount else -a.amount end),0) alloc from StudentCharge c join PaymentAllocation a on a.chargeId=c.id group by c.id having alloc > c.finalAmount)`),
      OverPaidPeriods: await one(`select count(*) from SalaryPeriod where paidAmount > grossAmount and grossAmount >= 0`),
      LedgerTransferImbalance: await one(`select coalesce(sum(case when type='TRANSFER_IN' then amount else 0 end),0) - coalesce(sum(case when type='TRANSFER_OUT' then amount else 0 end),0) from FinancialTransaction`),
    };
    const s = JSON.stringify(out, null, 2);
    if (typeof args.out === "string") writeFileSync(args.out, s);
    console.log(s);
  } finally {
    await db.$disconnect();
  }
}
main().catch((e) => fail(String(e?.stack ?? e)));
