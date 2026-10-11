import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { getGrantReportingAnnualCoverage, GRANT_REPORT_ANNUAL_AWARD_LIMIT, GRANT_REPORT_ANNUAL_OBLIGATION_LIMIT } from "./grant-report-annual-coverage";

test("annual coverage uses two bounded sequential queries and never creates quarters", async () => {
  const calls: string[] = [];
  let awardArgs: Record<string, unknown> | undefined;
  let obligationArgs: Record<string, unknown> | undefined;
  let active = 0;
  let maximumConcurrency = 0;
  const enter = () => { active += 1; maximumConcurrency = Math.max(maximumConcurrency, active); };
  const leave = () => { active -= 1; };
  const client = {
    grantAward: { findMany: async (args: Record<string, unknown>) => { enter(); calls.push("awards"); awardArgs = args; leave(); return [{ id: "award-1", awardNumber: "A-1", title: "Award", centre: { centreName: "Centre" }, fundingProject: { title: "Project" } }]; } },
    grantReportingObligation: { findMany: async (args: Record<string, unknown>) => { enter(); calls.push("obligations"); obligationArgs = args; leave(); return [{
      id: "q1", type: "QUARTERLY_CASH_FLOW", basis: "QUARTER", title: "Q1", financialYear: "2026", quarter: 1,
      reportingPeriodStart: new Date("2026-04-01"), reportingPeriodEnd: new Date("2026-06-30"), dueAt: new Date("2026-08-04"), status: "SUBMITTED", customRequirements: null,
      report: { id: "report-1", status: "SUBMITTED", currentVersionNumber: 1, versions: [{ versionNumber: 1, status: "SUBMITTED", submittedAt: new Date("2026-08-01"), currency: "ZAR", totalIncome: new Prisma.Decimal("500.00"), totalExpenditure: new Prisma.Decimal("400.25") }] },
    }]; } },
  };
  const result = await getGrantReportingAnnualCoverage({ awardId: "award-1", financialYear: "2026", reportType: "QUARTERLY_CASH_FLOW" }, client as never, new Date("2026-10-01"));
  assert.deepEqual(calls, ["awards", "obligations"]);
  assert.equal(maximumConcurrency, 1);
  assert.equal((awardArgs as { take: number }).take, GRANT_REPORT_ANNUAL_AWARD_LIMIT);
  assert.equal((obligationArgs as { take: number }).take, GRANT_REPORT_ANNUAL_OBLIGATION_LIMIT);
  assert.deepEqual((obligationArgs as { where: unknown }).where, { grantAwardId: "award-1" });
  assert.equal(result.queryCount, 2);
  assert.equal(result.coverage?.quarters[0].state, "SUBMITTED");
  assert.equal(result.coverage?.quarters[1].state, "MISSING");
  assert.equal("create" in client.grantReportingObligation, false);
});

test("empty awards require one query and return no generated obligations", async () => {
  let obligationQueried = false;
  const client = { grantAward: { findMany: async () => [] }, grantReportingObligation: { findMany: async () => { obligationQueried = true; return []; } } };
  const result = await getGrantReportingAnnualCoverage({ reportType: "QUARTERLY_EXPENDITURE" }, client as never, new Date("2026-10-01"));
  assert.equal(obligationQueried, false);
  assert.equal(result.coverage, null);
  assert.equal(result.queryCount, 1);
});

test("an unknown requested award does not silently expose another award", async () => {
  let obligationQueried = false;
  const client = {
    grantAward: { findMany: async () => [{ id: "award-1", awardNumber: "A-1", title: "Award", centre: { centreName: "Centre" }, fundingProject: { title: "Project" } }] },
    grantReportingObligation: { findMany: async () => { obligationQueried = true; return []; } },
  };
  const result = await getGrantReportingAnnualCoverage({ awardId: "unknown-award", reportType: "QUARTERLY_CASH_FLOW" }, client as never, new Date("2026-10-01"));
  assert.equal(obligationQueried, false);
  assert.equal(result.selection.awardId, null);
  assert.equal(result.coverage, null);
  assert.equal(result.queryCount, 1);
});
