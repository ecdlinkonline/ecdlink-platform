import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { buildGrantReportMetrics, buildGrantReportWhere, findMatchingQuarterlyExpenditureIncome, getGrantReportSubmissionHistory } from "./grant-reports";

test("submission history is award-scoped, bounded and uses submitted version evidence", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const submittedAt = new Date("2026-07-10T10:30:00.000Z");
  const client = { auditLog: { findMany: async (args: Record<string, unknown>) => { calls.push(args); return [{ entityId: "version-1", metadata: { readinessState: "NEEDS_REVIEW", warningAcknowledged: true, readinessWarningSnapshotVersion: 1, readinessWarnings: [{ id: "cash", group: "Financial Information", title: "Recorded cash position", detail: "Expenditure exceeds cash.", status: "NEEDS_REVIEW" }] } }]; } }, grantReport: {
    findUnique: async (args: Record<string, unknown>) => { calls.push(args); return { grantAwardId: "award-1" }; },
    findMany: async (args: Record<string, unknown>) => { calls.push(args); return [{
      id: "report-1", status: "SUBMITTED", currentVersionNumber: 1, obligation: { title: "Q1 Cash Flow", type: "QUARTERLY_CASH_FLOW" },
      versions: [{ id: "version-1", versionNumber: 1, status: "SUBMITTED", submittedAt,
        reportingPeriodStart: new Date("2026-04-01"), reportingPeriodEnd: new Date("2026-06-30"),
        submittedBy: { firstName: "Admin", lastName: "User" },
        certifications: [{ party: "COMPILER", nameSnapshot: "Compiler", designationSnapshot: "Principal", certificationDate: new Date("2026-07-09"), digitallyConfirmed: true, confirmedAt: submittedAt }],
      }],
    }]; },
  } };
  const history = await getGrantReportSubmissionHistory("report-1", client as never);
  assert.equal(calls.length, 3);
  assert.deepEqual(calls[0].where, { id: "report-1" });
  const query = calls[1];
  assert.deepEqual(query.where, { grantAwardId: "award-1", versions: { some: { submittedAt: { not: null } } } });
  assert.equal(query.take, 100);
  assert.equal((query.select as { versions: { take: number; where: unknown } }).versions.take, 20);
  assert.deepEqual((query.select as { versions: { where: unknown } }).versions.where, { submittedAt: { not: null } });
  assert.equal(history?.length, 1);
  assert.equal(history?.[0].submittedAt, submittedAt.toISOString());
  assert.equal(history?.[0].submittedBy, "Admin User");
  assert.equal(history?.[0].isCurrentVersion, true);
  assert.equal(history?.[0].certifications[0].digitallyConfirmed, true);
  assert.equal(history?.[0].recordedReadiness, "NEEDS_REVIEW");
  assert.equal(history?.[0].warningsAcknowledged, true);
  assert.deepEqual(history?.[0].readinessWarnings, [{ id: "cash", group: "Financial Information", title: "Recorded cash position", detail: "Expenditure exceeds cash." }]);
  assert.deepEqual((calls[2].where as { entityId: unknown }).entityId, { in: ["version-1"] });
});

test("legacy submission audits without warning snapshots remain readable without invented warnings", async () => {
  const client = { grantReport: {
    findUnique: async () => ({ grantAwardId: "award-1" }),
    findMany: async () => [{ id: "report-1", currentVersionNumber: 1, obligation: { title: "Q1", type: "QUARTERLY_CASH_FLOW" }, versions: [{ id: "version-1", versionNumber: 1, status: "SUBMITTED", submittedAt: new Date("2026-07-10"), reportingPeriodStart: null, reportingPeriodEnd: null, submittedBy: null, certifications: [] }] }],
  }, auditLog: { findMany: async () => [{ entityId: "version-1", metadata: { readinessState: "NEEDS_REVIEW", warningAcknowledged: true } }] } };
  const history = await getGrantReportSubmissionHistory("report-1", client as never);
  assert.equal(history?.[0].recordedReadiness, "NEEDS_REVIEW");
  assert.equal(history?.[0].warningsAcknowledged, true);
  assert.equal(history?.[0].readinessWarnings, null);
});

test("submission history does not enumerate award reports for an unknown report", async () => {
  let queried = false;
  const client = { grantReport: { findUnique: async () => null, findMany: async () => { queried = true; return []; } } };
  assert.equal(await getGrantReportSubmissionHistory("missing", client as never), null);
  assert.equal(queried, false);
});

test("grant report writes use a bounded transaction timeout suitable for remote databases", () => {
  const source = readFileSync(new URL("./grant-reports.ts", import.meta.url), "utf8");
  assert.match(source, /prisma\.\$transaction\(operation, \{ timeout: 15_000 \}\)/);
});

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
