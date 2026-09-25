import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { canonicalQuarterlyDueDate, deriveGrantReportDueState, GRANT_REPORT_DUE_SOON_DAYS, proposeNextQuarterlyReportingPeriod } from "./lifecycle";

test("date-only due states do not make due-today or terminal obligations overdue", () => {
  assert.equal(deriveGrantReportDueState({ dueAt: "2026-09-24T00:00:00.000Z", today: "2026-09-24T23:59:59+02:00", obligationStatus: "OPEN" }), "DUE_SOON");
  assert.equal(deriveGrantReportDueState({ dueAt: "2026-09-23", today: "2026-09-24", obligationStatus: "OPEN" }), "OVERDUE");
  assert.equal(deriveGrantReportDueState({ dueAt: "2026-09-01", today: "2026-09-24", obligationStatus: "SUBMITTED" }), null);
  assert.equal(deriveGrantReportDueState({ dueAt: `2026-10-${String(8).padStart(2, "0")}`, today: "2026-09-24", obligationStatus: "OPEN" }), GRANT_REPORT_DUE_SOON_DAYS === 14 ? "DUE_SOON" : "UPCOMING");
  assert.equal(deriveGrantReportDueState({ dueAt: "2026-10-09", today: "2026-09-24", obligationStatus: "OPEN" }), "UPCOMING");
});

test("canonical quarterly next-period proposals roll through the financial year", () => {
  const source = (financialYear: string, quarter: number) => {
    const periods = [["2026-04-01", "2026-06-30"], ["2026-07-01", "2026-09-30"], ["2026-10-01", "2026-12-31"], ["2027-01-01", "2027-03-31"]];
    return { type: "QUARTERLY_CASH_FLOW", basis: "QUARTER", financialYear, quarter, reportingPeriodStart: periods[quarter - 1][0], reportingPeriodEnd: periods[quarter - 1][1] };
  };
  assert.deepEqual(proposeNextQuarterlyReportingPeriod(source("2026", 1)), { reportType: "QUARTERLY_CASH_FLOW", financialYear: "2026", quarter: 2, reportingPeriodStart: "2026-07-01", reportingPeriodEnd: "2026-09-30", dueAt: "2026-10-07" });
  assert.deepEqual(proposeNextQuarterlyReportingPeriod(source("2026", 2)), { reportType: "QUARTERLY_CASH_FLOW", financialYear: "2026", quarter: 3, reportingPeriodStart: "2026-10-01", reportingPeriodEnd: "2026-12-31", dueAt: "2027-01-07" });
  assert.deepEqual(proposeNextQuarterlyReportingPeriod(source("2026", 3)), { reportType: "QUARTERLY_CASH_FLOW", financialYear: "2026", quarter: 4, reportingPeriodStart: "2027-01-01", reportingPeriodEnd: "2027-03-31", dueAt: "2027-04-07" });
  assert.deepEqual(proposeNextQuarterlyReportingPeriod(source("2026", 4)), { reportType: "QUARTERLY_CASH_FLOW", financialYear: "2027", quarter: 1, reportingPeriodStart: "2027-04-01", reportingPeriodEnd: "2027-06-30", dueAt: "2027-07-07" });
  assert.equal(proposeNextQuarterlyReportingPeriod({ ...source("2026", 1), type: "CUSTOM" }), null);
  assert.equal(proposeNextQuarterlyReportingPeriod({ ...source("2026", 1), reportingPeriodEnd: "2026-06-29" }), null);
});

test("canonical quarterly deadlines use the seventh after quarter end across year and leap-year boundaries", () => {
  assert.equal(canonicalQuarterlyDueDate("2026-09-30"), "2026-10-07");
  assert.equal(canonicalQuarterlyDueDate("2026-12-31"), "2027-01-07");
  assert.equal(canonicalQuarterlyDueDate("2028-03-31"), "2028-04-07");
  assert.equal(canonicalQuarterlyDueDate("2028-06-30"), "2028-07-07");
});

test("proposal generation does not mutate a historical source due date", () => {
  const historical = { type: "QUARTERLY_CASH_FLOW", basis: "QUARTER", financialYear: "2026", quarter: 1, reportingPeriodStart: "2026-04-01", reportingPeriodEnd: "2026-06-30", dueAt: "2026-08-04" };
  const before = structuredClone(historical);
  assert.equal(proposeNextQuarterlyReportingPeriod(historical)?.dueAt, "2026-10-07");
  assert.deepEqual(historical, before);
});

test("next-period endpoint preserves database authorization and trusted-origin validation", () => {
  const route = readFileSync(new URL("../../app/api/grant-reporting-obligations/[obligationId]/next/route.ts", import.meta.url), "utf8");
  assert.match(route, /requireReportAdmin\(\)/);
  assert.match(route, /requireTrustedOrigin\(request\)/);
  assert.match(route, /createNextGrantReportingPeriod\(obligationId, input\.grantAwardId, input\.dueAt, context\.internalUser\.id\)/);
});

test("next-period UI requires explicit confirmation and warns that prior evidence is not copied", () => {
  const component = readFileSync(new URL("../../components/reports/grant-reporting-lifecycle.tsx", import.meta.url), "utf8");
  assert.match(component, /Create Next Period/);
  assert.match(component, /Opening this dialog does not create anything/);
  assert.match(component, /Financial lines, bank evidence, documents, certifications, readiness and reconciliation data will not be copied/);
  assert.match(component, /initialValues=\{\{ dueAt: item\.nextPeriodProposal\.dueAt \}\}/);
  assert.match(component, /Proposed due date/);
  assert.match(component, /Create Draft Report/);
  assert.match(component, /Obligation.*item\.obligationStatus/);
  assert.match(component, /Report.*item\.reportStatus/);
  assert.match(component, /Version \{item\.currentVersion\}/);
});
