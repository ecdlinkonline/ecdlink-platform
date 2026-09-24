import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { grantReadinessPresentation, grantReportEmptyStateMessage } from "./presentation";
import type { SubmissionReadinessCheck } from "./submission-readiness";

test("the report empty state explains the persisted obligation-to-draft lifecycle", () => {
  const message = grantReportEmptyStateMessage();
  assert.match(message, /reporting obligation/i);
  assert.match(message, /Draft/);
});

test("the reports register uses business-facing copy and a collapsible filter panel", () => {
  const source = readFileSync("components/reports/grant-reports-workspace.tsx", "utf8");
  assert.match(source, />All Reports</);
  assert.match(source, /View, search and open grant reports\./);
  assert.match(source, /aria-expanded=\{filtersOpen\}/);
  assert.match(source, /aria-controls="grant-report-filters"/);
  assert.match(source, /setFiltersOpen\(\(open\) => !open\)/);
  assert.doesNotMatch(source, /Full editing begins in Phase 2|persisted grant reports/);
});

test("submitted report review has server-rendered history and cannot open a draft as a historical version", () => {
  const page = readFileSync("app/dashboard/super-admin/reports/[reportId]/page.tsx", "utf8");
  const repository = readFileSync("lib/repositories/grant-reports.ts", "utf8");
  const history = readFileSync("components/reports/grant-report-submission-history.tsx", "utf8");
  assert.match(page, /await requireSuperAdmin\(\)/);
  assert.match(page, /getGrantReportSubmissionHistory\(reportId\)/);
  assert.match(repository, /submittedVersionNumber !== undefined && !version\.submittedAt/);
  assert.match(repository, /submittedVersionNumber === undefined && version\.status === "DRAFT"/);
  assert.match(repository, /historical: submittedVersionNumber !== undefined/);
  assert.match(history, /Submission History/);
  assert.match(history, /Review submitted version/);
  assert.match(history, /\?version=\$\{item\.versionNumber\}/);
});

test("a non-current submitted version does not present current-version readiness as its historical result", () => {
  const source = readFileSync("components/reports/dbe-quarterly-cash-flow-editor.tsx", "utf8");
  assert.match(source, /if \(data\.version\.historical\) return <SectionCard title="Submission Readiness at Submission"/);
  assert.match(source, /Current-version validation is not presented as the historical result/);
});

test("submitted report review does not expose the bank import creation action", () => {
  for (const file of ["components/reports/dbe-quarterly-cash-flow-editor.tsx", "components/reports/dbe-quarterly-expenditure-editor.tsx"]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /editable \? <BankStatementImportAction reportId=\{data\.report\.id\} \/> : null/);
  }
});

test("submitted Cash Flow review renders saved fields without Draft mutation controls while Draft keeps them", () => {
  const source = readFileSync("components/reports/dbe-quarterly-cash-flow-editor.tsx", "utf8");
  const review = source.split("function SubmittedCashFlowReview")[1]?.split("function CashFlowGeneral")[0] ?? "";
  assert.match(source, /if \(data\.version\.submittedAt\) return <SubmittedCashFlowReview data=\{data\} \/>/);
  assert.match(review, /data-submitted-cash-flow-review/);
  assert.match(review, /activeSection === "cash_received"/);
  assert.match(review, /activeSection === "operating_expenses"/);
  assert.match(review, /activeSection === "variance_review"/);
  assert.doesNotMatch(review, /Save Draft|Add cash received line|Add expense line|Remove|<input|<select|BankStatementImportAction|WorkflowActionDialog/);
  assert.match(source, /Add cash received line/);
  assert.match(source, /Add expense line/);
  assert.match(source, /Save Draft/);
});

test("submitted readiness guidance is historical while Draft guidance remains prospective", () => {
  const parent: SubmissionReadinessCheck = { id: "reconciliation", group: "Financial Information", title: "Financial reconciliation", status: "NEEDS_REVIEW", detail: "Financial review notices need attention before certification.", guidance: "Review Financial Reconciliation and its source evidence.", section: "financial_reconciliation" };
  const statement: SubmissionReadinessCheck = { id: "statement-2026-04", group: "Bank Evidence", title: "April 2026 statement", status: "NEEDS_REVIEW", detail: "Difference -227.80.", guidance: "Review this statement's source discrepancy before certification.", href: "/bank-evidence" };
  assert.deepEqual(grantReadinessPresentation(parent, false), { detail: parent.detail, guidance: parent.guidance });
  assert.deepEqual(grantReadinessPresentation(statement, false), { detail: statement.detail, guidance: statement.guidance });
  const historicalParent = grantReadinessPresentation(parent, true);
  const historicalStatement = grantReadinessPresentation(statement, true);
  assert.doesNotMatch(`${historicalParent.detail} ${historicalParent.guidance} ${historicalStatement.detail} ${historicalStatement.guidance}`, /before submission|before certification|before submitting/i);
  assert.equal(historicalStatement.detail, statement.detail);
  assert.equal(parent.status, "NEEDS_REVIEW");
  assert.equal(statement.href, "/bank-evidence");
});

test("submitted certification copy is read-only and Draft submission instructions remain", () => {
  const source = readFileSync("components/reports/dbe-quarterly-cash-flow-editor.tsx", "utf8");
  assert.match(source, /if \(data\.version\.submittedAt\) return <div data-final-submission/);
  assert.match(source, /This submitted version preserves the recorded certifications and submission details for audit and evidence review/);
  assert.match(source, /This report has been submitted and is read-only/);
  assert.match(source, /Complete both certifications and review Submission Readiness before submitting this report/);
});
