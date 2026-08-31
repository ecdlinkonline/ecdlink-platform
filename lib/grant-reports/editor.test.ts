import assert from "node:assert/strict";
import test from "node:test";
import { buildQuarterlyCashFlowSubtitle, buildQuarterlyExpenditureSubtitle, buildSuggestedGrantIndicators, calculateRacialColumnTotals, dbeQuarterlyCashFlowExpenseCategories, grantReportCompletion, isGrantReportVersionEditable, mapQuarterlyExpenditureIncomeToCashReceived, quarterlyCashFlowCompletion, quarterlyCashFlowTotals, quarterlyExpenditureCompletion, quarterlyExpenditureTotals, resolveGrantReportTemplate, subtractGrantAmounts, sumGrantAmounts } from "./editor";

test("Interim and Final resolve to the shared NLC template", () => {
  assert.equal(resolveGrantReportTemplate("INTERIM"), "NLC");
  assert.equal(resolveGrantReportTemplate("FINAL"), "NLC");
  assert.equal(resolveGrantReportTemplate("QUARTERLY_EXPENDITURE"), "DBE_QUARTERLY_EXPENDITURE");
  assert.equal(resolveGrantReportTemplate("QUARTERLY_CASH_FLOW"), "DBE_QUARTERLY_CASH_FLOW");
});

test("quarterly expenditure income maps to cash-flow owned cash received rows", () => {
  assert.deepEqual(mapQuarterlyExpenditureIncomeToCashReceived([
    { lineType: "FUNDING_RECEIVED", categoryName: "Funding received from Department / Subsidy", amount: "900.10" },
    { lineType: "OTHER_INCOME", categoryName: "Other Income", amount: "50.00" },
    { lineType: "OTHER_INCOME", categoryName: "Fundraising", amount: "25.25" },
  ]), [
    { lineType: "FUNDING_RECEIVED", categoryName: "Subsidy", amount: "900.10" },
    { lineType: "OTHER_INCOME", categoryName: "Other Income", amount: "50.00" },
    { lineType: "OTHER_INCOME", categoryName: "Fundraising", amount: "25.25" },
  ]);
  assert.equal(sumGrantAmounts(["900.10", "50.00", "25.25"]), "975.35");
});

test("cash flow operating totals and remaining cash use integer cents", () => {
  const totals = quarterlyCashFlowTotals(["1000.10", "50.00"], [
    { quarterlyBudget: "700.00", estimatedExpenditure: "650.05" },
    { quarterlyBudget: "200.10", estimatedExpenditure: "225.00" },
  ]);
  assert.deepEqual(totals, { totalCashAvailable: "1050.10", totalQuarterlyBudget: "900.10", totalExpenditure: "875.05", totalVariance: "25.05", remainingCash: "175.05" });
  assert.ok(dbeQuarterlyCashFlowExpenseCategories.includes("Principal"));
  assert.ok(dbeQuarterlyCashFlowExpenseCategories.includes("Other Operating Expenses"));
});

test("cash flow row variance is budget minus expenditure for under- and over-spending", () => {
  assert.equal(subtractGrantAmounts("1000.00", "800.00"), "200.00");
  assert.equal(subtractGrantAmounts("1000.00", "1200.00"), "-200.00");
});

test("cash flow completeness requires variance reasons and certification", () => {
  const complete = { financialYear: "2026", quarter: 1, reportingPeriodStart: "2026-01-01", reportingPeriodEnd: "2026-03-31", cashReceivedLineCount: 2, operatingExpenseLineCount: 14, unresolvedVarianceCount: 0, certificationCount: 2, confirmedCertificationCount: 2 };
  assert.equal(quarterlyCashFlowCompletion(complete).readyForSubmission, true);
  assert.equal(quarterlyCashFlowCompletion({ ...complete, unresolvedVarianceCount: 1 }).readyForSubmission, false);
});

test("quarterly cash flow subtitle omits the standard title", () => {
  assert.equal(buildQuarterlyCashFlowSubtitle({ reportTitle: "Quarterly Cash Flow Report - Q1 2026", centreName: "Future Leaders", leadOrganisation: "Western Cape ECD Fund", financialYear: "2026", quarter: 1 }), "Future Leaders · Western Cape ECD Fund · Q1 2026");
});

test("quarterly income and source-split expenditure calculations use integer cents", () => {
  assert.equal(sumGrantAmounts(["1000.10", "200.09", null]), "1200.19");
  const totals = quarterlyExpenditureTotals([
    { quarterlyBudget: "1000.10", fundingSourceActual: "200.09", otherSourceActual: "50.01" },
    { quarterlyBudget: "500.00", fundingSourceActual: "100.00", otherSourceActual: null },
  ]);
  assert.deepEqual(totals, { totalAllocatedBudget: "1500.10", totalFundingSourceExpenditure: "300.09", totalOtherSourceExpenditure: "50.01", totalExpenditure: "350.10" });
  assert.equal(subtractGrantAmounts("1200.19", totals.totalExpenditure!), "850.09");
});

test("quarterly report subtitles omit the standard title and duplicate quarter context", () => {
  const context = { centreName: "Future Leaders", leadOrganisation: "Western Cape ECD Fund", financialYear: "2026", quarter: 1 };
  assert.equal(buildQuarterlyExpenditureSubtitle({ ...context, reportTitle: "Quarterly Expenditure Report - Q1 2026" }), "Future Leaders · Western Cape ECD Fund · Q1 2026");
  assert.equal(buildQuarterlyExpenditureSubtitle({ ...context, reportTitle: "Nutrition programme update" }), "Nutrition programme update · Future Leaders · Western Cape ECD Fund · Q1 2026");
});

test("quarterly readiness requires general, income, expenditure, bank and certification sections", () => {
  const complete = { financialYear: "2026", quarter: 1, reportingPeriodStart: "2026-01-01", reportingPeriodEnd: "2026-03-31", incomeLineCount: 2, expenditureLineCount: 15, openingBankBalance: "100.00", closingBankBalance: "200.00", certificationCount: 2, confirmedCertificationCount: 2 };
  assert.equal(quarterlyExpenditureCompletion(complete).readyForSubmission, true);
  assert.equal(quarterlyExpenditureCompletion({ ...complete, closingBankBalance: null }).readyForSubmission, false);
});

test("only current Draft versions are editable", () => {
  assert.equal(isGrantReportVersionEditable("DRAFT", "DRAFT"), true);
  assert.equal(isGrantReportVersionEditable("RETURNED", "DRAFT"), true);
  assert.equal(isGrantReportVersionEditable("SUBMITTED", "DRAFT"), false);
  assert.equal(isGrantReportVersionEditable("DRAFT", "SUBMITTED"), false);
  assert.equal(isGrantReportVersionEditable("APPROVED", "APPROVED"), false);
});

test("Funding Project suggestions populate empty indicators but never overwrite persisted rows", () => {
  const project = { title: "Nutrition", objective: "Improve nutrition", expectedOutcomes: ["Meals delivered"], requiredItems: ["Attendance register"] };
  assert.deepEqual(buildSuggestedGrantIndicators(project, 0), [{ objective: "Improve nutrition", deliverable: "Meals delivered", achieved: "", status: "NOT_STARTED", meansOfVerification: "Attendance register" }]);
  assert.deepEqual(buildSuggestedGrantIndicators(project, 1), []);
});

test("financial subtraction uses integer cents and racial totals are calculated", () => {
  assert.equal(subtractGrantAmounts("1000.10", "200.09"), "800.01");
  const totals = calculateRacialColumnTotals([{ children: 1, youth: 2, men: 3, women: 4, olderPersons: 5, peopleWithDisabilities: 6 }]);
  assert.deepEqual(totals, { children: 1, youth: 2, men: 3, women: 4, olderPersons: 5, peopleWithDisabilities: 6, total: 21 });
});

test("Final readiness requires audited financial statements", () => {
  const complete = { reportType: "FINAL", reportingPeriodStart: "2026-01-01", reportingPeriodEnd: "2026-12-31", indicatorCount: 1, beneficiaryCount: 5, racialRowCount: 4, challenges: "Recorded", sustainabilityCount: 1, financialLineCount: 1, certificationCount: 2, confirmedCertificationCount: 2, hasAuditedFinancialStatements: true };
  assert.equal(grantReportCompletion(complete).readyForSubmission, true);
  assert.equal(grantReportCompletion({ ...complete, hasAuditedFinancialStatements: false }).readyForSubmission, false);
  assert.equal(grantReportCompletion({ ...complete, reportType: "INTERIM", hasAuditedFinancialStatements: false }).readyForSubmission, true);
});
