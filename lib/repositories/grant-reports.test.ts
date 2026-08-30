import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { buildGrantReportMetrics, buildGrantReportWhere, findMatchingQuarterlyExpenditureIncome } from "./grant-reports";

test("report filters produce server-side persisted-data predicates", () => {
  const where = buildGrantReportWhere({ query: "Bright", status: "DRAFT", type: "FINAL", centreId: "centre-1", organisationId: "org-1" });
  assert.equal(where.status, "DRAFT");
  assert.deepEqual(where.obligation, { type: "FINAL" });
  assert.equal(where.award?.centreId, "centre-1");
  assert.ok(where.award && "OR" in where.award);
  assert.ok(where.award && "organisations" in where.award);
});

test("workspace KPI metrics are derived from persisted count results with zero defaults", () => {
  assert.deepEqual(buildGrantReportMetrics(3, 2, new Map([["DRAFT", 4], ["APPROVED", 7]])), {
    activeAwards: 3, reportsDue: 2, draftReports: 4, submittedReports: 0, returnedReports: 0, approvedReports: 7,
  });
});

test("cash flow income source matching is strictly award, centre, year and quarter scoped", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const client = { grantReportVersion: { findMany: async (args: Record<string, unknown>) => { calls.push(args); return []; } } };
  const result = await findMatchingQuarterlyExpenditureIncome({ grantAwardId: "award-1", centreId: "centre-1", financialYear: "2026", quarter: 2 }, client as never);
  assert.equal(result, null);
  assert.equal(calls.length, 3);
  for (const call of calls) {
    const where = call.where as { financialYear: string; quarter: number; report: { grantAwardId: string; award: { centreId: string }; obligation: { financialYear: string; quarter: number } } };
    assert.equal(where.report.grantAwardId, "award-1");
    assert.equal(where.report.award.centreId, "centre-1");
    assert.equal(where.financialYear, "2026");
    assert.equal(where.quarter, 2);
    assert.equal(where.report.obligation.financialYear, "2026");
    assert.equal(where.report.obligation.quarter, 2);
    assert.equal(call.take, 25);
  }
  assert.deepEqual((calls[2].where as { report: { status: unknown } }).report.status, { in: ["DRAFT", "RETURNED"] });
});

test("cash flow source precedence is approved, submitted, then current draft", async () => {
  const statuses: string[] = [];
  const client = { grantReportVersion: { findMany: async (args: { where: { status: string } }) => {
    statuses.push(args.where.status);
    if (args.where.status !== "SUBMITTED") return [];
    return [{ id: "version-2", status: "SUBMITTED", versionNumber: 2, report: { currentVersionNumber: 2 }, financialLines: [{ lineType: "FUNDING_RECEIVED", categoryName: "Department subsidy", quarterlyActual: new Prisma.Decimal("500.25") }] }];
  } } };
  const result = await findMatchingQuarterlyExpenditureIncome({ grantAwardId: "award-1", centreId: "centre-1", financialYear: "2026", quarter: 1 }, client as never);
  assert.deepEqual(statuses, ["APPROVED", "SUBMITTED"]);
  assert.equal(result?.status, "SUBMITTED");
  assert.deepEqual(result?.rows, [{ lineType: "FUNDING_RECEIVED", categoryName: "Subsidy", amount: "500.25" }]);
});

test("non-current matching versions are ignored and do not initialize cash flow", async () => {
  const client = { grantReportVersion: { findMany: async () => [{ id: "old-version", status: "APPROVED", versionNumber: 1, report: { currentVersionNumber: 2 }, financialLines: [] }] } };
  const result = await findMatchingQuarterlyExpenditureIncome({ grantAwardId: "award-1", centreId: "centre-1", financialYear: "2026", quarter: 1 }, client as never);
  assert.equal(result, null);
});
