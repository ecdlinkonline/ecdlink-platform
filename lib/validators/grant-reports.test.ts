import assert from "node:assert/strict";
import test from "node:test";
import { createGrantAwardSchema, createGrantReportingObligationSchema, saveGrantReportBeneficiariesSchema, saveGrantReportCertificationsSchema, saveGrantReportFinancialSchema, saveQuarterlyBankReconciliationSchema, saveQuarterlyExpenditureGeneralSchema, saveQuarterlyExpenditureSchema, saveQuarterlyIncomeSchema } from "./grant-reports";

const award = {
  sourceType: "MANUAL", centreId: "centre-1", fundingProjectId: "project-1", awardNumber: "AW-001", title: "Nutrition grant",
  awardedAmount: 1000, currency: "ZAR", startDate: "2026-08-01", organisationType: "FUNDING_ORGANISATION", fundingOrganisationId: "funder-1",
};

test("manual awards require exactly one explicit organisation and no source record", () => {
  assert.equal(createGrantAwardSchema.safeParse(award).success, true);
  assert.equal(createGrantAwardSchema.safeParse({ ...award, fundingOrganisationId: "" }).success, false);
  assert.equal(createGrantAwardSchema.safeParse({ ...award, fundingApplicationId: "application-1" }).success, false);
});

test("optional blank dates are omitted and invalid award date ranges are rejected", () => {
  const parsed = createGrantAwardSchema.parse({ ...award, endDate: "" });
  assert.equal(parsed.endDate, undefined);
  assert.equal(createGrantAwardSchema.safeParse({ ...award, endDate: "2026-07-31" }).success, false);
});

test("signed agreement metadata is optional and valid dates and signature state are parsed", () => {
  const withoutAgreement = createGrantAwardSchema.parse(award);
  assert.equal(withoutAgreement.signedAgreementFileAssetId, undefined);
  assert.equal(withoutAgreement.signedByBothParties, false);
  const withAgreement = createGrantAwardSchema.parse({ ...award, signedAgreementFileAssetId: "file-1", agreementDate: "2026-08-20", signedByBothParties: true });
  assert.equal(withAgreement.signedAgreementFileAssetId, "file-1");
  assert.deepEqual(withAgreement.agreementDate, new Date("2026-08-20"));
  assert.equal(withAgreement.signedByBothParties, true);
});

test("obligation basis-specific requirements are enforced", () => {
  const base = { grantAwardId: "award-1", type: "CUSTOM", title: "Quarter one", dueAt: "2026-10-01" };
  assert.equal(createGrantReportingObligationSchema.safeParse({ ...base, basis: "QUARTER" }).success, false);
  assert.equal(createGrantReportingObligationSchema.safeParse({ ...base, basis: "QUARTER", financialYear: "2026", quarter: 1, reportingPeriodStart: "2026-01-01", reportingPeriodEnd: "2026-03-31" }).success, true);
  assert.equal(createGrantReportingObligationSchema.safeParse({ ...base, basis: "TRANCHE" }).success, false);
  assert.equal(createGrantReportingObligationSchema.safeParse({ ...base, basis: "TRANCHE", grantTrancheId: "tranche-1" }).success, true);
  assert.equal(createGrantReportingObligationSchema.safeParse({ ...base, basis: "FINAL" }).success, false);
});

test("standard report types reject inconsistent hidden basis values", () => {
  const period = { grantAwardId: "award-1", title: "Report", reportingPeriodStart: "2026-01-01", reportingPeriodEnd: "2026-03-31", dueAt: "2026-04-15" };
  assert.equal(createGrantReportingObligationSchema.safeParse({ ...period, type: "INTERIM", basis: "QUARTER", financialYear: "2026", quarter: 1 }).success, false);
  assert.equal(createGrantReportingObligationSchema.safeParse({ ...period, type: "FINAL", basis: "FINAL" }).success, false);
  assert.equal(createGrantReportingObligationSchema.safeParse({ ...period, type: "QUARTERLY_EXPENDITURE", basis: "QUARTER", financialYear: "2026", quarter: 1 }).success, true);
  assert.equal(createGrantReportingObligationSchema.safeParse({ ...period, type: "INTERIM", basis: "PERIOD", financialYear: "2026", quarter: 1 }).success, false);
  assert.equal(createGrantReportingObligationSchema.safeParse({ ...period, type: "CUSTOM", basis: "TRANCHE", grantTrancheId: "tranche-1" }).success, false);
});

test("beneficiary payloads require exact categories, non-negative values and arithmetic consistency", () => {
  const beneficiaries = ["CHILDREN_0_18", "YOUTH_18_35", "ADULTS_35_65", "OLDER_PERSONS_65_PLUS", "PEOPLE_WITH_DISABILITIES"].map((category) => ({ category, total: 3, male: 1, female: 2 }));
  const racialRows = ["AFRICAN", "COLOURED", "INDIAN_ASIAN", "WHITE"].map((racialGroup) => ({ racialGroup, children: 1, youth: 1, men: 1, women: 1, olderPersons: 1, peopleWithDisabilities: 1 }));
  const valid = { section: "beneficiaries", data: { beneficiaries, racialRows } };
  assert.equal(saveGrantReportBeneficiariesSchema.safeParse(valid).success, true);
  assert.equal(saveGrantReportBeneficiariesSchema.safeParse({ ...valid, data: { beneficiaries: beneficiaries.map((row, index) => index === 0 ? { ...row, total: 4 } : row), racialRows } }).success, false);
  assert.equal(saveGrantReportBeneficiariesSchema.safeParse({ ...valid, data: { beneficiaries, racialRows: racialRows.map((row, index) => index === 0 ? { ...row, men: -1 } : row) } }).success, false);
});

test("certification confirmation requires a date and financial amounts remain decimal strings", () => {
  const rows = ["COMPILER", "APPROVER"].map((party) => ({ party, nameSnapshot: "Named person", designationSnapshot: "Officer", certificationDate: "2026-08-29", digitallyConfirmed: true }));
  assert.equal(saveGrantReportCertificationsSchema.safeParse({ section: "certification", data: { rows } }).success, true);
  assert.equal(saveGrantReportCertificationsSchema.safeParse({ section: "certification", data: { rows: rows.map((row, index) => index === 0 ? { ...row, certificationDate: null } : row) } }).success, false);
  assert.equal(saveGrantReportFinancialSchema.safeParse({ section: "financial", data: { fundingReceivedTotal: "1000.10", previousTrancheBalance: "0.00", quarterlyExpenditureTotal: "200.09", rows: [] } }).success, true);
  assert.equal(saveGrantReportFinancialSchema.safeParse({ section: "financial", data: { fundingReceivedTotal: 1000.1, previousTrancheBalance: null, quarterlyExpenditureTotal: "0.00", rows: [] } }).success, false);
});

test("quarterly general and bank sections validate required period data and decimal balances", () => {
  assert.equal(saveQuarterlyExpenditureGeneralSchema.safeParse({ section: "quarterly_general", data: { financialYear: "2026", quarter: 1, reportingPeriodStart: "2026-01-01", reportingPeriodEnd: "2026-03-31" } }).success, true);
  assert.equal(saveQuarterlyExpenditureGeneralSchema.safeParse({ section: "quarterly_general", data: { financialYear: "", quarter: 5, reportingPeriodStart: "2026-04-01", reportingPeriodEnd: "2026-03-31" } }).success, false);
  assert.equal(saveQuarterlyBankReconciliationSchema.safeParse({ section: "bank_reconciliation", data: { openingBankBalance: "100.10", closingBankBalance: "200.20" } }).success, true);
  assert.equal(saveQuarterlyBankReconciliationSchema.safeParse({ section: "bank_reconciliation", data: { openingBankBalance: "-1.00", closingBankBalance: null } }).success, false);
});

test("quarterly income requires a consistent total", () => {
  const rows = [{ lineType: "FUNDING_RECEIVED", categoryName: "Department subsidy", amount: "1000.10" }, { lineType: "OTHER_INCOME", categoryName: "Other Income", amount: "20.05" }];
  assert.equal(saveQuarterlyIncomeSchema.safeParse({ section: "quarterly_income", data: { rows, totalIncome: "1020.15" } }).success, true);
  assert.equal(saveQuarterlyIncomeSchema.safeParse({ section: "quarterly_income", data: { rows, totalIncome: "1020.14" } }).success, false);
});

test("quarterly expenditure validates framework percentages, source splits, totals and surplus", () => {
  const row = { categoryName: "Nutrition", costingFrameworkPercentage: "25.00", quarterlyBudget: "500.00", fundingSourceActual: "200.10", otherSourceActual: "50.05", quarterlyActual: "250.15" };
  const valid = { section: "quarterly_expenditure", data: { rows: [row], totalAllocatedBudget: "500.00", totalFundingSourceExpenditure: "200.10", totalOtherSourceExpenditure: "50.05", totalExpenditure: "250.15", totalIncome: "1000.00", surplusDeficit: "749.85" } };
  assert.equal(saveQuarterlyExpenditureSchema.safeParse(valid).success, true);
  assert.equal(saveQuarterlyExpenditureSchema.safeParse({ ...valid, data: { ...valid.data, rows: [{ ...row, costingFrameworkPercentage: "100.01" }] } }).success, false);
  assert.equal(saveQuarterlyExpenditureSchema.safeParse({ ...valid, data: { ...valid.data, rows: [{ ...row, quarterlyActual: "250.14" }] } }).success, false);
  assert.equal(saveQuarterlyExpenditureSchema.safeParse({ ...valid, data: { ...valid.data, surplusDeficit: "749.84" } }).success, false);
});
