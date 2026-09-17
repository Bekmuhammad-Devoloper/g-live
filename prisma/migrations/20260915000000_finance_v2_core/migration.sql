-- CreateTable
CREATE TABLE "FinancialAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branchId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "openingBalance" INTEGER NOT NULL DEFAULT 0,
    "openingAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FinancialAccount_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FinancialAccount_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FinancialTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branchId" TEXT,
    "accountId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "occurredAt" DATETIME NOT NULL,
    "note" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinancialTransaction_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FinancialTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FinancialTransaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Transfer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromAccountId" TEXT NOT NULL,
    "toAccountId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "occurredAt" DATETIME NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DONE',
    "reversalOfId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transfer_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "FinancialAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transfer_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "FinancialAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transfer_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "Transfer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transfer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BillingPolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "branchId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "effectiveFrom" DATETIME NOT NULL,
    "effectiveTo" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "midMonthJoinMode" TEXT NOT NULL DEFAULT 'FULL_MONTH',
    "dueDay" INTEGER NOT NULL DEFAULT 1,
    "frozenFullMonthMode" TEXT NOT NULL DEFAULT 'ZERO_CHARGE',
    "noEnrollmentMode" TEXT NOT NULL DEFAULT 'NO_CHARGE',
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BillingPolicy_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BillingPolicy_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudentCharge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "branchId" TEXT,
    "groupId" TEXT,
    "programId" TEXT,
    "billingPolicyId" TEXT,
    "kind" TEXT NOT NULL,
    "serviceYear" INTEGER NOT NULL,
    "serviceMonth" INTEGER NOT NULL,
    "originalAmount" INTEGER NOT NULL,
    "discountAmount" INTEGER NOT NULL DEFAULT 0,
    "finalAmount" INTEGER NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "cancelledAt" DATETIME,
    "cancelReason" TEXT,
    "cancelledById" TEXT,
    "legacyPaymentId" TEXT,
    "chargeKey" TEXT NOT NULL,
    "replacesChargeId" TEXT,
    "adjustsChargeId" TEXT,
    "snapshot" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentCharge_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StudentCharge_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StudentCharge_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StudentCharge_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StudentCharge_billingPolicyId_fkey" FOREIGN KEY ("billingPolicyId") REFERENCES "BillingPolicy" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StudentCharge_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StudentCharge_legacyPaymentId_fkey" FOREIGN KEY ("legacyPaymentId") REFERENCES "Payment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StudentCharge_replacesChargeId_fkey" FOREIGN KEY ("replacesChargeId") REFERENCES "StudentCharge" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StudentCharge_adjustsChargeId_fkey" FOREIGN KEY ("adjustsChargeId") REFERENCES "StudentCharge" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StudentCharge_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudentDiscount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "groupId" TEXT,
    "type" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "effectiveFrom" DATETIME NOT NULL,
    "effectiveTo" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentDiscount_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StudentDiscount_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StudentDiscount_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paymentId" TEXT NOT NULL,
    "chargeId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "reversalOfId" TEXT,
    "refundId" TEXT,
    "source" TEXT NOT NULL,
    "allocatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotencyKey" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PaymentAllocation_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "StudentCharge" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PaymentAllocation_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "PaymentAllocation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PaymentAllocation_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PaymentAllocation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LegacyPaymentReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paymentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "receivedAt" DATETIME NOT NULL,
    "classification" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
    "resolution" TEXT,
    "evidence" TEXT NOT NULL,
    "reasons" TEXT NOT NULL,
    "suggestedMonth" TEXT,
    "reason" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LegacyPaymentReview_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LegacyPaymentReview_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "originalPaymentId" TEXT,
    "studentId" TEXT NOT NULL,
    "branchId" TEXT,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "financialAccountId" TEXT NOT NULL,
    "refundedAt" DATETIME NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'CASH_REFUND',
    "status" TEXT NOT NULL DEFAULT 'DONE',
    "reversalOfId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'V2',
    "legacyPaymentId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Refund_originalPaymentId_fkey" FOREIGN KEY ("originalPaymentId") REFERENCES "Payment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Refund_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Refund_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Refund_financialAccountId_fkey" FOREIGN KEY ("financialAccountId") REFERENCES "FinancialAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Refund_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "Refund" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Refund_legacyPaymentId_fkey" FOREIGN KEY ("legacyPaymentId") REFERENCES "Payment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Refund_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GroupTeacherAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MAIN',
    "effectiveFrom" DATETIME NOT NULL,
    "effectiveTo" DATETIME,
    "compensationRuleId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'KNOWN',
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GroupTeacherAssignment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GroupTeacherAssignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GroupTeacherAssignment_compensationRuleId_fkey" FOREIGN KEY ("compensationRuleId") REFERENCES "SalaryRule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GroupTeacherAssignment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudentStatusHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "effectiveFrom" DATETIME NOT NULL,
    "effectiveTo" DATETIME,
    "reason" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentStatusHistory_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentStatusHistory_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GroupStudentHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "effectiveFrom" DATETIME NOT NULL,
    "effectiveTo" DATETIME,
    "source" TEXT NOT NULL DEFAULT 'KNOWN',
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GroupStudentHistory_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GroupStudentHistory_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GroupStudentHistory_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SalaryPolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "branchId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "effectiveFrom" DATETIME NOT NULL,
    "effectiveTo" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "salaryBaseMode" TEXT NOT NULL DEFAULT 'REAL_PAID_AMOUNT',
    "attendanceMode" TEXT NOT NULL DEFAULT 'NONE',
    "attendanceCountedStatuses" TEXT NOT NULL DEFAULT 'PRESENT,LATE,ONLINE,MAKEUP',
    "requireConfirmedAttendance" BOOLEAN NOT NULL DEFAULT false,
    "noLessonsMode" TEXT NOT NULL DEFAULT 'NO_LESSONS_REVIEW',
    "assignmentSplitMode" TEXT NOT NULL DEFAULT 'REVIEW',
    "includeArchivedStudents" BOOLEAN NOT NULL DEFAULT true,
    "includeFrozenStudents" BOOLEAN NOT NULL DEFAULT true,
    "includeZeroAmounts" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalaryPolicy_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SalaryPolicy_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeacherEarning" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teacherId" TEXT NOT NULL,
    "studentId" TEXT,
    "sourcePaymentId" TEXT,
    "allocationId" TEXT,
    "chargeId" TEXT,
    "refundId" TEXT,
    "groupId" TEXT,
    "programId" TEXT,
    "branchId" TEXT,
    "policyId" TEXT,
    "ruleId" TEXT,
    "assignmentId" TEXT,
    "serviceYear" INTEGER,
    "serviceMonth" INTEGER,
    "receivedAt" DATETIME,
    "earningYear" INTEGER NOT NULL,
    "earningMonth" INTEGER NOT NULL,
    "settlementPeriodId" TEXT,
    "baseAmount" INTEGER NOT NULL DEFAULT 0,
    "eligibleAmount" INTEGER NOT NULL DEFAULT 0,
    "rateBp" INTEGER,
    "amount" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'POSTED',
    "reviewReason" TEXT,
    "reviewedAt" DATETIME,
    "reviewedById" TEXT,
    "snapshot" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "reversalOfId" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeacherEarning_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TeacherEarning_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TeacherEarning_sourcePaymentId_fkey" FOREIGN KEY ("sourcePaymentId") REFERENCES "Payment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TeacherEarning_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "PaymentAllocation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TeacherEarning_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "StudentCharge" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TeacherEarning_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TeacherEarning_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TeacherEarning_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TeacherEarning_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TeacherEarning_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "SalaryPolicy" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TeacherEarning_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "SalaryRule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TeacherEarning_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "GroupTeacherAssignment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TeacherEarning_settlementPeriodId_fkey" FOREIGN KEY ("settlementPeriodId") REFERENCES "SalaryPeriod" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TeacherEarning_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TeacherEarning_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "TeacherEarning" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TeacherEarning_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SalaryPeriod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teacherId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "fixedAmount" INTEGER NOT NULL DEFAULT 0,
    "commissionAmount" INTEGER NOT NULL DEFAULT 0,
    "bonusAmount" INTEGER NOT NULL DEFAULT 0,
    "kpiAmount" INTEGER NOT NULL DEFAULT 0,
    "penaltyAmount" INTEGER NOT NULL DEFAULT 0,
    "adjustmentAmount" INTEGER NOT NULL DEFAULT 0,
    "grossAmount" INTEGER NOT NULL DEFAULT 0,
    "paidAmount" INTEGER NOT NULL DEFAULT 0,
    "remainingAmount" INTEGER NOT NULL DEFAULT 0,
    "calculatedAt" DATETIME,
    "approvedAt" DATETIME,
    "approvedById" TEXT,
    "closedAt" DATETIME,
    "closedById" TEXT,
    "reopenedAt" DATETIME,
    "reopenedById" TEXT,
    "reopenReason" TEXT,
    "source" TEXT NOT NULL DEFAULT 'V2',
    "legacyFiksaAmount" INTEGER,
    "legacyTeacherSalaryId" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SalaryPeriod_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SalaryPeriod_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SalaryPeriod_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SalaryPeriod_reopenedById_fkey" FOREIGN KEY ("reopenedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SalaryPeriod_legacyTeacherSalaryId_fkey" FOREIGN KEY ("legacyTeacherSalaryId") REFERENCES "TeacherSalary" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SalaryPayout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teacherId" TEXT NOT NULL,
    "salaryPeriodId" TEXT NOT NULL,
    "financialAccountId" TEXT NOT NULL,
    "branchId" TEXT,
    "amount" INTEGER NOT NULL,
    "paidAt" DATETIME NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DONE',
    "reversalOfId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalaryPayout_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SalaryPayout_salaryPeriodId_fkey" FOREIGN KEY ("salaryPeriodId") REFERENCES "SalaryPeriod" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SalaryPayout_financialAccountId_fkey" FOREIGN KEY ("financialAccountId") REFERENCES "FinancialAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SalaryPayout_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SalaryPayout_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "SalaryPayout" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SalaryPayout_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FinancePeriodLock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branchId" TEXT,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "isLocked" BOOLEAN NOT NULL DEFAULT true,
    "lockedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedById" TEXT,
    "reason" TEXT NOT NULL,
    "reopenedAt" DATETIME,
    "reopenedById" TEXT,
    "reopenReason" TEXT,
    "lockKey" TEXT NOT NULL,
    CONSTRAINT "FinancePeriodLock_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FinancePeriodLock_lockedById_fkey" FOREIGN KEY ("lockedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FinancePeriodLock_reopenedById_fkey" FOREIGN KEY ("reopenedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Expense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'CASH',
    "recipient" TEXT,
    "note" TEXT,
    "categoryId" TEXT,
    "branchId" TEXT,
    "authorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "financialAccountId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "reversalOfId" TEXT,
    "idempotencyKey" TEXT,
    "receiptUrl" TEXT,
    "methodRaw" TEXT,
    "postedAt" DATETIME,
    CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Expense_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Expense_financialAccountId_fkey" FOREIGN KEY ("financialAccountId") REFERENCES "FinancialAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Expense_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "Expense" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Expense" ("amount", "authorId", "branchId", "categoryId", "createdAt", "date", "id", "method", "name", "note", "recipient", "updatedAt") SELECT "amount", "authorId", "branchId", "categoryId", "createdAt", "date", "id", "method", "name", "note", "recipient", "updatedAt" FROM "Expense";
DROP TABLE "Expense";
ALTER TABLE "new_Expense" RENAME TO "Expense";
CREATE UNIQUE INDEX "Expense_reversalOfId_key" ON "Expense"("reversalOfId");
CREATE UNIQUE INDEX "Expense_idempotencyKey_key" ON "Expense"("idempotencyKey");
CREATE INDEX "Expense_date_idx" ON "Expense"("date");
CREATE INDEX "Expense_categoryId_idx" ON "Expense"("categoryId");
CREATE INDEX "Expense_financialAccountId_date_idx" ON "Expense"("financialAccountId", "date");
CREATE TABLE "new_Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "purpose" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "transactionId" TEXT,
    "docNumber" TEXT,
    "receiptUrl" TEXT,
    "note" TEXT,
    "authorId" TEXT,
    "cancelledAt" DATETIME,
    "cancelReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "receivedAt" DATETIME,
    "branchId" TEXT,
    "financialAccountId" TEXT,
    "idempotencyKey" TEXT,
    "legacyRole" TEXT,
    "postedAt" DATETIME,
    "reversalOfId" TEXT,
    CONSTRAINT "Payment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Payment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Payment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Payment_financialAccountId_fkey" FOREIGN KEY ("financialAccountId") REFERENCES "FinancialAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Payment_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "Payment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Payment" ("amount", "authorId", "cancelReason", "cancelledAt", "createdAt", "docNumber", "id", "isManual", "method", "note", "purpose", "receiptUrl", "status", "studentId", "transactionId", "updatedAt") SELECT "amount", "authorId", "cancelReason", "cancelledAt", "createdAt", "docNumber", "id", "isManual", "method", "note", "purpose", "receiptUrl", "status", "studentId", "transactionId", "updatedAt" FROM "Payment";
DROP TABLE "Payment";
ALTER TABLE "new_Payment" RENAME TO "Payment";
CREATE UNIQUE INDEX "Payment_transactionId_key" ON "Payment"("transactionId");
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");
CREATE UNIQUE INDEX "Payment_reversalOfId_key" ON "Payment"("reversalOfId");
CREATE INDEX "Payment_studentId_idx" ON "Payment"("studentId");
CREATE INDEX "Payment_status_idx" ON "Payment"("status");
CREATE INDEX "Payment_receivedAt_idx" ON "Payment"("receivedAt");
CREATE INDEX "Payment_branchId_receivedAt_idx" ON "Payment"("branchId", "receivedAt");
CREATE TABLE "new_SalaryRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scope" TEXT NOT NULL DEFAULT 'ALL',
    "amountType" TEXT NOT NULL DEFAULT 'FIXED',
    "amount" INTEGER NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "targetId" TEXT,
    "targetName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "policyId" TEXT,
    "rateBp" INTEGER,
    "effectiveFrom" DATETIME,
    "effectiveTo" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "supersededById" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    CONSTRAINT "SalaryRule_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "SalaryPolicy" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SalaryRule_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "SalaryRule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SalaryRule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SalaryRule" ("amount", "amountType", "createdAt", "id", "isDefault", "scope", "targetId", "targetName") SELECT "amount", "amountType", "createdAt", "id", "isDefault", "scope", "targetId", "targetName" FROM "SalaryRule";
DROP TABLE "SalaryRule";
ALTER TABLE "new_SalaryRule" RENAME TO "SalaryRule";
CREATE UNIQUE INDEX "SalaryRule_supersededById_key" ON "SalaryRule"("supersededById");
CREATE INDEX "SalaryRule_scope_idx" ON "SalaryRule"("scope");
CREATE INDEX "SalaryRule_scope_targetId_effectiveFrom_idx" ON "SalaryRule"("scope", "targetId", "effectiveFrom");
CREATE INDEX "SalaryRule_policyId_idx" ON "SalaryRule"("policyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "FinancialAccount_branchId_type_idx" ON "FinancialAccount"("branchId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialTransaction_idempotencyKey_key" ON "FinancialTransaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "FinancialTransaction_accountId_occurredAt_idx" ON "FinancialTransaction"("accountId", "occurredAt");

-- CreateIndex
CREATE INDEX "FinancialTransaction_branchId_occurredAt_idx" ON "FinancialTransaction"("branchId", "occurredAt");

-- CreateIndex
CREATE INDEX "FinancialTransaction_referenceType_referenceId_idx" ON "FinancialTransaction"("referenceType", "referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialTransaction_referenceType_referenceId_accountId_direction_sequence_key" ON "FinancialTransaction"("referenceType", "referenceId", "accountId", "direction", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "Transfer_reversalOfId_key" ON "Transfer"("reversalOfId");

-- CreateIndex
CREATE UNIQUE INDEX "Transfer_idempotencyKey_key" ON "Transfer"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Transfer_occurredAt_idx" ON "Transfer"("occurredAt");

-- CreateIndex
CREATE INDEX "BillingPolicy_branchId_effectiveFrom_idx" ON "BillingPolicy"("branchId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "BillingPolicy_name_version_key" ON "BillingPolicy"("name", "version");

-- CreateIndex
CREATE UNIQUE INDEX "StudentCharge_legacyPaymentId_key" ON "StudentCharge"("legacyPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentCharge_chargeKey_key" ON "StudentCharge"("chargeKey");

-- CreateIndex
CREATE UNIQUE INDEX "StudentCharge_replacesChargeId_key" ON "StudentCharge"("replacesChargeId");

-- CreateIndex
CREATE INDEX "StudentCharge_studentId_serviceYear_serviceMonth_idx" ON "StudentCharge"("studentId", "serviceYear", "serviceMonth");

-- CreateIndex
CREATE INDEX "StudentCharge_groupId_serviceYear_serviceMonth_idx" ON "StudentCharge"("groupId", "serviceYear", "serviceMonth");

-- CreateIndex
CREATE INDEX "StudentCharge_branchId_serviceYear_serviceMonth_idx" ON "StudentCharge"("branchId", "serviceYear", "serviceMonth");

-- CreateIndex
CREATE INDEX "StudentCharge_status_dueDate_idx" ON "StudentCharge"("status", "dueDate");

-- CreateIndex
CREATE INDEX "StudentCharge_adjustsChargeId_idx" ON "StudentCharge"("adjustsChargeId");

-- CreateIndex
CREATE INDEX "StudentDiscount_studentId_effectiveFrom_idx" ON "StudentDiscount"("studentId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAllocation_idempotencyKey_key" ON "PaymentAllocation"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PaymentAllocation_paymentId_idx" ON "PaymentAllocation"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentAllocation_chargeId_idx" ON "PaymentAllocation"("chargeId");

-- CreateIndex
CREATE INDEX "PaymentAllocation_refundId_idx" ON "PaymentAllocation"("refundId");

-- CreateIndex
CREATE UNIQUE INDEX "LegacyPaymentReview_paymentId_key" ON "LegacyPaymentReview"("paymentId");

-- CreateIndex
CREATE INDEX "LegacyPaymentReview_status_idx" ON "LegacyPaymentReview"("status");

-- CreateIndex
CREATE INDEX "LegacyPaymentReview_studentId_idx" ON "LegacyPaymentReview"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_reversalOfId_key" ON "Refund"("reversalOfId");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_legacyPaymentId_key" ON "Refund"("legacyPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_idempotencyKey_key" ON "Refund"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Refund_originalPaymentId_idx" ON "Refund"("originalPaymentId");

-- CreateIndex
CREATE INDEX "Refund_studentId_refundedAt_idx" ON "Refund"("studentId", "refundedAt");

-- CreateIndex
CREATE INDEX "GroupTeacherAssignment_groupId_effectiveFrom_idx" ON "GroupTeacherAssignment"("groupId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "GroupTeacherAssignment_teacherId_effectiveFrom_idx" ON "GroupTeacherAssignment"("teacherId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "StudentStatusHistory_studentId_effectiveFrom_idx" ON "StudentStatusHistory"("studentId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "GroupStudentHistory_studentId_effectiveFrom_idx" ON "GroupStudentHistory"("studentId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "GroupStudentHistory_groupId_effectiveFrom_idx" ON "GroupStudentHistory"("groupId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "SalaryPolicy_branchId_effectiveFrom_idx" ON "SalaryPolicy"("branchId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryPolicy_name_version_key" ON "SalaryPolicy"("name", "version");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherEarning_idempotencyKey_key" ON "TeacherEarning"("idempotencyKey");

-- CreateIndex
CREATE INDEX "TeacherEarning_teacherId_earningYear_earningMonth_idx" ON "TeacherEarning"("teacherId", "earningYear", "earningMonth");

-- CreateIndex
CREATE INDEX "TeacherEarning_settlementPeriodId_idx" ON "TeacherEarning"("settlementPeriodId");

-- CreateIndex
CREATE INDEX "TeacherEarning_status_idx" ON "TeacherEarning"("status");

-- CreateIndex
CREATE INDEX "TeacherEarning_sourcePaymentId_idx" ON "TeacherEarning"("sourcePaymentId");

-- CreateIndex
CREATE INDEX "TeacherEarning_allocationId_idx" ON "TeacherEarning"("allocationId");

-- CreateIndex
CREATE INDEX "TeacherEarning_studentId_idx" ON "TeacherEarning"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherEarning_allocationId_assignmentId_type_key" ON "TeacherEarning"("allocationId", "assignmentId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryPeriod_legacyTeacherSalaryId_key" ON "SalaryPeriod"("legacyTeacherSalaryId");

-- CreateIndex
CREATE INDEX "SalaryPeriod_year_month_idx" ON "SalaryPeriod"("year", "month");

-- CreateIndex
CREATE INDEX "SalaryPeriod_status_idx" ON "SalaryPeriod"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryPeriod_teacherId_year_month_key" ON "SalaryPeriod"("teacherId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryPayout_reversalOfId_key" ON "SalaryPayout"("reversalOfId");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryPayout_idempotencyKey_key" ON "SalaryPayout"("idempotencyKey");

-- CreateIndex
CREATE INDEX "SalaryPayout_teacherId_paidAt_idx" ON "SalaryPayout"("teacherId", "paidAt");

-- CreateIndex
CREATE INDEX "SalaryPayout_salaryPeriodId_idx" ON "SalaryPayout"("salaryPeriodId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancePeriodLock_lockKey_key" ON "FinancePeriodLock"("lockKey");

-- CreateIndex
CREATE INDEX "FinancePeriodLock_year_month_idx" ON "FinancePeriodLock"("year", "month");

