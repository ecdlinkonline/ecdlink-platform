import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { calculateGrantBankPostingTotals, mapConfirmedTransactionToCashFlow } from "./bank-transaction-posting";
import { postGrantBankTransactionsToCashFlow } from "@/lib/services/grant-bank-imports";

test("confirmed income and expense categories map by both category, type and direction", () => {
  assert.deepEqual(mapConfirmedTransactionToCashFlow({ direction: "CREDIT", confirmedType: "INCOME", confirmedCategory: "Funding / Subsidy Income" }), {
    treatment: "CASH_RECEIVED", lineType: "FUNDING_RECEIVED", reportCategory: "Funding / Subsidy Income", safe: true, reason: null,
  });
  assert.deepEqual(mapConfirmedTransactionToCashFlow({ direction: "DEBIT", confirmedType: "EXPENSE", confirmedCategory: "Salaries / Stipends" }), {
    treatment: "OPERATING_EXPENSE", lineType: "EXPENDITURE", reportCategory: "Salaries / Stipends", safe: true, reason: null,
  });
  assert.equal(mapConfirmedTransactionToCashFlow({ direction: "DEBIT", confirmedType: "INCOME", confirmedCategory: "Funding / Subsidy Income" }).safe, false);
  assert.equal(mapConfirmedTransactionToCashFlow({ direction: "DEBIT", confirmedType: "BANK_CHARGE", confirmedCategory: "Salaries / Stipends" }).safe, false);
});

test("explicit Other or Unclassified remains visible and maps only by its confirmed bank direction", () => {
  const debit = mapConfirmedTransactionToCashFlow({ direction: "DEBIT", confirmedType: "UNKNOWN", confirmedCategory: "Other / Unclassified" });
  const credit = mapConfirmedTransactionToCashFlow({ direction: "CREDIT", confirmedType: "UNKNOWN", confirmedCategory: "Other / Unclassified" });
  assert.deepEqual({ treatment: debit.treatment, category: debit.reportCategory }, { treatment: "OPERATING_EXPENSE", category: "Other / Unclassified" });
  assert.deepEqual({ treatment: credit.treatment, category: credit.reportCategory }, { treatment: "CASH_RECEIVED", category: "Other / Unclassified" });
});

test("transfers, reversals and incompatible direction mappings block posting", () => {
  for (const input of [
    { direction: "DEBIT" as const, confirmedType: "TRANSFER" as const, confirmedCategory: "Transfer" },
    { direction: "CREDIT" as const, confirmedType: "REVERSAL_REFUND" as const, confirmedCategory: "Refund / Reversal" },
    { direction: "CREDIT" as const, confirmedType: "EXPENSE" as const, confirmedCategory: "Transport" },
  ]) assert.equal(mapConfirmedTransactionToCashFlow(input).treatment, "NEEDS_POSTING_REVIEW");
});

test("posting totals retain exact cents and preserve source inconsistencies", () => {
  const rows = [
    { direction: "CREDIT" as const, amount: new Prisma.Decimal("1000.10"), mapping: mapConfirmedTransactionToCashFlow({ direction: "CREDIT", confirmedType: "INCOME", confirmedCategory: "Other Income" }) },
    { direction: "DEBIT" as const, amount: new Prisma.Decimal("800.03"), mapping: mapConfirmedTransactionToCashFlow({ direction: "DEBIT", confirmedType: "EXPENSE", confirmedCategory: "Transport" }) },
    { direction: "DEBIT" as const, amount: new Prisma.Decimal("0.07"), mapping: mapConfirmedTransactionToCashFlow({ direction: "DEBIT", confirmedType: "TRANSFER", confirmedCategory: "Transfer" }) },
  ];
  const totals = calculateGrantBankPostingTotals(rows);
  assert.equal(totals.confirmedCredits.toFixed(2), "1000.10");
  assert.equal(totals.confirmedDebits.toFixed(2), "800.10");
  assert.equal(totals.proposedCashReceived.toFixed(2), "1000.10");
  assert.equal(totals.proposedOperatingExpenses.toFixed(2), "800.03");
  assert.equal(totals.netMovement.toFixed(2), "200.00");
  assert.equal(totals.unmapped, 1);
});

test("posting remains explicit, transactional, idempotent and source-linked", () => {
  const service = readFileSync("lib/services/grant-bank-imports.ts", "utf8");
  const posting = service.slice(service.indexOf("function buildGrantBankPostingPreview"));
  assert.match(posting, /status !== "READY_FOR_CONFIRMATION"/);
  assert.match(posting, /TransactionIsolationLevel\.Serializable/);
  assert.match(posting, /grantReportBankTransactionSource\.createMany/);
  assert.match(posting, /grantReportFinancialLine\.create/);
  assert.match(posting, /status: "CONFIRMED"/);
  assert.match(posting, /grant\.bank_import\.transactions\.posted/);
  assert.match(posting, /if \(preview\.posted && batch\.status === "CONFIRMED"\) return preview/);
  assert.doesNotMatch(posting, /grantBankTransaction\.(?:update|delete)/);
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  assert.match(schema, /@@unique\(\[grantReportVersionId, grantBankTransactionId\], map: "GrantReportBankSource_version_transaction_key"\)/);
});

test("the posting endpoint preserves database authorization and origin validation", () => {
  const route = readFileSync("app/api/grant-reports/[reportId]/bank-import/[importId]/posting/route.ts", "utf8");
  assert.match(route, /requireReportAdmin\(\)/);
  assert.match(route, /requireTrustedOrigin\(request\)/);
  assert.doesNotMatch(route, /unsafeMetadata|publicMetadata|sessionClaims/);
});

test("manual cash-flow saves cannot remove bank-linked financial lines", () => {
  const service = readFileSync("lib/services/grant-reports.ts", "utf8");
  assert.match(service, /bankTransactionSources: true/);
  assert.match(service, /_count\.bankTransactionSources > 0/);
});

test("the real posting service creates source-linked lines without updating manual lines", async () => {
  const period = { financialYear: "2026", quarter: 1, reportingPeriodStart: new Date("2026-04-01"), reportingPeriodEnd: new Date("2026-06-30") };
  const award = { id: "award-1", centreId: "centre-1", awardNumber: "AW-1", title: "Award", currency: "ZAR", centre: { centreName: "Centre" } };
  const transactionRows = [
    { id: "transaction-credit", transactionDate: new Date("2026-04-02"), originalDescription: "Department subsidy", originalAmount: new Prisma.Decimal("1000.25"), direction: "CREDIT", runningBalance: new Prisma.Decimal("1000.25"), sourcePage: 1, sourceRow: 2, suggestedType: "INCOME", suggestedCategory: "Funding / Subsidy Income", suggestedConfidence: new Prisma.Decimal("0.94"), confirmedType: "INCOME", confirmedCategory: "Funding / Subsidy Income", reviewStatus: "REVIEWED", reviewedAt: new Date() },
    { id: "transaction-debit", transactionDate: new Date("2026-04-03"), originalDescription: "Monthly Account Fee", originalAmount: new Prisma.Decimal("93.00"), direction: "DEBIT", runningBalance: new Prisma.Decimal("907.25"), sourcePage: 1, sourceRow: 3, suggestedType: "BANK_CHARGE", suggestedCategory: "Bank Charges", suggestedConfidence: new Prisma.Decimal("0.99"), confirmedType: "BANK_CHARGE", confirmedCategory: "Bank Charges", reviewStatus: "REVIEWED", reviewedAt: new Date() },
  ];
  let status = "READY_FOR_CONFIRMATION";
  const batch = () => ({ id: "import-1", grantAwardId: award.id, centreId: award.centreId, originatingGrantReportId: "report-1", ...period, currency: "ZAR", status, award, originatingReport: { id: "report-1", grantAwardId: award.id }, statements: [{ id: "statement-1", file: { originalFilename: "statement.pdf", mimeType: "application/pdf", fileSize: 100, uploadedByUserId: "admin-1" }, transactions: transactionRows, processingAttempts: [], _count: { transactions: 2, processingAttempts: 1 }, extractionStatus: "EXTRACTED", statementMonth: new Date("2026-04-01"), periodStart: period.reportingPeriodStart, periodEnd: period.reportingPeriodEnd, statementDate: null, bankName: "Bank", accountHolderName: null, maskedAccountReference: null, openingBalance: new Prisma.Decimal("0"), closingBalance: new Prisma.Decimal("907.25"), currency: "ZAR", fileAssetId: "file-1" }] });
  const createdLines: Array<Record<string, unknown>> = [];
  const sources: Array<Record<string, unknown>> = [];
  const versionUpdates: Array<Record<string, unknown>> = [];
  let auditAction: string | null = null;
  const tx = {
    user: { findFirst: async () => ({ id: "admin-1" }) },
    grantReport: { findUnique: async () => ({ id: "report-1", status: "DRAFT", currentVersionNumber: 1, award, obligation: period }) },
    grantReportVersion: {
      findUnique: async () => ({ id: "version-1", status: "DRAFT", reportType: "QUARTERLY_CASH_FLOW", currency: "ZAR", ...period }),
      update: async ({ data }: { data: Record<string, unknown> }) => { versionUpdates.push(data); },
    },
    grantBankImportBatch: {
      findFirst: async () => batch(),
      update: async ({ data }: { data: { status: string } }) => { status = data.status; },
    },
    grantReportBankTransactionSource: {
      findMany: async () => sources.map((source) => ({ grantBankTransactionId: source.grantBankTransactionId })),
      createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => { sources.push(...data); },
    },
    grantReportFinancialLine: {
      findFirst: async () => ({ displayOrder: 2 }),
      create: async ({ data }: { data: Record<string, unknown> }) => { createdLines.push(data); return { id: `line-${createdLines.length}` }; },
      findMany: async () => [
        { lineType: "OTHER_INCOME", quarterlyActual: new Prisma.Decimal("50.00"), estimatedExpenditure: null },
        ...createdLines.map((line) => ({ lineType: line.lineType, quarterlyActual: line.quarterlyActual, estimatedExpenditure: line.estimatedExpenditure })),
      ],
    },
    auditLog: { create: async ({ data }: { data: { action: string } }) => { auditAction = data.action; } },
  };
  const client = { $transaction: async <T>(operation: (transaction: unknown) => Promise<T>) => operation(tx) };
  const result = await postGrantBankTransactionsToCashFlow({ reportId: "report-1", importId: "import-1", actorUserId: "admin-1" }, client as unknown as Parameters<typeof postGrantBankTransactionsToCashFlow>[1]);
  assert.equal(result.posted, true);
  assert.equal(status, "CONFIRMED");
  assert.equal(createdLines.length, 2);
  assert.equal(sources.length, 2);
  assert.deepEqual(sources.map((source) => source.grantBankTransactionId).sort(), ["transaction-credit", "transaction-debit"]);
  assert.equal(auditAction, "grant.bank_import.transactions.posted");
  const persistedTotalIncome = versionUpdates[0]?.totalIncome;
  const persistedTotalExpenditure = versionUpdates[0]?.totalExpenditure;
  assert.ok(persistedTotalIncome instanceof Prisma.Decimal);
  assert.ok(persistedTotalExpenditure instanceof Prisma.Decimal);
  assert.equal(persistedTotalIncome.toFixed(2), "1050.25");
  assert.equal(persistedTotalExpenditure.toFixed(2), "93.00");
  assert.equal(createdLines.some((line) => line.categoryName === "Other manual line"), false);
});
