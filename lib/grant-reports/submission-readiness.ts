import { Prisma, type GrantBankImportStatus, type GrantBankStatementStatus, type GrantBankTransactionReviewStatus, type GrantObligationStatus, type GrantObligationType, type GrantReportStatus, type GrantReportVersionStatus } from "@prisma/client";
import { expectedGrantBankStatementMonths } from "@/lib/grant-reports/bank-import";
import { grantReportCertificationParties, quarterlyCashFlowCompletion, type DbeQuarterlyCashFlowSectionId } from "@/lib/grant-reports/editor";
import { buildFinancialReconciliation } from "@/lib/grant-reports/financial-reconciliation";
import { resolveQuarterlyReportingPeriod } from "@/lib/grant-reports/quarterly-period";

export type SubmissionReadinessState = "READY" | "NEEDS_REVIEW" | "BLOCKED";
export type SubmissionCheckStatus = "COMPLETE" | "NEEDS_REVIEW" | "BLOCKED" | "NOT_REQUIRED";
export type SubmissionCheckGroup = "Report Information" | "Financial Information" | "Bank Evidence" | "Supporting Documents" | "Certification";
export const submissionCheckGroups = ["Report Information", "Financial Information", "Bank Evidence", "Supporting Documents", "Certification"] as const;
export type SubmissionReadinessCheck = {
  id: string;
  group: SubmissionCheckGroup;
  title: string;
  status: SubmissionCheckStatus;
  detail: string;
  guidance?: string;
  section?: DbeQuarterlyCashFlowSectionId;
  href?: string;
};

type BankImport = {
  id: string;
  status: GrantBankImportStatus;
  originatingGrantReportId: string;
  grantAwardId: string;
  centreId: string;
  financialYear: string;
  quarter: number;
  reportingPeriodStart: Date;
  reportingPeriodEnd: Date;
  statements: Array<{
    id: string;
    statementMonth: Date | null;
    periodStart: Date | null;
    periodEnd: Date | null;
    extractionStatus: GrantBankStatementStatus;
    transactions: Array<{ id: string; reviewStatus: GrantBankTransactionReviewStatus }>;
  }>;
};

export type SubmissionReadinessInput = {
  report: {
    id: string;
    status: GrantReportStatus;
    grantAwardId: string;
    obligationId: string;
    currentVersionNumber: number;
    awardCentreId: string;
    projectCentreId: string;
    obligation: {
      id: string;
      grantAwardId: string;
      status: GrantObligationStatus;
      type: GrantObligationType;
      financialYear: string | null;
      quarter: number | null;
      reportingPeriodStart: Date | null;
      reportingPeriodEnd: Date | null;
    };
  } | null;
  version: {
    grantReportId: string;
    versionNumber: number;
    status: GrantReportVersionStatus;
    reportType: GrantObligationType;
    financialYear: string | null;
    quarter: number | null;
    reportingPeriodStart: Date | null;
    reportingPeriodEnd: Date | null;
    submittedAt: Date | null;
    certificationAcknowledged: boolean;
    surplusDeficit: Prisma.Decimal;
    certification: Array<{ party: string; nameSnapshot: string; designationSnapshot: string; certificationDate: Date | null; digitallyConfirmed: boolean; confirmedAt: Date | null }>;
    cashReceivedLineCount: number;
    operatingExpenseLineCount: number;
    unresolvedVarianceCount: number;
    documentCount: number;
    reviewCount: number;
  } | null;
  financialReconciliation: ReturnType<typeof buildFinancialReconciliation> | null;
  bankImports: BankImport[];
};

const dateOnly = (date: Date | null | undefined) => date?.toISOString().slice(0, 10) ?? null;

export function buildQuarterlySubmissionReadiness(input: SubmissionReadinessInput) {
  const checks: SubmissionReadinessCheck[] = [];
  const add = (check: SubmissionReadinessCheck) => checks.push(check);
  const report = input.report;
  const version = input.version;
  if (!report || !version) {
    add({ id: "identity", group: "Report Information", title: "Current report and version", status: "BLOCKED", detail: "The report or its current version is unavailable.", guidance: "Contact an administrator to resolve the report record." });
    return { state: "BLOCKED" as SubmissionReadinessState, attentionCount: 1, checks };
  }

  const identityAligned = version.grantReportId === report.id && version.versionNumber === report.currentVersionNumber
    && report.obligationId === report.obligation.id && report.grantAwardId === report.obligation.grantAwardId
    && report.awardCentreId === report.projectCentreId
    && version.reportType === "QUARTERLY_CASH_FLOW" && report.obligation.type === "QUARTERLY_CASH_FLOW";
  add({ id: "identity", group: "Report Information", title: "Report, award, centre and obligation", status: identityAligned ? "COMPLETE" : "BLOCKED", detail: identityAligned ? "The current Quarterly Cash Flow version belongs to this award, centre and obligation." : "A report, version, award, centre, project or obligation relationship does not align.", guidance: identityAligned ? undefined : "Ask an administrator to investigate the report relationships." });

  const canonical = version.financialYear && version.quarter ? resolveQuarterlyReportingPeriod(version.financialYear, version.quarter) : null;
  const periodAligned = Boolean(canonical && version.financialYear === report.obligation.financialYear && version.quarter === report.obligation.quarter
    && dateOnly(version.reportingPeriodStart) === canonical.reportingPeriodStart && dateOnly(version.reportingPeriodEnd) === canonical.reportingPeriodEnd
    && dateOnly(report.obligation.reportingPeriodStart) === canonical.reportingPeriodStart && dateOnly(report.obligation.reportingPeriodEnd) === canonical.reportingPeriodEnd);
  add({ id: "period", group: "Report Information", title: "Canonical reporting quarter", status: periodAligned ? "COMPLETE" : "BLOCKED", detail: periodAligned ? `${canonical!.reportingPeriodStart} – ${canonical!.reportingPeriodEnd} matches the current version and obligation.` : "The financial year, quarter or dates do not match the canonical reporting period.", guidance: periodAligned ? undefined : "Review General Information and save the canonical quarter.", section: periodAligned ? undefined : "cash_flow_general" });

  const draftAligned = report.status === "DRAFT" && version.status === "DRAFT" && version.submittedAt === null
    && report.obligation.status !== "WAIVED" && report.obligation.status !== "CANCELLED" && report.obligation.status !== "ARCHIVED" && version.reviewCount === 0;
  add({ id: "draft", group: "Report Information", title: "Draft submission state", status: draftAligned ? "COMPLETE" : "BLOCKED", detail: draftAligned ? "This is the current editable Draft; no submission or review record exists." : "This report is not an unsubmitted, editable current Draft.", guidance: draftAligned ? undefined : "Resolve the report lifecycle state before preparing a submission." });

  // Reuse the existing five-check completion contract. Budgets and documents are not in its mandatory Cash Flow checks.
  const completion = quarterlyCashFlowCompletion({
    financialYear: version.financialYear, quarter: version.quarter,
    reportingPeriodStart: dateOnly(version.reportingPeriodStart), reportingPeriodEnd: dateOnly(version.reportingPeriodEnd),
    cashReceivedLineCount: version.cashReceivedLineCount, operatingExpenseLineCount: version.operatingExpenseLineCount,
    unresolvedVarianceCount: version.unresolvedVarianceCount,
    certificationCount: version.certification.length,
    confirmedCertificationCount: version.certification.filter((row) => row.digitallyConfirmed).length,
  });
  add({ id: "cash", group: "Financial Information", title: "Cash / Funding Received", status: version.cashReceivedLineCount > 0 ? "COMPLETE" : "BLOCKED", detail: version.cashReceivedLineCount > 0 ? "Cash received lines are recorded." : "No cash received lines are recorded.", guidance: version.cashReceivedLineCount ? undefined : "Record and save Cash Received.", section: version.cashReceivedLineCount ? undefined : "cash_received" });
  add({ id: "expenses", group: "Financial Information", title: "Operating Expenses", status: version.operatingExpenseLineCount > 0 ? "COMPLETE" : "BLOCKED", detail: version.operatingExpenseLineCount > 0 ? "Operating expense lines are recorded." : "No operating expense lines are recorded.", guidance: version.operatingExpenseLineCount ? undefined : "Record and save Operating Expenses.", section: version.operatingExpenseLineCount ? undefined : "operating_expenses" });
  add({ id: "variance", group: "Financial Information", title: "Variance explanations", status: version.unresolvedVarianceCount === 0 ? "COMPLETE" : "BLOCKED", detail: version.unresolvedVarianceCount === 0 ? "Every recorded non-zero variance has an explanation." : `${version.unresolvedVarianceCount} variance explanation(s) are missing.`, guidance: version.unresolvedVarianceCount ? "Explain the variance in Operating Expenses or Variance & Reasons." : undefined, section: version.unresolvedVarianceCount ? "variance_review" : undefined });
  add({ id: "budget", group: "Financial Information", title: "Quarterly budget", status: input.financialReconciliation?.expenditure.quarterlyBudget == null ? "NOT_REQUIRED" : "COMPLETE", detail: input.financialReconciliation?.expenditure.quarterlyBudget == null ? "Budget not recorded. The existing Cash Flow completion rule does not require a quarterly budget." : "A quarterly budget is recorded." });

  const reconciliation = input.financialReconciliation;
  if (!reconciliation) add({ id: "reconciliation", group: "Financial Information", title: "Financial reconciliation", status: "BLOCKED", detail: "The financial assessment is unavailable.", guidance: "Review the report's financial data.", section: "financial_reconciliation" });
  else {
    const blocking = reconciliation.warnings.some((item) => item.severity === "BLOCKING");
    const review = reconciliation.warnings.some((item) => item.severity === "WARNING");
    add({ id: "reconciliation", group: "Financial Information", title: "Financial reconciliation", status: blocking ? "BLOCKED" : review ? "NEEDS_REVIEW" : "COMPLETE", detail: blocking ? "Mandatory financial consistency or bank provenance checks failed." : review ? "Financial review notices need attention before certification." : "No blocking or warning-level financial findings.", guidance: blocking || review ? "Review Financial Reconciliation and its source evidence." : undefined, section: blocking || review ? "financial_reconciliation" : undefined });
    for (const warning of reconciliation.warnings) {
      // Confirmed statement discrepancies are shown once, on their month-specific bank check below.
      if (warning.code === "SOURCE_STATEMENT_DISCREPANCY" && input.bankImports.some((batch) => batch.status === "CONFIRMED")) continue;
      const status = warning.severity === "BLOCKING" ? "BLOCKED" : warning.severity === "WARNING" ? "NEEDS_REVIEW" : "COMPLETE";
      add({ id: `financial-${warning.code}-${checks.length}`, group: warning.code.includes("IMPORT") || warning.code.includes("STATEMENT") || warning.code.includes("PROVENANCE") ? "Bank Evidence" : "Financial Information", title: warning.code === "SOURCE_STATEMENT_DISCREPANCY" ? "Statement balance discrepancy" : warning.code === "NEGATIVE_CASH_POSITION" ? "Recorded cash position" : warning.code.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()), status, detail: warning.message, guidance: status === "COMPLETE" ? undefined : warning.code === "SOURCE_STATEMENT_DISCREPANCY" ? "Review the source bank statement discrepancy before certification." : "Review the source evidence and resolve this finding before submission.", section: status === "COMPLETE" ? undefined : "financial_reconciliation" });
    }
    const calculatedSurplus = new Prisma.Decimal(reconciliation.cash.totalCashReceived).minus(reconciliation.expenditure.actualExpenditure);
    const totalsAligned = calculatedSurplus.equals(version.surplusDeficit);
    add({ id: "surplus", group: "Financial Information", title: "Stored surplus / deficit", status: totalsAligned ? "COMPLETE" : "BLOCKED", detail: totalsAligned ? "Stored surplus / deficit matches the authoritative cash and expenditure totals to the cent." : "Stored surplus / deficit does not match the financial lines.", guidance: totalsAligned ? undefined : "Investigate the report totals before submission.", section: totalsAligned ? undefined : "financial_reconciliation" });
  }

  const sourceEvidence = reconciliation?.sourceLines.flatMap((line) => line.evidence) ?? [];
  const usesBankEvidence = sourceEvidence.length > 0 || input.bankImports.length > 0;
  if (!usesBankEvidence) add({ id: "bank", group: "Bank Evidence", title: "Bank statement import", status: "NOT_REQUIRED", detail: "No bank-sourced lines or bank import are present; the existing Cash Flow completion rule does not require statements." });
  else {
    const confirmed = input.bankImports.filter((batch) => batch.status === "CONFIRMED");
    const importAligned = confirmed.length > 0 && confirmed.every((batch) => batch.originatingGrantReportId === report.id && batch.grantAwardId === report.grantAwardId && batch.centreId === report.awardCentreId
      && batch.financialYear === version.financialYear && batch.quarter === version.quarter
      && dateOnly(batch.reportingPeriodStart) === dateOnly(version.reportingPeriodStart) && dateOnly(batch.reportingPeriodEnd) === dateOnly(version.reportingPeriodEnd));
    const importId = confirmed[0]?.id ?? input.bankImports[0]?.id;
    const importHref = importId ? `/dashboard/super-admin/reports/${report.id}/bank-import/${importId}` : undefined;
    add({ id: "bank", group: "Bank Evidence", title: "Confirmed import and report alignment", status: importAligned ? "COMPLETE" : "BLOCKED", detail: importAligned ? "The bank import is confirmed and belongs to this report, award, centre and quarter." : "No aligned, confirmed bank import supports the bank-sourced lines.", guidance: importAligned ? undefined : "Open Bank Statements and complete the import/posting review.", href: importAligned ? undefined : importHref });
    const statements = confirmed.flatMap((batch) => batch.statements);
    const expected = canonical ? expectedGrantBankStatementMonths(canonical.reportingPeriodStart, canonical.reportingPeriodEnd) : [];
    for (const month of expected) {
      const matching = statements.filter((statement) => dateOnly(statement.statementMonth ?? statement.periodEnd ?? statement.periodStart)?.slice(0, 7) === month.value.slice(0, 7));
      const extracted = matching.length === 1 && matching[0].extractionStatus === "EXTRACTED";
      const discrepancy = reconciliation?.warnings.find((warning) => warning.code === "SOURCE_STATEMENT_DISCREPANCY" && warning.message.startsWith(month.label));
      add({ id: `statement-${month.value}`, group: "Bank Evidence", title: `${month.label} statement`, status: !extracted ? "BLOCKED" : discrepancy ? "NEEDS_REVIEW" : "COMPLETE", detail: !extracted ? "The required statement is missing, duplicated or not extracted." : discrepancy ? discrepancy.message : "Extracted and no source balance discrepancy was found.", guidance: !extracted ? "Upload or extract the statement for this month." : discrepancy ? "Review this statement's source discrepancy before certification." : undefined, href: !extracted || discrepancy ? importHref : undefined });
    }
    const postedIds = sourceEvidence.map((source) => source.transactionId);
    const expectedIds = confirmed.flatMap((batch) => batch.statements.flatMap((statement) => statement.transactions.map((transaction) => transaction.id)));
    const sourcePositions = new Map(confirmed.flatMap((batch) => batch.statements.flatMap((statement) => statement.transactions.map((transaction) => [transaction.id, statement.id] as const))));
    const postingComplete = importAligned && expectedIds.length > 0 && expectedIds.length === postedIds.length
      && new Set(expectedIds).size === expectedIds.length && new Set(postedIds).size === postedIds.length
      && expectedIds.every((id) => postedIds.includes(id))
      && sourceEvidence.every((source) => sourcePositions.get(source.transactionId) === source.statementId)
      && confirmed.every((batch) => batch.statements.every((statement) => statement.transactions.every((transaction) => transaction.reviewStatus === "REVIEWED")));
    add({ id: "posting", group: "Bank Evidence", title: "Complete, unique transaction posting", status: postingComplete ? "COMPLETE" : "BLOCKED", detail: postingComplete ? `${expectedIds.length} reviewed transactions have distinct, matching report sources.` : "The reviewed transactions and report sources are incomplete, duplicated or mismatched.", guidance: postingComplete ? undefined : "Review bank transaction categorisation, posting and source links.", href: postingComplete ? undefined : importHref });
  }

  // Audited statements are mandatory only for FINAL in grantReportCompletion; no document type is mandatory here.
  add({ id: "documents", group: "Supporting Documents", title: "Quarterly Cash Flow documents", status: "NOT_REQUIRED", detail: `No document type is mandatory in the existing Quarterly Cash Flow completion rule. ${version.documentCount} optional report document(s) attached.` });

  const parties = new Set(version.certification.map((row) => row.party));
  const certifiersComplete = version.certification.length === grantReportCertificationParties.length && parties.size === grantReportCertificationParties.length
    && grantReportCertificationParties.every((party) => parties.has(party))
    && version.certification.every((row) => row.nameSnapshot.trim() && row.designationSnapshot.trim() && row.certificationDate && row.digitallyConfirmed && row.confirmedAt)
    && version.certificationAcknowledged;
  add({ id: "certification", group: "Certification", title: "Compiler and approver declarations", status: certifiersComplete ? "COMPLETE" : "BLOCKED", detail: certifiersComplete ? "Both required declarations and certifier details are recorded." : "Both compiler and approver declarations must be completed before submission.", guidance: certifiersComplete ? undefined : "Complete Certification & Review; this readiness view does not certify the report.", section: certifiersComplete ? undefined : "certification" });
  if (!completion.readyForSubmission && !checks.some((check) => check.status === "BLOCKED")) add({ id: "completion", group: "Report Information", title: "Required section completion", status: "BLOCKED", detail: "An existing mandatory Quarterly Cash Flow completion check is still missing.", guidance: "Review the report's required sections." });

  const attentionCount = checks.filter((check) => (check.id !== "reconciliation" || !reconciliation) && (check.status === "BLOCKED" || check.status === "NEEDS_REVIEW")).length;
  const state: SubmissionReadinessState = checks.some((check) => check.status === "BLOCKED") ? "BLOCKED"
    : checks.some((check) => check.status === "NEEDS_REVIEW") ? "NEEDS_REVIEW" : "READY";
  return { state, attentionCount, checks };
}
