// Finance V2 — SalaryRule (versiyali). Priority: assignment → STUDENT → TEACHER →
// GROUP → COURSE → BRANCH → GLOBAL (RULE 8). Xizmat oyi bo'yicha resolve;
// qoida joyida o'zgartirilmaydi — yangisi eskisini `supersededById` bilan yopadi.
// Legacy qatorlar: scope "ALL" = GLOBAL, effectiveFrom null = createdAt oyi,
// PERCENT rateBp null = amount×100.

import type { SalaryRule } from "@prisma/client";

import { ASSIGNMENT_RULE_SCOPE, LEGACY_SCOPE_ALL, SALARY_RULE_PRIORITY, SALARY_RULE_SCOPES, SUPPORTED_COMPENSATION_TYPES, type SalaryRuleScope } from "../constants";
import type { FinanceDb } from "../db";
import { FinanceError } from "../errors";
import { financeAudit } from "../audit";
import { assertMoney, assertRateBp, percentToBp } from "../money";
import { floorToTashkentMonth, isTashkentMonthStart, monthStart, type YearMonth } from "../period";

export type CompensationComponent = "PERCENT" | "FIXED";

export type RuleScope = SalaryRuleScope | typeof ASSIGNMENT_RULE_SCOPE;

export interface RuleView {
  id: string;
  scope: RuleScope;
  targetId: string | null;
  component: CompensationComponent;
  /** PERCENT: bp */
  rateBp: number | null;
  /** FIXED: so'm/oy */
  fixedAmount: number | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  policyId: string | null;
  legacy: boolean;
}

export function toRuleView(r: SalaryRule): RuleView {
  const scope = (r.scope === LEGACY_SCOPE_ALL ? "GLOBAL" : r.scope) as RuleScope;
  const component = (r.amountType === "PERCENT" ? "PERCENT" : "FIXED") as CompensationComponent;
  const legacy = r.effectiveFrom === null;
  return {
    id: r.id, scope, targetId: r.targetId, component,
    rateBp: component === "PERCENT" ? (r.rateBp ?? percentToBp(r.amount)) : null,
    fixedAmount: component === "FIXED" ? r.amount : null,
    effectiveFrom: r.effectiveFrom ?? floorToTashkentMonth(r.createdAt), effectiveTo: r.effectiveTo, policyId: r.policyId, legacy,
  };
}

export interface CreateRuleInput {
  /** GLOBAL | BRANCH | COURSE | GROUP | TEACHER | STUDENT | ASSIGNMENT (faqat assignment orqali, supersede yo'q) */
  scope: RuleScope;
  /** GLOBAL uchun null; BRANCH → branchId, COURSE → programId, GROUP → groupId, TEACHER → userId, STUDENT → studentId, ASSIGNMENT → teacherId */
  targetId?: string | null;
  targetName?: string | null;
  component: CompensationComponent;
  /** PERCENT: bp (4000 = 40%) */
  rateBp?: number;
  /** FIXED: so'm/oy */
  fixedAmount?: number;
  effectiveFrom: Date;
  policyId?: string | null;
  note?: string | null;
  actorId?: string | null;
}

/** Yangi qoida; shu (scope, target, component) bo'yicha ochiq eski qoida yopiladi (supersede) */
export async function createSalaryRule(db: FinanceDb, i: CreateRuleInput): Promise<SalaryRule> {
  if (!(SALARY_RULE_SCOPES as readonly string[]).includes(i.scope) && i.scope !== ASSIGNMENT_RULE_SCOPE) throw new FinanceError("validation", `scope noto'g'ri: ${i.scope}`);
  if (!(SUPPORTED_COMPENSATION_TYPES as readonly string[]).includes(i.component)) throw new FinanceError("validation", "Faqat FIXED yoki PERCENT");
  if (i.scope !== "GLOBAL" && !i.targetId) throw new FinanceError("validation", `${i.scope} uchun targetId kerak`);
  if (!isTashkentMonthStart(i.effectiveFrom)) throw new FinanceError("validation", "effectiveFrom Tashkent oy boshi bo'lishi kerak");
  let rateBp: number | null = null;
  let amount = 0;
  if (i.component === "PERCENT") {
    if (i.rateBp === undefined) throw new FinanceError("validation", "PERCENT uchun rateBp kerak");
    rateBp = assertRateBp(i.rateBp);
    amount = Math.round(rateBp / 100); // legacy `amount` (%) — eski UI uchun ko'rinish
  } else {
    if (i.fixedAmount === undefined) throw new FinanceError("validation", "FIXED uchun fixedAmount kerak");
    amount = assertMoney(i.fixedAmount, "fiks summa");
  }
  const targetId = i.scope === "GLOBAL" ? null : i.targetId!;
  // ASSIGNMENT qoidalari bir-birini yopmaydi (har assignment o'ziniki)
  const open = i.scope === ASSIGNMENT_RULE_SCOPE ? [] : await db.salaryRule.findMany({
    where: { isActive: true, effectiveTo: null, amountType: i.component, targetId, scope: i.scope === "GLOBAL" ? { in: ["GLOBAL", LEGACY_SCOPE_ALL] } : i.scope },
  });
  for (const prev of open) {
    const prevFrom = prev.effectiveFrom ?? floorToTashkentMonth(prev.createdAt);
    if (prevFrom >= i.effectiveFrom) throw new FinanceError("validation", "Yangi qoida oldingisidan keyingi oydan boshlanishi kerak", { prevRuleId: prev.id });
  }
  const created = await db.salaryRule.create({
    data: {
      scope: i.scope, targetId, targetName: i.targetName ?? null, amountType: i.component, amount, rateBp, effectiveFrom: i.effectiveFrom,
      policyId: i.policyId ?? null, isDefault: i.scope === "GLOBAL", note: i.note ?? null, createdById: i.actorId ?? null,
    },
  });
  for (const prev of open) {
    await db.salaryRule.update({ where: { id: prev.id }, data: { effectiveTo: i.effectiveFrom, supersededById: created.id, isDefault: false } });
  }
  await financeAudit(db, { actorId: i.actorId, action: "CREATE", entityType: "SalaryRule", entityId: created.id, oldValue: open.length ? { superseded: open.map((r) => r.id) } : null, newValue: toRuleView(created), reason: i.note ?? null });
  return created;
}

/** Qoidani muddat bilan yopish (o'chirilmaydi) */
export async function endSalaryRule(db: FinanceDb, id: string, effectiveTo: Date, actorId?: string | null, reason?: string): Promise<SalaryRule> {
  if (!isTashkentMonthStart(effectiveTo)) throw new FinanceError("validation", "effectiveTo Tashkent oy boshi bo'lishi kerak");
  const r = await db.salaryRule.findUnique({ where: { id } });
  if (!r) throw new FinanceError("not_found", "Qoida topilmadi");
  if (r.effectiveTo) throw new FinanceError("state", "Qoida allaqachon yopilgan");
  const updated = await db.salaryRule.update({ where: { id }, data: { effectiveTo, isActive: false } });
  await financeAudit(db, { actorId, action: "END", entityType: "SalaryRule", entityId: id, newValue: { effectiveTo }, reason: reason ?? null });
  return updated;
}

export interface RuleContext {
  serviceMonth: YearMonth;
  studentId?: string | null;
  teacherId?: string | null;
  groupId?: string | null;
  programId?: string | null;
  branchId?: string | null;
  /** assignment darajasidagi qoida — eng ustun */
  assignmentRuleId?: string | null;
}

function activeAt(r: RuleView, at: Date): boolean {
  return r.effectiveFrom <= at && (r.effectiveTo === null || r.effectiveTo > at);
}

/** Bir darajada bir nechta bo'lsa: eng yangi effectiveFrom, keyin eng yangi qator */
function pick(rules: (RuleView & { createdAt: Date })[]): RuleView | null {
  return rules.sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime() || b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null;
}

/**
 * Komponent (PERCENT yoki FIXED) uchun qoida — xizmat oyi boshida faol bo'lganlar
 * ichidan eng aniq scope yutadi. Topilmasa null.
 */
export async function resolveRule(db: FinanceDb, ctx: RuleContext, component: CompensationComponent): Promise<RuleView | null> {
  const at = monthStart(ctx.serviceMonth);
  if (ctx.assignmentRuleId) {
    const r = await db.salaryRule.findUnique({ where: { id: ctx.assignmentRuleId } });
    if (r && r.amountType === component) {
      const v = toRuleView(r);
      if (activeAt(v, at)) return v;
    }
  }
  const targets: Record<SalaryRuleScope, string | null | undefined> = {
    STUDENT: ctx.studentId, TEACHER: ctx.teacherId, GROUP: ctx.groupId, COURSE: ctx.programId, BRANCH: ctx.branchId, GLOBAL: null,
  };
  // isActive filtri YO'Q: yopilgan qoida ham o'z davri (effectiveFrom..effectiveTo) uchun tarixan amal qiladi
  const rows = await db.salaryRule.findMany({ where: { amountType: component } });
  const views = rows.map((r) => ({ ...toRuleView(r), createdAt: r.createdAt })).filter((v) => activeAt(v, at));
  for (const scope of SALARY_RULE_PRIORITY) {
    const target = targets[scope];
    if (scope !== "GLOBAL" && !target) continue;
    const hit = pick(views.filter((v) => v.scope === scope && (scope === "GLOBAL" ? true : v.targetId === target)));
    if (hit) return hit;
  }
  return null;
}

/** Sozlamalar UI: barcha qoidalar (faol va tarixiy) */
export async function listSalaryRules(db: FinanceDb): Promise<RuleView[]> {
  const rows = await db.salaryRule.findMany({ orderBy: [{ scope: "asc" }, { createdAt: "desc" }] });
  return rows.map(toRuleView);
}
