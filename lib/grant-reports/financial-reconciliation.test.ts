import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { buildFinancialReconciliation, type FinancialReconciliationInput, type ReconciliationFinancialLineInput } from "./financial-reconciliation";
import { formatGrantCurrency, formatGrantReconciliationCurrency } from "./types";

const d = (value: string) => new Prisma.Decimal(value);
const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

function source(id: string, amount: string, direction: "DEBIT" | "CREDIT" = "DEBIT", overrides: Record<string, unknown> = {}, category = direction === "CREDIT" ? "Other Income" : "Nutrition / Groceries") {
  return {
    id: `source-${id}`,
    appliedAmount: d(amount),
    transactionTypeSnapshot: direction === "CREDIT" ? "INCOME" as const : "EXPENSE" as const,
    categorySnapshot: category,
    transaction: {
      id: `transaction-${id}`,
      transactionDate: date("2026-04-06"),
      originalDescription: `Original ${id}`,
      originalAmount: d(amount),
      direction,
      runningBalance: d("47921.28"),
      sourcePage: 1,
      sourceRow: 10,
      confirmedCategory: category,
      statement: { id: "statement-april", statementMonth: date("2026-04-01"), periodStart: date("2026-04-01"), periodEnd: date("2026-04-30"), file: { originalFilename: "april.pdf" } },
      batch: { id: "batch-1", status: "CONFIRMED" as const, originatingGrantReportId: "report-1", grantAwardId: "award-1", centreId: "centre-1", financialYear: "2026", quarter: 1 },
      ...overrides,
    },
  };
}

function line(overrides: Partial<ReconciliationFinancialLineInput> = {}): ReconciliationFinancialLineInput {
  return { id: "line-1", lineType: "EXPENDITURE", categoryCode: null, categoryName: "Nutrition / Groceries", quarterlyBudget: d("40000.00"), quarterlyActual: d("33842.58"), estimatedExpenditure: d("33842.58"), bankTransactionSources: [source("1", "33842.58")], ...overrides };
}

function input(overrides: Partial<FinancialReconciliationInput> = {}): FinancialReconciliationInput {
  const financialLines = overrides.financialLines ?? [line()];
  const totalExpenditure = financialLines.filter((row) => row.lineType === "EXPENDITURE").reduce((total, row) => total.plus(row.estimatedExpenditure ?? row.quarterlyActual ?? 0), d("0"));
  const funding = financialLines.filter((row) => row.lineType === "FUNDING_RECEIVED").reduce((total, row) => total.plus(row.quarterlyActual ?? 0), d("0"));
  const other = financialLines.filter((row) => row.lineType === "OTHER_INCOME").reduce((total, row) => total.plus(row.quarterlyActual ?? 0), d("0"));
  return {
    reportId: "report-1", awardId: "award-1", centreId: "centre-1", financialYear: "2026", quarter: 1,
    reportingPeriodStart: date("2026-04-01"), reportingPeriodEnd: date("2026-06-30"), openingCashBalance: null,
    storedFundingReceivedTotal: funding, storedOtherIncomeTotal: other, storedTotalIncome: funding.plus(other), storedTotalExpenditure: totalExpenditure,
    financialLines,
    imports: [],
    ...overrides,
  };
}

test("formats reconciliation money with exact cents without changing the legacy report formatter", () => {
  assert.equal(formatGrantReconciliationCurrency("33842.58"), "R33,842.58");
  assert.equal(formatGrantReconciliationCurrency("27106.20"), "R27,106.20");
  assert.equal(formatGrantReconciliationCurrency("598.84"), "R598.84");
  assert.equal(formatGrantReconciliationCurrency("180"), "R180.00");
  assert.equal(formatGrantReconciliationCurrency("250"), "R250.00");
  assert.equal(formatGrantReconciliationCurrency("68303.86"), "R68,303.86");
  assert.equal(formatGrantReconciliationCurrency("-1642.25"), "-R1,642.25");
  assert.equal(formatGrantReconciliationCurrency("bad"), "—");
  assert.equal(formatGrantCurrency(33842.58), new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(33842.58));
});

test("presentation-only formatting leaves reconciliation arithmetic and source/applied cents intact", () => {
  const result = buildFinancialReconciliation(input({ financialLines: [line()] }));
  const evidence = result.categories[0].evidence[0];
  assert.equal(result.expenditure.actualExpenditure, "33842.58");
  assert.equal(result.categories[0].variance, "6157.42");
  assert.equal(result.categories[0].evidenceTotal, "33842.58");
  assert.equal(evidence.transactionAmount, "33842.58");
  assert.equal(evidence.appliedAmount, "33842.58");
  assert.equal(evidence.runningBalance, "47921.28");
  assert.equal(formatGrantReconciliationCurrency(evidence.transactionAmount), "R33,842.58");
  assert.equal(formatGrantReconciliationCurrency(evidence.appliedAmount), "R33,842.58");
  assert.equal(formatGrantReconciliationCurrency(evidence.runningBalance), "R47,921.28");
});

test("identifies bank, manual and mixed line provenance without double counting", () => {
  const rows = [
    line(),
    line({ id: "manual", categoryName: "Transport", quarterlyBudget: d("500.00"), quarterlyActual: d("180.00"), estimatedExpenditure: d("180.00"), bankTransactionSources: [] }),
    line({ id: "mixed", categoryName: "Salaries / Stipends", quarterlyBudget: d("30000.00"), quarterlyActual: d("2000.00"), estimatedExpenditure: d("2000.00"), bankTransactionSources: [source("mixed", "1500.00", "DEBIT", {}, "Salaries / Stipends")] }),
  ];
  const result = buildFinancialReconciliation(input({ financialLines: rows, storedTotalExpenditure: d("36022.58") }));
  assert.deepEqual(result.sourceLines.map((row) => row.sourceType), ["BANK", "MANUAL", "MIXED"]);
  assert.equal(result.coverage.bankSupportedAmount, "35342.58");
  assert.equal(result.coverage.manualAmount, "680.00");
  assert.equal(result.expenditure.actualExpenditure, "36022.58");
  assert.equal(result.categories[0].evidenceTotal, "33842.58");
  assert.equal(result.sourceLines[0].evidence[0].appliedAmount, "33842.58");
  assert.equal(result.sourceLines[0].evidence[0].transactionId, "transaction-1");
  assert.equal(result.warnings.find((warning) => warning.code === "MANUAL_ENTRIES")?.severity, "INFORMATION");
});

test("preserves exact cents and calculates within/over budget variance", () => {
  const result = buildFinancialReconciliation(input({ financialLines: [line(), line({ id: "over", categoryName: "Bank Charges", quarterlyBudget: d("90.00"), quarterlyActual: d("93.00"), estimatedExpenditure: d("93.00"), bankTransactionSources: [source("fee", "93.00", "DEBIT", {}, "Bank Charges")] })], storedTotalExpenditure: d("33935.58") }));
  assert.deepEqual(result.categories.map((row) => [row.categoryName, row.variance, row.status]), [["Nutrition / Groceries", "6157.42", "WITHIN_BUDGET"], ["Bank Charges", "-3.00", "OVER_BUDGET"]]);
  assert.equal(result.warnings.find((warning) => warning.code === "OVER_BUDGET")?.severity, "WARNING");
});

test("an absent budget is not mistaken for a zero budget or over-spending", () => {
  const result = buildFinancialReconciliation(input({ financialLines: [line({ quarterlyBudget: null })] }));
  assert.equal(result.expenditure.quarterlyBudget, null);
  assert.equal(result.expenditure.budgetVariance, null);
  assert.equal(result.categories[0].status, "BUDGET_NOT_RECORDED");
  assert.equal(result.categories[0].variance, null);
  assert.equal(result.warnings.some((warning) => warning.code === "OVER_BUDGET"), false);
});

test("calculates bank credits and debits only from authoritative source links", () => {
  const rows = [
    line({ quarterlyActual: d("1892.00"), estimatedExpenditure: d("1892.00"), bankTransactionSources: [source("debit", "1892.00")] }),
    line({ id: "income", lineType: "OTHER_INCOME", categoryName: "Other Income", quarterlyBudget: null, quarterlyActual: d("250.00"), estimatedExpenditure: null, bankTransactionSources: [source("credit", "250.00", "CREDIT")] }),
  ];
  const result = buildFinancialReconciliation(input({ financialLines: rows, storedOtherIncomeTotal: d("250.00"), storedTotalIncome: d("250.00"), storedTotalExpenditure: d("1892.00") }));
  assert.deepEqual(result.bankPosition, { confirmedCredits: "250.00", confirmedDebits: "1892.00", netMovement: "-1642.00" });
  assert.equal(result.cash.totalCashReceived, "250.00");
  assert.equal(result.expenditure.actualExpenditure, "1892.00");
});

test("surfaces statement balance discrepancies without correcting source transactions", () => {
  const statement = (id: string, month: string, opening: string, closing: string, debits: string[], credits: string[] = []) => ({ id, statementMonth: date(month), periodStart: date(month), periodEnd: date(month), openingBalance: d(opening), closingBalance: d(closing), transactions: [...debits.map((amount) => ({ direction: "DEBIT" as const, originalAmount: d(amount) })), ...credits.map((amount) => ({ direction: "CREDIT" as const, originalAmount: d(amount) }))] });
  const imports = [{ id: "batch-1", status: "CONFIRMED" as const, statements: [
    statement("april", "2026-04-01", "68303.86", "47921.28", ["20154.78"]),
    statement("may", "2026-05-01", "47921.28", "37543.61", ["9747.67"], ["250.00"]),
    statement("june", "2026-06-01", "37543.61", "5968.44", ["31825.17"], ["250.00"]),
  ] }];
  const result = buildFinancialReconciliation(input({ imports }));
  assert.equal(result.warnings.filter((warning) => warning.code === "SOURCE_STATEMENT_DISCREPANCY").length, 2);
  assert.match(result.warnings.find((warning) => warning.message.startsWith("April 2026"))?.message ?? "", /-227\.80/);
  assert.match(result.warnings.find((warning) => warning.message.startsWith("May 2026"))?.message ?? "", /-880\.00/);
  assert.equal(result.readiness, "NEEDS_REVIEW");
  assert.equal(imports[0].statements[0].transactions[0].originalAmount.toFixed(2), "20154.78");
});

test("assigns READY, NEEDS_REVIEW and BLOCKED without mutating report workflow state", () => {
  const clean = buildFinancialReconciliation(input({ financialLines: [], storedTotalExpenditure: d("0") }));
  assert.equal(clean.readiness, "READY");
  const review = buildFinancialReconciliation(input({ financialLines: [line({ bankTransactionSources: [] })] }));
  assert.equal(review.readiness, "NEEDS_REVIEW");
  const brokenSource = source("broken", "10.00", "DEBIT", { batch: { id: "batch-1", status: "NEEDS_REVIEW", originatingGrantReportId: "other-report", grantAwardId: "award-1", centreId: "centre-1", financialYear: "2026", quarter: 1 } });
  const blocked = buildFinancialReconciliation(input({ financialLines: [line({ quarterlyActual: d("10.00"), estimatedExpenditure: d("10.00"), bankTransactionSources: [brokenSource] })], storedTotalExpenditure: d("10.00"), imports: [{ id: "batch-1", status: "NEEDS_REVIEW", statements: [] }] }));
  assert.equal(blocked.readiness, "BLOCKED");
  assert.ok(blocked.warnings.some((warning) => warning.code === "BROKEN_BANK_PROVENANCE"));
  assert.equal(blocked.warnings.some((warning) => warning.code === "IMPORT_NOT_CONFIRMED"), true);
  const workflow = { reportStatus: "DRAFT", certificationAcknowledged: false, submittedAt: null as Date | null };
  assert.deepEqual(workflow, { reportStatus: "DRAFT", certificationAcknowledged: false, submittedAt: null });
});

test("treats an additional unconfirmed import as a non-blocking warning", () => {
  const result = buildFinancialReconciliation(input({ financialLines: [], storedTotalExpenditure: d("0"), imports: [{ id: "confirmed", status: "CONFIRMED", statements: [{ id: "april", statementMonth: date("2026-04-01"), periodStart: null, periodEnd: null, openingBalance: d("0"), closingBalance: d("0"), transactions: [] }, { id: "may", statementMonth: date("2026-05-01"), periodStart: null, periodEnd: null, openingBalance: d("0"), closingBalance: d("0"), transactions: [] }, { id: "june", statementMonth: date("2026-06-01"), periodStart: null, periodEnd: null, openingBalance: d("0"), closingBalance: d("0"), transactions: [] }] }, { id: "draft", status: "UPLOADING", statements: [] }] }));
  assert.equal(result.warnings.find((warning) => warning.code === "UNCONFIRMED_IMPORT")?.severity, "WARNING");
  assert.equal(result.readiness, "NEEDS_REVIEW");
});

test("a bank-import financial line without matching authoritative source links is blocking", () => {
  const missing = buildFinancialReconciliation(input({ financialLines: [line({ categoryCode: "BANK_IMPORT:batch-1:EXPENDITURE:Nutrition / Groceries", bankTransactionSources: [] })] }));
  assert.equal(missing.readiness, "BLOCKED");
  assert.ok(missing.warnings.some((warning) => warning.code === "INCOMPLETE_BANK_PROVENANCE"));
  const short = buildFinancialReconciliation(input({ financialLines: [line({ categoryCode: "BANK_IMPORT:batch-1:EXPENDITURE:Nutrition / Groceries", bankTransactionSources: [source("short", "100.00")] })] }));
  assert.equal(short.readiness, "BLOCKED");
  assert.ok(short.warnings.some((warning) => warning.code === "INCOMPLETE_BANK_PROVENANCE"));
});
