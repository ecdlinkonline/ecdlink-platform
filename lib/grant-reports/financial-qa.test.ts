import assert from "node:assert/strict";
import test from "node:test";
import { buildQuarterlyFinancialQa, financialQaQuarterAmountDisplayState, hasRecordedFinancialActivity, type FinancialQaQuarter, type FinancialQaVersion } from "./financial-qa";
import { resolveQuarterlyReportingPeriod } from "./quarterly-period";

function version(overrides: Partial<FinancialQaVersion> = {}): FinancialQaVersion {
  return { reportId: "report", versionNumber: 1, authority: "SUBMITTED", currency: "ZAR", totalIncome: "100.10", totalExpenditure: "80.05", quarterlyExpenditureTotal: "80.05", cumulativeExpenditureTotal: "0.00", openingBankBalance: "0.00", closingBankBalance: "100.00", financialLines: [{ lineType: "EXPENDITURE", categoryCode: null, categoryName: "Bank Charges", quarterlyActual: "80.05", estimatedExpenditure: "80.05" }], hasRecordedFinancialActivity: true, bankEvidence: { openingBalance: "0.00", closingBalance: "100.00", accountFingerprints: ["account-a"], currencies: ["ZAR"] }, ...overrides };
}
function quarter(financialYear: string, value: 1 | 2 | 3 | 4, overrides: Partial<FinancialQaQuarter> = {}): FinancialQaQuarter {
  return { financialYear, quarter: value, reportType: "QUARTERLY_CASH_FLOW", ...resolveQuarterlyReportingPeriod(financialYear, value)!, coverageState: "SUBMITTED", reportId: `report-${financialYear}-${value}`, version: version({ reportId: `report-${financialYear}-${value}` }), ...overrides };
}
function completeInput() {
  const quarters = [
    quarter("2026", 1, { version: version({ closingBankBalance: "100.00" }) }),
    quarter("2026", 2, { version: version({ openingBankBalance: "100.00", closingBankBalance: "200.00" }) }),
    quarter("2026", 3, { version: version({ openingBankBalance: "200.00", closingBankBalance: "300.00" }) }),
    quarter("2026", 4, { version: version({ openingBankBalance: "300.00", closingBankBalance: "400.00" }) }),
  ];
  return { financialYear: "2026", reportType: "QUARTERLY_CASH_FLOW" as const, quarters, nextFinancialYearQ1: quarter("2027", 1, { version: version({ openingBankBalance: "400.00", closingBankBalance: "500.00" }) }) };
}

test("all four quarter transitions including Q4 year rollover preserve exact cents", () => {
  const result = buildQuarterlyFinancialQa(completeInput());
  assert.equal(result.state, "COMPLETE");
  assert.equal(result.totalSubmittedIncome, "400.40");
  assert.equal(result.totalSubmittedExpenditure, "320.20");
  assert.deepEqual(result.transitions.map((item) => item.status), ["MATCH", "MATCH", "MATCH", "MATCH"]);
  assert.deepEqual(result.transitions.at(-1), { fromFinancialYear: "2026", fromQuarter: 4, toFinancialYear: "2027", toQuarter: 1, status: "MATCH", previousClosingBalance: "400.00", currentOpeningBalance: "400.00", difference: "0.00" });
});

test("missing and Draft quarters stay separate and never contribute zero to official totals", () => {
  const input = completeInput();
  input.quarters[1] = quarter("2026", 2, { coverageState: "DRAFT", version: version({ authority: "DRAFT", totalIncome: "25.55", totalExpenditure: "10.11" }) });
  input.quarters[2] = quarter("2026", 3, { coverageState: "MISSING", reportId: null, version: null });
  const result = buildQuarterlyFinancialQa(input);
  assert.equal(result.state, "PROVISIONAL");
  assert.equal(result.totalSubmittedIncome, "200.20");
  assert.equal(result.quarterSummaries[1].provisionalIncome, "25.55");
  assert.equal(result.quarterSummaries[1].submittedIncome, null);
  assert.ok(result.findings.some((item) => item.code === "QUARTER_MISSING"));
  assert.ok(result.findings.some((item) => item.code === "QUARTER_DRAFT_ONLY"));
});

test("quarter amount presentation distinguishes empty drafts from recorded zero, nonzero, submitted zero and missing quarters", () => {
  assert.equal(hasRecordedFinancialActivity([]), false);
  assert.equal(hasRecordedFinancialActivity([{ lineType: "EXPENDITURE", categoryCode: null, categoryName: "Placeholder", quarterlyActual: null, estimatedExpenditure: null }]), false);
  assert.equal(hasRecordedFinancialActivity([{ lineType: "EXPENDITURE", categoryCode: null, categoryName: "Recorded zero", quarterlyActual: "0.00", estimatedExpenditure: null }]), true);
  assert.equal(hasRecordedFinancialActivity([{ lineType: "EXPENDITURE", categoryCode: null, categoryName: "Recorded amount", quarterlyActual: "12.34", estimatedExpenditure: null }]), true);
  const input = completeInput();
  input.quarters = [
    quarter("2026", 1, { coverageState: "DRAFT", version: version({ authority: "DRAFT", totalIncome: "0.00", totalExpenditure: "0.00", financialLines: [], hasRecordedFinancialActivity: false }) }),
    quarter("2026", 2, { coverageState: "DRAFT", version: version({ authority: "DRAFT", totalIncome: "0.00", totalExpenditure: "0.00", hasRecordedFinancialActivity: true }) }),
    quarter("2026", 3, { coverageState: "DRAFT", version: version({ authority: "DRAFT", totalIncome: "12.34", totalExpenditure: "5.67", hasRecordedFinancialActivity: true }) }),
    quarter("2026", 4, { coverageState: "SUBMITTED", version: version({ totalIncome: "0.00", totalExpenditure: "0.00", financialLines: [], hasRecordedFinancialActivity: false }) }),
  ];
  const summaries = buildQuarterlyFinancialQa(input).quarterSummaries;
  assert.equal(financialQaQuarterAmountDisplayState(summaries[0]), "NOT_RECORDED");
  assert.equal(financialQaQuarterAmountDisplayState(summaries[1]), "RECORDED");
  assert.equal(financialQaQuarterAmountDisplayState(summaries[2]), "RECORDED");
  assert.equal(financialQaQuarterAmountDisplayState(summaries[3]), "RECORDED");
  assert.equal(summaries[1].provisionalIncome, "0.00");
  assert.equal(summaries[2].provisionalIncome, "12.34");
  assert.equal(summaries[3].submittedIncome, "0.00");

  const missing = buildQuarterlyFinancialQa({ ...completeInput(), quarters: [quarter("2026", 1, { coverageState: "MISSING", reportId: null, version: null }), ...completeInput().quarters.slice(1)] }).quarterSummaries[0];
  assert.equal(financialQaQuarterAmountDisplayState(missing), "UNAVAILABLE");
  assert.equal(missing.submittedIncome, null);
  assert.equal(missing.provisionalIncome, null);
});

test("bank mismatch is confirmed only for the same identified account", () => {
  const mismatch = completeInput();
  mismatch.quarters[1] = quarter("2026", 2, { version: version({ openingBankBalance: "90.50", closingBankBalance: "200.00" }) });
  const mismatchResult = buildQuarterlyFinancialQa(mismatch);
  assert.equal(mismatchResult.transitions[0].status, "MISMATCH");
  assert.equal(mismatchResult.transitions[0].difference, "-9.50");
  assert.ok(mismatchResult.findings.some((item) => item.code === "BANK_BALANCE_DISCONTINUITY"));

  const unconfirmed = completeInput();
  unconfirmed.quarters[1] = quarter("2026", 2, { version: version({ openingBankBalance: "90.50", bankEvidence: { openingBalance: "90.50", closingBalance: "200.00", accountFingerprints: [], currencies: ["ZAR"] } }) });
  const unconfirmedResult = buildQuarterlyFinancialQa(unconfirmed);
  assert.equal(unconfirmedResult.transitions[0].status, "UNAVAILABLE");
  assert.ok(unconfirmedResult.findings.some((item) => item.code === "BANK_ACCOUNT_UNCONFIRMED"));
  assert.equal(unconfirmedResult.findings.some((item) => item.code === "BANK_BALANCE_DISCONTINUITY"), false);
});

test("currency mismatches make annual totals unavailable without FX conversion", () => {
  const input = completeInput();
  input.quarters[1] = quarter("2026", 2, { version: version({ currency: "USD" }) });
  const result = buildQuarterlyFinancialQa(input);
  assert.equal(result.state, "UNAVAILABLE");
  assert.equal(result.currency, null);
  assert.equal(result.totalSubmittedIncome, null);
  assert.ok(result.findings.some((item) => item.code === "CURRENCY_MISMATCH"));
});

test("bank evidence currency mismatches stay unavailable and never use FX conversion", () => {
  const input = completeInput();
  input.quarters[1] = quarter("2026", 2, { version: version({ openingBankBalance: "100.00", bankEvidence: { openingBalance: "100.00", closingBalance: "200.00", accountFingerprints: ["account-a"], currencies: ["USD"] } }) });
  const result = buildQuarterlyFinancialQa(input);
  assert.equal(result.transitions[0].status, "UNAVAILABLE");
  assert.ok(result.findings.some((item) => item.code === "BANK_CURRENCY_MISMATCH"));
});

test("negative corrections reduce the exact-cent running total but remain advisory", () => {
  const input = completeInput();
  input.quarters[0] = quarter("2026", 1, { version: version({ totalExpenditure: "100.10" }) });
  input.quarters[1] = quarter("2026", 2, { version: version({ totalExpenditure: "-20.05", openingBankBalance: "100.00", closingBankBalance: "200.00" }) });
  const result = buildQuarterlyFinancialQa(input);
  assert.equal(result.quarterSummaries[1].runningSubmittedExpenditure, "80.05");
  assert.equal(result.findings.find((item) => item.code === "EXPENDITURE_DECREASE_REVIEW")?.classification, "POTENTIAL_INCONSISTENCY");
});

test("editable or batch-specific unknown categories are not treated as stable mappings", () => {
  const input = completeInput();
  input.quarters[0] = quarter("2026", 1, { version: version({ financialLines: [{ lineType: "EXPENDITURE", categoryCode: "BANK_IMPORT:batch:EXPENDITURE:Ad hoc", categoryName: "Ad hoc local category", quarterlyActual: "10.00", estimatedExpenditure: "10.00" }] }) });
  const result = buildQuarterlyFinancialQa(input);
  assert.equal(result.findings.find((item) => item.code === "CATEGORY_MAPPING_UNCERTAIN")?.classification, "INSUFFICIENT_INFORMATION");
});

test("stable category codes can identify a cross-quarter label change without treating it as missing expenditure", () => {
  const input = completeInput();
  input.quarters[0] = quarter("2026", 1, { version: version({ financialLines: [{ lineType: "EXPENDITURE", categoryCode: "NUTRITION", categoryName: "Nutrition", quarterlyActual: "10.00", estimatedExpenditure: "10.00" }] }) });
  input.quarters[1] = quarter("2026", 2, { version: version({ openingBankBalance: "100.00", closingBankBalance: "200.00", financialLines: [{ lineType: "EXPENDITURE", categoryCode: "NUTRITION", categoryName: "Food programme", quarterlyActual: "12.00", estimatedExpenditure: "12.00" }] }) });
  const result = buildQuarterlyFinancialQa(input);
  assert.equal(result.findings.find((item) => item.code === "CATEGORY_LABEL_CHANGED")?.classification, "POTENTIAL_INCONSISTENCY");
  assert.equal(result.findings.some((item) => item.code === "QUARTER_MISSING"), false);
});

test("noncanonical periods produce advisory findings and no data mutations", () => {
  const input = completeInput();
  input.quarters[0] = quarter("2026", 1, { reportingPeriodEnd: "2026-06-29", coverageState: "NONCANONICAL" });
  const before = structuredClone(input);
  const result = buildQuarterlyFinancialQa(input);
  assert.ok(result.findings.some((item) => item.code === "PERIOD_NONCANONICAL"));
  assert.equal(result.totalSubmittedIncome, "300.30");
  assert.deepEqual(input, before);
});
