import assert from "node:assert/strict";
import test from "node:test";
import { buildSuggestedGrantIndicators, calculateRacialColumnTotals, grantReportCompletion, isGrantReportVersionEditable, resolveGrantReportTemplate, subtractGrantAmounts } from "./editor";

test("Interim and Final resolve to the shared NLC template", () => {
  assert.equal(resolveGrantReportTemplate("INTERIM"), "NLC");
  assert.equal(resolveGrantReportTemplate("FINAL"), "NLC");
  assert.equal(resolveGrantReportTemplate("QUARTERLY_CASH_FLOW"), "COMING_SOON");
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
