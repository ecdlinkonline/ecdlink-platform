import assert from "node:assert/strict";
import test from "node:test";
import { buildGrantReportingCalendarWhere, getGrantReportingCalendar } from "./grant-report-calendar";

const filters = { state: "all" as const, financialYear: "2026", quarter: 3, page: 1 };

function record(overrides: Record<string, unknown> = {}) {
  return {
    id: "obligation-1", grantAwardId: "award-1", title: "Q2 Cash Flow", type: "QUARTERLY_CASH_FLOW",
    financialYear: "2026", quarter: 2, reportingPeriodStart: new Date("2026-07-01"), reportingPeriodEnd: new Date("2026-09-30"),
    dueAt: new Date("2026-10-07"), status: "OPEN",
    award: { id: "award-1", awardNumber: "AW-1", title: "Western Cape Fund", centre: { id: "centre-1", centreName: "Future Leaders" }, fundingProject: { id: "project-1", title: "Nutrition" }, organisations: [] },
    report: { id: "report-1", status: "DRAFT", currentVersionNumber: 1, updatedAt: new Date("2026-10-01"), versions: [] },
    ...overrides,
  };
}

test("calendar query is bounded to the selected due-date quarter and server-side filters", () => {
  const where = buildGrantReportingCalendarWhere({ ...filters, query: "Future", centreId: "centre-1", awardId: "award-1", type: "QUARTERLY_CASH_FLOW", state: "due_soon" }, new Date("2026-10-02"));
  const predicates = where.AND as Array<Record<string, unknown>>;
  assert.deepEqual(predicates[0], { dueAt: { gte: new Date("2026-10-01T00:00:00.000Z"), lt: new Date("2027-01-01T00:00:00.000Z") } });
  assert.ok(predicates.some((predicate) => "grantAwardId" in predicate));
  assert.ok(predicates.some((predicate) => "type" in predicate));
  assert.ok(predicates.some((predicate) => "OR" in predicate));
  assert.ok(predicates.some((predicate) => "AND" in predicate));
});

test("calendar uses exactly four bounded queries with maximum concurrency three", async () => {
  let calls = 0;
  let active = 0;
  let maximum = 0;
  const operation = async <T>(value: T) => {
    calls += 1;
    active += 1;
    maximum = Math.max(maximum, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
    return value;
  };
  const client = {
    grantReportingObligation: {
      count: async () => operation(31),
      findMany: async (args: Record<string, unknown>) => {
        assert.equal(args.take, 25);
        assert.equal(args.skip, 25);
        assert.deepEqual(args.orderBy, [{ dueAt: "asc" }, { createdAt: "asc" }]);
        return operation([
          record(),
          record({
            id: "obligation-2",
            award: { id: "award-2", awardNumber: "AW-2", title: "Second Fund", centre: { id: "centre-2", centreName: "Second Centre" }, fundingProject: { id: "project-2", title: "Learning" }, organisations: [] },
          }),
        ]);
      },
    },
    ecdCentre: { findMany: async (args: Record<string, unknown>) => {
      assert.equal(args.take, 500);
      return operation([{ id: "centre-1", centreName: "Future Leaders" }]);
    } },
    grantAward: { findMany: async (args: Record<string, unknown>) => {
      assert.equal(args.take, 500);
      return operation([{ id: "award-1", awardNumber: "AW-1", title: "Fund", centreId: "centre-1" }]);
    } },
  };
  const result = await getGrantReportingCalendar({ ...filters, page: 2 }, client as never, new Date("2026-10-02"));
  assert.equal(calls, 4);
  assert.equal(maximum, 3);
  assert.deepEqual(result.rows.map((row) => [row.obligationId, row.centreName]), [
    ["obligation-1", "Future Leaders"],
    ["obligation-2", "Second Centre"],
  ]);
  assert.equal(result.rows[0].dueState, "DUE_SOON");
  assert.equal(result.period.current, true);
  assert.deepEqual(result.pagination, { page: 2, pageSize: 25, total: 31, totalPages: 2, hasPreviousPage: true, hasNextPage: false });
});

test("calendar returns persisted obligations only and preserves terminal submission evidence", async () => {
  const submitted = record({
    id: "submitted-obligation", status: "SUBMITTED",
    report: { id: "submitted-report", status: "SUBMITTED", currentVersionNumber: 1, updatedAt: new Date("2026-10-08"), versions: [{ submittedAt: new Date("2026-10-06") }] },
  });
  const missingReport = record({ id: "uncreated-obligation", report: null });
  const client = {
    grantReportingObligation: { count: async () => 2, findMany: async () => [submitted, missingReport] },
    ecdCentre: { findMany: async () => [] },
    grantAward: { findMany: async () => [] },
  };
  const result = await getGrantReportingCalendar(filters, client as never, new Date("2026-10-02"));
  assert.deepEqual(result.rows.map((row) => row.obligationId), ["submitted-obligation", "uncreated-obligation"]);
  assert.equal(result.rows[0].dueState, null);
  assert.equal(result.rows[0].submittedAt, "2026-10-06T00:00:00.000Z");
  assert.equal(result.rows[1].reportId, null);
  assert.equal(result.rows[1].dueState, "DUE_SOON");
  assert.equal("planned" in result, false);
});
