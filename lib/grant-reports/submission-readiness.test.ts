import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { Prisma } from "@prisma/client";
import { grantReportCompletion } from "./editor";
import { buildFinancialReconciliation } from "./financial-reconciliation";
import { buildQuarterlySubmissionReadiness, canShowQuarterlySubmissionAction, selectSubmissionAcknowledgementWarnings, type SubmissionReadinessInput } from "./submission-readiness";

const d = (value: string) => new Prisma.Decimal(value);
const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

function financial(withBank = false) {
  const bankSource = {
    id: "source-1", appliedAmount: d("50.25"), transactionTypeSnapshot: "EXPENSE" as const,
    categorySnapshot: "Nutrition / Groceries",
    transaction: {
      id: "transaction-1", transactionDate: date("2026-04-06"), originalDescription: "Original grocery purchase",
      originalAmount: d("50.25"), direction: "DEBIT" as const, runningBalance: d("68303.86"),
      sourcePage: 1, sourceRow: 36, confirmedCategory: "Nutrition / Groceries",
      statement: { id: "april", statementMonth: date("2026-04-01"), periodStart: date("2026-04-01"), periodEnd: date("2026-04-30"), file: { originalFilename: "april.pdf" } },
      batch: { id: "batch", status: "CONFIRMED" as const, originatingGrantReportId: "report", grantAwardId: "award", centreId: "centre", financialYear: "2026", quarter: 1 },
    },
  };
  const imports = withBank ? [{ id: "batch", status: "CONFIRMED" as const, statements: [
    { id: "april", statementMonth: date("2026-04-01"), periodStart: null, periodEnd: null, openingBalance: null, closingBalance: null, transactions: [{ direction: "DEBIT" as const, originalAmount: d("50.25") }] },
    { id: "may", statementMonth: date("2026-05-01"), periodStart: null, periodEnd: null, openingBalance: null, closingBalance: null, transactions: [] },
    { id: "june", statementMonth: date("2026-06-01"), periodStart: null, periodEnd: null, openingBalance: null, closingBalance: null, transactions: [] },
  ] }] : [];
  return buildFinancialReconciliation({
    reportId: "report", awardId: "award", centreId: "centre", financialYear: "2026", quarter: 1,
    reportingPeriodStart: date("2026-04-01"), reportingPeriodEnd: date("2026-06-30"), openingCashBalance: null,
    storedFundingReceivedTotal: d("0"), storedOtherIncomeTotal: d("100.25"), storedTotalIncome: d("100.25"), storedTotalExpenditure: d("50.25"),
    financialLines: [
      { id: "income", lineType: "OTHER_INCOME", categoryCode: null, categoryName: "Other Income", quarterlyBudget: null, quarterlyActual: d("100.25"), estimatedExpenditure: null, bankTransactionSources: [] },
      { id: "expense", lineType: "EXPENDITURE", categoryCode: withBank ? "BANK_IMPORT:batch:EXPENDITURE:Nutrition / Groceries" : null, categoryName: "Nutrition / Groceries", quarterlyBudget: null, quarterlyActual: d("50.25"), estimatedExpenditure: d("50.25"), bankTransactionSources: withBank ? [bankSource] : [] },
    ],
    imports,
  });
}

function base(withBank = false): SubmissionReadinessInput {
  return {
    report: {
      id: "report", status: "DRAFT", grantAwardId: "award", obligationId: "obligation", currentVersionNumber: 1,
      awardCentreId: "centre", projectCentreId: "centre",
      obligation: { id: "obligation", grantAwardId: "award", status: "OPEN", type: "QUARTERLY_CASH_FLOW", financialYear: "2026", quarter: 1, reportingPeriodStart: date("2026-04-01"), reportingPeriodEnd: date("2026-06-30") },
    },
    version: {
      grantReportId: "report", versionNumber: 1, status: "DRAFT", reportType: "QUARTERLY_CASH_FLOW",
      financialYear: "2026", quarter: 1, reportingPeriodStart: date("2026-04-01"), reportingPeriodEnd: date("2026-06-30"),
      submittedAt: null, certificationAcknowledged: true, surplusDeficit: d("50.00"),
      certification: ["COMPILER", "APPROVER"].map((party) => ({ party, nameSnapshot: "Authorised person", designationSnapshot: "Reviewer", certificationDate: date("2026-07-01"), digitallyConfirmed: true, confirmedAt: date("2026-07-01") })),
      cashReceivedLineCount: 1, operatingExpenseLineCount: 1, unresolvedVarianceCount: 0, documentCount: 0, reviewCount: 0,
    },
    financialReconciliation: financial(withBank),
    bankImports: withBank ? [{
      id: "batch", status: "CONFIRMED", originatingGrantReportId: "report", grantAwardId: "award", centreId: "centre", financialYear: "2026", quarter: 1,
      reportingPeriodStart: date("2026-04-01"), reportingPeriodEnd: date("2026-06-30"),
      statements: [
        { id: "april", statementMonth: date("2026-04-01"), periodStart: null, periodEnd: null, extractionStatus: "EXTRACTED", transactions: [{ id: "transaction-1", reviewStatus: "REVIEWED" }] },
        { id: "may", statementMonth: date("2026-05-01"), periodStart: null, periodEnd: null, extractionStatus: "EXTRACTED", transactions: [] },
        { id: "june", statementMonth: date("2026-06-01"), periodStart: null, periodEnd: null, extractionStatus: "EXTRACTED", transactions: [] },
      ],
    }] : [],
  };
}

const check = (result: ReturnType<typeof buildQuarterlySubmissionReadiness>, id: string) => result.checks.find((item) => item.id === id);

test("a fully valid current Draft is READY; informational manual evidence and optional budgets/documents do not block", () => {
  const result = buildQuarterlySubmissionReadiness(base());
  assert.equal(result.state, "READY");
  assert.equal(result.attentionCount, 0);
  assert.equal(check(result, "budget")?.status, "NOT_REQUIRED");
  assert.match(check(result, "budget")?.detail ?? "", /Budget not recorded/);
  assert.equal(check(result, "documents")?.status, "NOT_REQUIRED");
  assert.equal(check(result, "bank")?.status, "NOT_REQUIRED");
});

test("structural award/centre, period and current-version mismatches BLOCK", () => {
  const input = base();
  input.report!.projectCentreId = "other-centre";
  input.report!.currentVersionNumber = 2;
  input.version!.reportingPeriodEnd = date("2026-04-08");
  const result = buildQuarterlySubmissionReadiness(input);
  assert.equal(result.state, "BLOCKED");
  assert.equal(check(result, "identity")?.status, "BLOCKED");
  assert.equal(check(result, "period")?.status, "BLOCKED");
});

test("missing mandatory Cash Flow lines and unresolved variance explanations BLOCK using the existing completion contract", () => {
  const input = base();
  input.version!.cashReceivedLineCount = 0;
  input.version!.operatingExpenseLineCount = 0;
  input.version!.unresolvedVarianceCount = 1;
  const result = buildQuarterlySubmissionReadiness(input);
  assert.equal(result.state, "BLOCKED");
  assert.equal(check(result, "cash")?.status, "BLOCKED");
  assert.equal(check(result, "expenses")?.status, "BLOCKED");
  assert.equal(check(result, "variance")?.section, "variance_review");
});

test("Phase 3A BLOCKING financial totals propagate; Decimal cents are unchanged", () => {
  const input = base();
  input.financialReconciliation = { ...financial(), warnings: [{ severity: "BLOCKING", code: "FINANCIAL_TOTAL_MISMATCH", message: "Stored totals differ." }], readiness: "BLOCKED" };
  const result = buildQuarterlySubmissionReadiness(input);
  assert.equal(result.state, "BLOCKED");
  assert.equal(check(result, "reconciliation")?.status, "BLOCKED");
  assert.equal(check(result, "surplus")?.status, "COMPLETE");
  assert.equal(input.version!.surplusDeficit.toFixed(2), "50.00");
});

test("an unavailable Phase 3A assessment is a counted blocking requirement", () => {
  const input = base();
  input.financialReconciliation = null;
  const result = buildQuarterlySubmissionReadiness(input);
  assert.equal(result.state, "BLOCKED");
  assert.equal(check(result, "reconciliation")?.status, "BLOCKED");
  assert.equal(result.attentionCount, 1);
});

test("Phase 3A warning is NEEDS_REVIEW; April/May discrepancies persist and June remains without a discrepancy", () => {
  const input = base();
  const recon = financial();
  input.financialReconciliation = { ...recon, warnings: [
    { severity: "WARNING", code: "SOURCE_STATEMENT_DISCREPANCY", message: "April 2026 source difference -227.80." },
    { severity: "WARNING", code: "SOURCE_STATEMENT_DISCREPANCY", message: "May 2026 source difference -880.00." },
    { severity: "WARNING", code: "NEGATIVE_CASH_POSITION", message: "Recorded expenditure exceeds cash." },
  ], readiness: "NEEDS_REVIEW" };
  const result = buildQuarterlySubmissionReadiness(input);
  assert.equal(result.state, "NEEDS_REVIEW");
  assert.equal(check(result, "reconciliation")?.status, "NEEDS_REVIEW");
  assert.ok(result.checks.some((item) => item.detail.includes("April 2026")));
  assert.ok(result.checks.some((item) => item.detail.includes("May 2026")));
  assert.equal(result.checks.some((item) => item.detail.includes("June 2026 source difference")), false);
});

test("confirmed, extracted and completely posted bank import passes with exact source cents", () => {
  const input = base(true);
  const result = buildQuarterlySubmissionReadiness(input);
  assert.equal(result.state, "READY");
  assert.equal(check(result, "bank")?.status, "COMPLETE");
  assert.equal(check(result, "posting")?.status, "COMPLETE");
  assert.deepEqual(["2026-04-01", "2026-05-01", "2026-06-01"].map((month) => check(result, `statement-${month}`)?.status), ["COMPLETE", "COMPLETE", "COMPLETE"]);
  assert.equal(input.financialReconciliation!.categories[0].evidenceTotal, "50.25");
  assert.equal(input.financialReconciliation!.categories[0].evidence[0].appliedAmount, "50.25");
});

test("confirmed April and May source discrepancies appear once with their exact differences; June passes", () => {
  const input = base(true);
  input.financialReconciliation!.warnings.push(
    { severity: "WARNING", code: "SOURCE_STATEMENT_DISCREPANCY", message: "April 2026 source difference -227.80." },
    { severity: "WARNING", code: "SOURCE_STATEMENT_DISCREPANCY", message: "May 2026 source difference -880.00." },
  );
  const result = buildQuarterlySubmissionReadiness(input);
  assert.equal(result.state, "NEEDS_REVIEW");
  assert.equal(result.attentionCount, 2);
  assert.match(check(result, "statement-2026-04-01")?.detail ?? "", /-227\.80/);
  assert.match(check(result, "statement-2026-05-01")?.detail ?? "", /-880\.00/);
  assert.equal(check(result, "statement-2026-06-01")?.status, "COMPLETE");
  assert.equal(result.checks.filter((item) => item.title === "Statement balance discrepancy").length, 0);
});

test("submission acknowledgement shows actionable reconciliation findings without repeating their parent summary", () => {
  const input = base(true);
  input.financialReconciliation!.warnings.push(
    { severity: "WARNING", code: "NEGATIVE_CASH_POSITION", message: "Recorded expenditure exceeds the cash available for this quarter." },
    { severity: "WARNING", code: "SOURCE_STATEMENT_DISCREPANCY", message: "April 2026 source difference -227.80." },
    { severity: "WARNING", code: "SOURCE_STATEMENT_DISCREPANCY", message: "May 2026 source difference -880.00." },
  );
  const result = buildQuarterlySubmissionReadiness(input);
  const warnings = selectSubmissionAcknowledgementWarnings(result.checks);
  assert.equal(result.state, "NEEDS_REVIEW");
  assert.equal(result.attentionCount, 3);
  assert.equal(check(result, "reconciliation")?.status, "NEEDS_REVIEW");
  assert.deepEqual(warnings.map((item) => item.title), ["Recorded cash position", "April 2026 statement", "May 2026 statement"]);
  assert.equal(warnings.length, 3);
  assert.equal(warnings.every((item) => item.parentCheckId === "reconciliation"), true);
  assert.equal(result.checks.filter((item) => item.status === "NEEDS_REVIEW").length, 4);
  assert.equal(input.report?.status, "DRAFT");
  assert.equal(input.version?.submittedAt, null);
});

test("summary warning remains visible when no actionable child exists; BLOCKED findings stay non-bypassable", () => {
  const input = base(true);
  input.financialReconciliation!.warnings.push({ severity: "BLOCKING", code: "INCOMPLETE_BANK_PROVENANCE", message: "Linked source amount differs from the line." });
  const blocked = buildQuarterlySubmissionReadiness(input);
  assert.equal(blocked.state, "BLOCKED");
  assert.deepEqual(selectSubmissionAcknowledgementWarnings(blocked.checks), []);
  assert.equal(canShowQuarterlySubmissionAction({ editable: true, readinessState: blocked.state, certifications: [{ party: "COMPILER", digitallyConfirmed: true }, { party: "APPROVER", digitallyConfirmed: true }] }), false);
  const summary = { id: "reconciliation", group: "Financial Information" as const, title: "Financial reconciliation", status: "NEEDS_REVIEW" as const, detail: "Summary finding" };
  assert.deepEqual(selectSubmissionAcknowledgementWarnings([summary]), [summary]);
});

test("unconfirmed or misaligned bank import BLOCKS when bank evidence is in use", () => {
  const input = base(true);
  input.bankImports[0].status = "READY_FOR_CONFIRMATION";
  assert.equal(check(buildQuarterlySubmissionReadiness(input), "bank")?.status, "BLOCKED");
  input.bankImports[0].status = "CONFIRMED";
  input.bankImports[0].reportingPeriodEnd = date("2026-04-08");
  assert.equal(check(buildQuarterlySubmissionReadiness(input), "bank")?.status, "BLOCKED");
});

test("missing or unextracted mandatory bank statement month BLOCKS while bank import is used", () => {
  const input = base(true);
  input.bankImports[0].statements[1].extractionStatus = "PENDING";
  assert.equal(check(buildQuarterlySubmissionReadiness(input), "statement-2026-05-01")?.status, "BLOCKED");
  input.bankImports[0].statements.splice(1, 1);
  assert.equal(check(buildQuarterlySubmissionReadiness(input), "statement-2026-05-01")?.status, "BLOCKED");
});

test("partial, duplicate, invalid-statement and unreviewed bank provenance BLOCKS", () => {
  const input = base(true);
  input.bankImports[0].statements[0].transactions.push({ id: "transaction-2", reviewStatus: "REVIEWED" });
  assert.equal(check(buildQuarterlySubmissionReadiness(input), "posting")?.status, "BLOCKED");
  input.bankImports[0].statements[0].transactions.pop();
  input.financialReconciliation!.sourceLines[1].evidence.push(input.financialReconciliation!.sourceLines[1].evidence[0]);
  assert.equal(check(buildQuarterlySubmissionReadiness(input), "posting")?.status, "BLOCKED");
  input.financialReconciliation!.sourceLines[1].evidence.pop();
  input.financialReconciliation!.sourceLines[1].evidence[0].statementId = "unrelated-statement";
  assert.equal(check(buildQuarterlySubmissionReadiness(input), "posting")?.status, "BLOCKED");
  input.financialReconciliation!.sourceLines[1].evidence[0].statementId = "april";
  input.bankImports[0].statements[0].transactions[0].reviewStatus = "UNREVIEWED";
  assert.equal(check(buildQuarterlySubmissionReadiness(input), "posting")?.status, "BLOCKED");
});

test("bank source totals that do not match the financial line remain Phase 3A BLOCKING findings", () => {
  const input = base(true);
  input.financialReconciliation!.warnings.push({ severity: "BLOCKING", code: "INCOMPLETE_BANK_PROVENANCE", message: "Linked source amount differs from the line." });
  assert.equal(buildQuarterlySubmissionReadiness(input).state, "BLOCKED");
});

test("optional Cash Flow documents do not block; existing FINAL audited-statement rule remains mandatory only for FINAL", () => {
  const input = base();
  input.version!.documentCount = 0;
  assert.equal(check(buildQuarterlySubmissionReadiness(input), "documents")?.status, "NOT_REQUIRED");
  const final = { reportType: "FINAL", reportingPeriodStart: "2026-01-01", reportingPeriodEnd: "2026-12-31", indicatorCount: 1, beneficiaryCount: 5, racialRowCount: 4, challenges: "Recorded", sustainabilityCount: 1, financialLineCount: 1, certificationCount: 2, confirmedCertificationCount: 2, hasAuditedFinancialStatements: false };
  assert.equal(grantReportCompletion(final).readyForSubmission, false);
  assert.equal(grantReportCompletion({ ...final, reportType: "INTERIM" }).readyForSubmission, true);
});

test("incomplete certification BLOCKS but viewing never confirms anything", () => {
  const input = base();
  input.version!.certificationAcknowledged = false;
  input.version!.certification[0].digitallyConfirmed = false;
  const before = JSON.stringify(input);
  const result = buildQuarterlySubmissionReadiness(input);
  assert.equal(result.state, "BLOCKED");
  assert.equal(check(result, "certification")?.status, "BLOCKED");
  assert.equal(check(result, "certification")?.section, "certification");
  assert.equal(JSON.stringify(input), before);
});

test("readiness is pure: Draft, bank transactions and source amounts remain untouched; no submission/review is created", () => {
  const input = base(true);
  const before = JSON.stringify(input);
  buildQuarterlySubmissionReadiness(input);
  buildQuarterlySubmissionReadiness(input);
  assert.equal(JSON.stringify(input), before);
  assert.equal(input.report!.status, "DRAFT");
  assert.equal(input.version!.submittedAt, null);
  assert.equal(input.version!.reviewCount, 0);
  assert.equal(input.bankImports[0].status, "CONFIRMED");
  const ui = readFileSync("components/reports/dbe-quarterly-cash-flow-editor.tsx", "utf8");
  assert.match(ui, /activeSection === "submission_readiness" \? <SubmissionReadiness/);
  assert.match(ui, /activeSection !== "financial_reconciliation" && activeSection !== "submission_readiness"/);
  assert.match(ui, /activeSection === "financial_reconciliation" \|\| activeSection === "submission_readiness"\) return/);
});

test("the current editable Draft has no mutation-based Submit action in Phase 3B", () => {
  const input = base();
  input.report!.status = "SUBMITTED";
  assert.equal(check(buildQuarterlySubmissionReadiness(input), "draft")?.status, "BLOCKED");
  input.report!.status = "DRAFT";
  input.version!.reviewCount = 1;
  assert.equal(check(buildQuarterlySubmissionReadiness(input), "draft")?.status, "BLOCKED");
});

test("Phase 3C keeps Submission Readiness read-only and places the single controlled action after certification", () => {
  const ui = readFileSync("components/reports/dbe-quarterly-cash-flow-editor.tsx", "utf8");
  const readinessSource = ui.slice(ui.indexOf("function SubmissionReadiness"), ui.indexOf("function ReconciliationGroup"));
  const certificationSource = ui.slice(ui.indexOf("function CashFlowCertification"), ui.indexOf("function SectionCard"));

  assert.doesNotMatch(readinessSource, /Submit Report|WorkflowActionDialog|\/submit/);
  assert.match(readinessSource, /completely read-only|read-only assessment|Complete certification and final submission/);
  assert.match(certificationSource, /data-final-submission/);
  assert.match(certificationSource, /Final Submission/);
  assert.equal((certificationSource.match(/trigger=\{\{ label: "Submit Report" \}\}/g) ?? []).length, 1);
  assert.match(certificationSource, /canShowQuarterlySubmissionAction/);
  assert.match(certificationSource, /readiness!\.state === "NEEDS_REVIEW"/);
  assert.match(certificationSource, /acknowledgeWarnings/);
});

test("the final submission action requires both persisted certifications and a non-blocking readiness state", () => {
  const complete = [{ party: "COMPILER", digitallyConfirmed: true }, { party: "APPROVER", digitallyConfirmed: true }];
  assert.equal(canShowQuarterlySubmissionAction({ editable: true, readinessState: "READY", certifications: complete }), true);
  assert.equal(canShowQuarterlySubmissionAction({ editable: true, readinessState: "NEEDS_REVIEW", certifications: complete }), true);
  assert.equal(canShowQuarterlySubmissionAction({ editable: true, readinessState: "BLOCKED", certifications: complete }), false);
  assert.equal(canShowQuarterlySubmissionAction({ editable: true, readinessState: "READY", certifications: complete.slice(0, 1) }), false);
  assert.equal(canShowQuarterlySubmissionAction({ editable: false, readinessState: "READY", certifications: complete }), false);
});
