import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Pre-cutover audit — statik qo'riqchi: har V2 server action SERVER SIDE ruxsat tekshiruvi bilan
// boshlanishi shart (requireFinancePermission / dvigatel RBAC funksiyasi / DIRECTOR tekshiruvi).
// Interfeysda yashirish yetarli emas — bu test yangi action qo'shilganda ham himoyani majburlaydi.

const FILE = path.resolve(__dirname, "../../src/app/(app)/finance/v2/actions.ts");
/** Dvigatel darajasida RBAC qiladigan funksiyalar (permissions.ts orqali) */
const ENGINE_RBAC = ["acceptPayment(", "createRefund(", "reversePayment(", "createExpense(", "reverseExpense(", "createTransfer(", "reverseTransfer(", "approveSalaryPeriod(", "createPayout(", "closeSalaryPeriod(", "reopenSalaryPeriod("];
/** Moliyaviy bo'lmagan yordamchilar */
const NON_FINANCIAL = new Set(["currentMonthKey"]);
/** Filial cheklovi talab qilinadigan (MANAGER o'z filiali) action'lar */
const BRANCH_SCOPED = ["acceptPaymentAction", "refundAction", "reversePaymentAction", "syncBillingAction", "manualDebtAction", "cancelChargeAction", "replaceChargeAction", "adjustChargeAction", "createDiscountAction", "endDiscountAction", "createExpenseAction", "reverseExpenseAction"];

describe("finance v2 server actions — RBAC static scan", () => {
  const src = readFileSync(FILE, "utf8");
  const parts = src.split(/\nexport async function /).slice(1);
  const actions = parts.map((p) => ({ name: p.slice(0, p.indexOf("(")), body: p }));

  it("har export qilingan action guard() + ruxsat tekshiruvi bilan", () => {
    expect(actions.length).toBeGreaterThanOrEqual(30);
    const missing = actions
      .filter((a) => !NON_FINANCIAL.has(a.name))
      .filter((a) => {
        // Flag'ni yoqish/o'chirish guard() dan o'tmaydi (aks holda yoqib bo'lmasdi) — sessiya + DIRECTOR shart
        const hasGuard = a.body.includes("await guard()") || (a.name === "setFinanceV2Enabled" && a.body.includes("await requireSession()"));
        const hasPerm = /requireFinancePermission\(\s*s\s*,\s*"[A-Z_]+"\s*\)/.test(a.body);
        const hasEngine = ENGINE_RBAC.some((f) => a.body.includes(f));
        const hasDirector = a.body.includes("ROLES.DIRECTOR");
        return !(hasGuard && (hasPerm || hasEngine || hasDirector));
      })
      .map((a) => a.name);
    expect(missing).toEqual([]);
  });

  it("filialga bog'liq action'larda MANAGER cheklovi server-side (assertBranchAccess / branchScope / dvigatel)", () => {
    const missing = BRANCH_SCOPED.filter((name) => {
      const a = actions.find((x) => x.name === name);
      if (!a) return true;
      const inAction = /assertBranchAccess|assertStudentBranch|assertChargeBranch|branchScope\(/.test(a.body);
      const inEngine = ENGINE_RBAC.some((f) => a.body.includes(f)); // dvigatel ichida assertBranchAccess
      return !(inAction || inEngine);
    });
    expect(missing).toEqual([]);
  });

  it("flag o'chiq bo'lsa hech bir action ishlamaydi (guard flag tekshiradi); flag faqat DIRECTOR tomonidan", () => {
    expect(src).toMatch(/async function guard\(\)[\s\S]*?enabled[\s\S]*?FinanceError/);
    const flagAction = actions.find((a) => a.name === "setFinanceV2Enabled")!;
    expect(flagAction.body).toContain("ROLES.DIRECTOR");
  });
});
