// Finance V2 — earning bazasi va eligibility (reja §7.2–7.3):
//   base     = REAL_PAID_AMOUNT: allocation | FULL_PRICE_EQUIVALENT: allocation × original / final
//   eligible = holat (ARCHIVED/FROZEN include*) va davomat (NONE | PRESENT_RATIO) filtrlari
//   lessons=0 (PRESENT_RATIO) → NEEDS_REVIEW(NO_LESSONS_FOUND) — avtomatik to'liq maosh YO'Q (S9)

import type { FinanceDb } from "../db";
import type { EarningReviewReason } from "../constants";
import { proportionalShare, scaleByRatio } from "../money";
import type { YearMonth } from "../period";
import { intervalAt, statusIntervals } from "../billing/history";
import { attendanceRatio, type AttendanceRatio } from "./attendance";
import type { SalaryPolicyView } from "./policy";

export interface EligibilityInput {
  policy: SalaryPolicyView;
  allocationAmount: number;
  charge: { originalAmount: number; finalAmount: number; groupId: string | null; studentId: string; serviceMonth: YearMonth };
  /** allocation vaqti — o'quvchi holati shu lahzada */
  at: Date;
}

export interface EligibilityResult {
  base: number;
  eligible: number;
  studentStatus: string | null;
  attendance: AttendanceRatio | null;
  reviewReason: EarningReviewReason | null;
  notes: string[];
}

export async function computeEligibility(db: FinanceDb, i: EligibilityInput): Promise<EligibilityResult> {
  const notes: string[] = [];
  const base = i.policy.salaryBaseMode === "FULL_PRICE_EQUIVALENT" && i.charge.finalAmount > 0
    ? scaleByRatio(i.allocationAmount, i.charge.originalAmount, i.charge.finalAmount)
    : i.allocationAmount;
  if (base !== i.allocationAmount) notes.push(`base=${i.policy.salaryBaseMode}`);

  const statusIv = intervalAt(await statusIntervals(db, i.charge.studentId), i.at);
  const studentStatus = statusIv?.key ?? null;
  let eligible = base;
  if (studentStatus === "ARCHIVED" && !i.policy.includeArchivedStudents) { eligible = 0; notes.push("archived-excluded"); }
  if (studentStatus === "FROZEN" && !i.policy.includeFrozenStudents) { eligible = 0; notes.push("frozen-excluded"); }

  let attendance: AttendanceRatio | null = null;
  let reviewReason: EarningReviewReason | null = null;
  if (eligible > 0 && i.policy.attendanceMode === "PRESENT_RATIO" && i.charge.groupId) {
    attendance = await attendanceRatio(db, { studentId: i.charge.studentId, groupId: i.charge.groupId, serviceMonth: i.charge.serviceMonth, policy: i.policy });
    if (attendance.ratio) {
      eligible = proportionalShare(eligible, attendance.ratio.numerator, attendance.ratio.denominator);
    } else if (i.policy.noLessonsMode === "NO_LESSONS_AS_ZERO") {
      eligible = 0; notes.push("no-lessons-zero");
    } else if (i.policy.noLessonsMode === "NO_LESSONS_AS_FULL") {
      notes.push("no-lessons-full");
    } else {
      reviewReason = "NO_LESSONS_FOUND";
    }
  }
  return { base, eligible, studentStatus, attendance, reviewReason, notes };
}
