import assert from "node:assert/strict";
import test from "node:test";
import { buildAnnualCoverage, type AnnualCoverageRecord } from "./annual-coverage";

function record(quarter: number, overrides: Partial<AnnualCoverageRecord> = {}): AnnualCoverageRecord {
  const periods = [["2026-04-01", "2026-06-30"], ["2026-07-01", "2026-09-30"], ["2026-10-01", "2026-12-31"], ["2027-01-01", "2027-03-31"]];
  return { id: `obligation-${quarter}`, type: "QUARTERLY_CASH_FLOW", basis: "QUARTER", title: `Q${quarter}`, financialYear: "2026", quarter, reportingPeriodStart: periods[quarter - 1][0], reportingPeriodEnd: periods[quarter - 1][1], dueAt: "2026-10-07", status: "SUBMITTED", report: { id: `report-${quarter}`, status: "SUBMITTED", currentVersionNumber: 1, submittedVersions: [{ versionNumber: 1, status: "SUBMITTED", submittedAt: "2026-10-01T00:00:00.000Z", currency: "ZAR", totalIncome: "100.10", totalExpenditure: "80.05" }] }, ...overrides };
}

test("annual coverage resolves all four April-March quarters including Q4 rollover", () => {
  const result = buildAnnualCoverage({ financialYear: "2026", reportType: "QUARTERLY_CASH_FLOW", obligations: [] });
  assert.deepEqual(result.quarters.map(({ reportingPeriodStart, reportingPeriodEnd }) => [reportingPeriodStart, reportingPeriodEnd]), [["2026-04-01", "2026-06-30"], ["2026-07-01", "2026-09-30"], ["2026-10-01", "2026-12-31"], ["2027-01-01", "2027-03-31"]]);
  assert.deepEqual(result.quarters.map((quarter) => quarter.state), ["MISSING", "MISSING", "MISSING", "MISSING"]);
});

test("leap years do not change the canonical Q4 March boundary", () => {
  assert.equal(buildAnnualCoverage({ financialYear: "2027", reportType: "QUARTERLY_CASH_FLOW", obligations: [] }).quarters[3].reportingPeriodEnd, "2028-03-31");
});

test("draft, obligation-only, submitted and terminal quarters remain distinct", () => {
  const result = buildAnnualCoverage({ financialYear: "2026", reportType: "QUARTERLY_CASH_FLOW", obligations: [record(1), record(2, { status: "OPEN", report: { id: "report-2", status: "DRAFT", currentVersionNumber: 1, submittedVersions: [] } }), record(3, { status: "OPEN", report: null }), record(4, { status: "WAIVED", report: null })] });
  assert.deepEqual(result.quarters.map((quarter) => quarter.state), ["SUBMITTED", "DRAFT", "OBLIGATION_ONLY", "TERMINAL"]);
  assert.equal(result.summary.complete, false);
});

test("duplicate, noncanonical and overlapping quarters are detected", () => {
  const result = buildAnnualCoverage({ financialYear: "2026", reportType: "QUARTERLY_CASH_FLOW", obligations: [record(1), record(1, { id: "duplicate" }), record(2, { reportingPeriodEnd: "2026-09-29" }), record(4, { financialYear: null, quarter: null, reportingPeriodStart: "2026-12-15", reportingPeriodEnd: "2027-01-15" })] });
  assert.equal(result.quarters[0].state, "DUPLICATE");
  assert.equal(result.quarters[1].state, "NONCANONICAL");
  assert.equal(result.quarters[2].state, "OVERLAPPING");
  assert.equal(result.quarters[3].state, "OVERLAPPING");
});

test("annual totals use authoritative submitted versions with exact cents and stay provisional", () => {
  const result = buildAnnualCoverage({ financialYear: "2026", reportType: "QUARTERLY_CASH_FLOW", obligations: [record(1), record(2)] });
  assert.equal(result.financialSummary.totalIncome, "200.20");
  assert.equal(result.financialSummary.totalExpenditure, "160.10");
  assert.equal(result.financialSummary.provisional, true);
  assert.equal(result.summary.percentage, 50);
});

test("custom schedules remain separate and do not fill canonical quarter slots or invent due dates", () => {
  const custom = record(1, { id: "custom-1", type: "CUSTOM", basis: "CUSTOM", financialYear: null, quarter: null, reportingPeriodStart: "2026-05-01", reportingPeriodEnd: "2026-05-31", dueAt: "2026-08-19", report: null });
  const result = buildAnnualCoverage({ financialYear: "2026", reportType: "QUARTERLY_CASH_FLOW", obligations: [custom] });
  assert.equal(result.quarters[0].state, "MISSING");
  assert.equal(result.quarters[0].persistedDueAt, null);
  assert.equal(result.customSchedules[0].dueAt, "2026-08-19");
});

test("same-type irregular schedules remain visible outside canonical quarter coverage", () => {
  const irregular = record(1, { id: "irregular-1", basis: "CUSTOM", financialYear: null, quarter: null, reportingPeriodStart: "2026-08-01", reportingPeriodEnd: "2026-08-31", dueAt: "2026-09-15", report: null });
  const result = buildAnnualCoverage({ financialYear: "2026", reportType: "QUARTERLY_CASH_FLOW", obligations: [irregular] });
  assert.equal(result.customSchedules.length, 1);
  assert.equal(result.customSchedules[0].obligationId, "irregular-1");
});

test("a year is complete only when all four authoritative reports are submitted", () => {
  const result = buildAnnualCoverage({ financialYear: "2026", reportType: "QUARTERLY_CASH_FLOW", obligations: [1, 2, 3, 4].map((quarter) => record(quarter)) });
  assert.equal(result.summary.complete, true);
  assert.equal(result.financialSummary.provisional, false);
  assert.equal(result.financialSummary.totalIncome, "400.40");
});
