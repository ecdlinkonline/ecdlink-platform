import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildGrantReportingMonitoringMetricWheres,
  buildGrantReportingMonitoringOrderBy,
  buildGrantReportingMonitoringWhere,
  formatGrantAwardOrganisationSummary,
  getGrantReportingMonitoring,
  GRANT_REPORT_MONITOR_PAGE_SIZE,
  mapGrantReportingMonitoringRow,
  type GrantReportingMonitoringRecord,
} from "./grant-report-monitoring";

const baseFilters = { monitor: "all" as const, page: 1 };

function record(overrides: Partial<GrantReportingMonitoringRecord> = {}): GrantReportingMonitoringRecord {
  return {
    id: "obligation-1",
    grantAwardId: "award-1",
    title: "Q2 Cash Flow",
    type: "QUARTERLY_CASH_FLOW",
    financialYear: "2026",
    quarter: 2,
    reportingPeriodStart: new Date("2026-07-01T00:00:00.000Z"),
    reportingPeriodEnd: new Date("2026-09-30T00:00:00.000Z"),
    dueAt: new Date("2026-10-07T00:00:00.000Z"),
    status: "OPEN",
    award: {
      id: "award-1",
      awardNumber: "AW-2026-1",
      title: "Western Cape ECD Fund",
      centre: { id: "centre-1", centreName: "Future Leaders" },
      fundingProject: { id: "project-1", title: "ECD Expansion" },
      organisations: [{ id: "party-1", organisationType: "FUNDING_ORGANISATION", role: "LEAD_FUNDER", isPrimary: true, fundingOrganisation: { id: "org-1", name: "Community Fund" }, donorOrganisation: null }],
    },
    report: { id: "report-1", status: "DRAFT", currentVersionNumber: 1, updatedAt: new Date("2026-09-01"), versions: [] },
    ...overrides,
  };
}

test("monitoring filters combine persisted fields and bounded server-side search", () => {
  const where = buildGrantReportingMonitoringWhere({ monitor: "draft", page: 1, query: "Future", centreId: "centre-1", type: "QUARTERLY_CASH_FLOW", financialYear: "2026", quarter: 2 }, "2026-09-29");
  const serialized = JSON.stringify(where);
  assert.match(serialized, /centre-1/);
  assert.match(serialized, /QUARTERLY_CASH_FLOW/);
  assert.match(serialized, /2026/);
  assert.match(serialized, /Future/);
  assert.match(serialized, /centreName/);
  assert.match(serialized, /awardNumber/);
  assert.match(serialized, /fundingProject/);
  assert.match(serialized, /RETURNED/);
});

test("attention KPI is one database union while due and draft metrics intentionally overlap", () => {
  const wheres = buildGrantReportingMonitoringMetricWheres(baseFilters, "2026-09-29");
  const attention = JSON.stringify(wheres.attentionNeeded);
  assert.match(attention, /"OR"/);
  assert.match(attention, /2026-10-14/);
  assert.match(attention, /RETURNED/);
  assert.match(JSON.stringify(wheres.dueSoon), /2026-09-29/);
  assert.match(JSON.stringify(wheres.overdue), /2026-09-29/);
  assert.match(JSON.stringify(wheres.draftInProgress), /DRAFT/);
});

test("active monitoring sorts by deadline while submitted rows use a dedicated submitted-at query", () => {
  assert.deepEqual(buildGrantReportingMonitoringOrderBy(baseFilters), [{ dueAt: "asc" }, { createdAt: "asc" }]);
  assert.deepEqual(buildGrantReportingMonitoringOrderBy({ monitor: "submitted", page: 1 }), [{ dueAt: "desc" }, { createdAt: "desc" }]);
});

test("organisation summaries never invent a sole funder", () => {
  const first = record().award.organisations[0];
  const second = { ...first, id: "party-2", role: "CO_FUNDER" as const, isPrimary: false, fundingOrganisation: { id: "org-2", name: "Second Fund" } };
  assert.equal(formatGrantAwardOrganisationSummary([first]), "Community Fund");
  assert.equal(formatGrantAwardOrganisationSummary([first, second]), "Community Fund +1");
  assert.equal(formatGrantAwardOrganisationSummary([{ ...first, isPrimary: false, role: "CO_FUNDER" }, second]), "2 funding organisations");
  assert.equal(formatGrantAwardOrganisationSummary([{ ...first, isPrimary: true }, { ...second, isPrimary: true }]), "2 funding organisations");
});

test("row mapping preserves missing reports and derives Q2 as eight days remaining", () => {
  const q2 = mapGrantReportingMonitoringRow(record(), "2026-09-29");
  assert.equal(q2.dueState, "DUE_SOON");
  assert.equal(q2.daysFromDue, 8);
  assert.equal(q2.dueLabel, "8 days remaining");
  const missing = mapGrantReportingMonitoringRow(record({ report: null }), "2026-09-29");
  assert.equal(missing.reportId, null);
  assert.equal(missing.currentVersionNumber, null);
  assert.equal(missing.reportStatus, null);
});

test("repository paginates actual matching obligations and keeps selections bounded", async () => {
  const calls: Array<{ method: string; args: Record<string, unknown> }> = [];
  const countValues = [31, 6, 4, 2, 12, 31];
  const client = { grantReportingObligation: {
    count: async (args: Record<string, unknown>) => { calls.push({ method: "count", args }); return countValues.shift() ?? 0; },
    findMany: async (args: Record<string, unknown>) => {
      calls.push({ method: "findMany", args });
      return "distinct" in args ? [{ financialYear: "2026" }] : [record()];
    },
  }, grantReportVersion: { findMany: async () => [] } };
  const result = await getGrantReportingMonitoring({ monitor: "all", page: 99 }, client as never, new Date("2026-09-29T00:00:00.000Z"));
  assert.deepEqual(result.metrics, { attentionNeeded: 6, dueSoon: 4, overdue: 2, draftInProgress: 12 });
  assert.equal(result.pagination.page, 2);
  assert.equal(result.pagination.total, 31);
  assert.equal(result.rows.length, 1);
  const rowQuery = calls.at(-1)?.args;
  assert.equal(rowQuery?.take, 6);
  assert.ok((rowQuery?.take as number) <= GRANT_REPORT_MONITOR_PAGE_SIZE);
  assert.equal(rowQuery?.skip, 25);
  assert.ok(rowQuery?.select);
  assert.equal("include" in (rowQuery ?? {}), false);
});

test("All keeps active work ahead of terminal history without dropping either population", async () => {
  const counts = [2, 1, 1, 0, 1, 1];
  let rowQuery = 0;
  const active = record({ id: "active" });
  const submitted = record({ id: "submitted", status: "SUBMITTED", report: { ...record().report!, status: "SUBMITTED", versions: [{ submittedAt: new Date("2026-09-20") }] } });
  const client = {
    grantReportingObligation: {
      count: async () => counts.shift() ?? 0,
      findMany: async (args: Record<string, unknown>) => {
        if ("distinct" in args) return [{ financialYear: "2026" }];
        rowQuery += 1;
        return rowQuery === 1 ? [active] : [submitted];
      },
    },
    grantReportVersion: { findMany: async () => [] },
  };
  const result = await getGrantReportingMonitoring({ monitor: "all", page: 1 }, client as never, new Date("2026-09-29"));
  assert.deepEqual(result.rows.map((row) => row.obligationId), ["active", "submitted"]);
  assert.equal(result.pagination.total, 2);
});

test("submitted monitoring paginates by persisted submission time and restores that exact order", async () => {
  const obligationQueries: Array<Record<string, unknown>> = [];
  const versionQueries: Array<Record<string, unknown>> = [];
  const first = record({ id: "obligation-new", report: { ...record().report!, id: "report-new", status: "SUBMITTED", versions: [{ submittedAt: new Date("2026-09-20") }] } });
  const second = record({ id: "obligation-old", report: { ...record().report!, id: "report-old", status: "SUBMITTED", versions: [{ submittedAt: new Date("2026-08-20") }] } });
  let countCall = 0;
  const client = {
    grantReportingObligation: {
      count: async () => (++countCall === 1 ? 2 : 0),
      findMany: async (args: Record<string, unknown>) => {
        obligationQueries.push(args);
        if ("distinct" in args) return [{ financialYear: "2026" }];
        return [second, first];
      },
    },
    grantReportVersion: { findMany: async (args: Record<string, unknown>) => {
      versionQueries.push(args);
      return [{ report: { obligationId: "obligation-new" } }, { report: { obligationId: "obligation-old" } }];
    } },
  };
  const result = await getGrantReportingMonitoring({ monitor: "submitted", page: 1 }, client as never, new Date("2026-09-29"));
  assert.deepEqual(result.rows.map((row) => row.obligationId), ["obligation-new", "obligation-old"]);
  assert.deepEqual(versionQueries[0].orderBy, [{ submittedAt: "desc" }, { id: "desc" }]);
  assert.equal(versionQueries[0].take, 25);
  assert.deepEqual((obligationQueries.at(-1)?.where as { id: { in: string[] } }).id.in, ["obligation-new", "obligation-old"]);
});

test("monitoring limits concurrent Prisma operations below the five-connection pool", async () => {
  let active = 0;
  let maximum = 0;
  const operation = async <T>(value: T) => {
    active += 1;
    maximum = Math.max(maximum, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
    return value;
  };
  const client = {
    grantReportingObligation: {
      count: async () => operation(0),
      findMany: async (args: Record<string, unknown>) => operation("distinct" in args ? [] : []),
    },
    grantReportVersion: { findMany: async () => operation([]) },
  };

  await getGrantReportingMonitoring(baseFilters, client as never, new Date("2026-09-29"));
  assert.equal(maximum, 3);
});

test("reports page authorizes before loading either reporting repository", () => {
  const page = readFileSync(new URL("../../app/dashboard/super-admin/reports/page.tsx", import.meta.url), "utf8");
  const authorization = page.indexOf("await requireSuperAdmin()");
  assert.ok(authorization >= 0);
  assert.ok(authorization < page.indexOf("loadGrantReportsDashboard(activeTab"));
});
