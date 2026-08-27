import assert from "node:assert/strict";
import test from "node:test";
import { buildGrantReportMetrics, buildGrantReportWhere } from "./grant-reports";

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
