import assert from "node:assert/strict";
import test from "node:test";
import { createGrantAwardSchema, createGrantReportingObligationSchema } from "./grant-reports";

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

test("obligation basis-specific requirements are enforced", () => {
  const base = { grantAwardId: "award-1", type: "INTERIM", title: "Quarter one", dueAt: "2026-10-01" };
  assert.equal(createGrantReportingObligationSchema.safeParse({ ...base, basis: "QUARTER" }).success, false);
  assert.equal(createGrantReportingObligationSchema.safeParse({ ...base, basis: "QUARTER", financialYear: "2026", quarter: 1, reportingPeriodStart: "2026-01-01", reportingPeriodEnd: "2026-03-31" }).success, true);
  assert.equal(createGrantReportingObligationSchema.safeParse({ ...base, basis: "TRANCHE" }).success, false);
  assert.equal(createGrantReportingObligationSchema.safeParse({ ...base, basis: "TRANCHE", grantTrancheId: "tranche-1" }).success, true);
  assert.equal(createGrantReportingObligationSchema.safeParse({ ...base, basis: "FINAL" }).success, false);
});
