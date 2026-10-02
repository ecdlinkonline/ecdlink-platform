import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  deriveGrantReportDueDetails,
  deriveGrantReportProgressState,
  grantReportDueDateBounds,
  GRANT_REPORT_TERMINAL_OBLIGATION_STATUSES,
} from "@/lib/grant-reports/lifecycle";
import type { GrantReportingMonitoringFiltersInput } from "@/lib/validators/grant-reports";

export const GRANT_REPORT_MONITOR_PAGE_SIZE = 25;

export const grantReportingMonitoringSelect = {
  id: true,
  grantAwardId: true,
  title: true,
  type: true,
  financialYear: true,
  quarter: true,
  reportingPeriodStart: true,
  reportingPeriodEnd: true,
  dueAt: true,
  status: true,
  award: {
    select: {
      id: true,
      awardNumber: true,
      title: true,
      centre: { select: { id: true, centreName: true } },
      fundingProject: { select: { id: true, title: true } },
      organisations: {
        where: { removedAt: null },
        orderBy: [{ isPrimary: "desc" as const }, { addedAt: "asc" as const }],
        select: {
          id: true,
          organisationType: true,
          role: true,
          isPrimary: true,
          fundingOrganisation: { select: { id: true, name: true } },
          donorOrganisation: { select: { id: true, name: true, organisationName: true } },
        },
      },
    },
  },
  report: {
    select: {
      id: true,
      status: true,
      currentVersionNumber: true,
      updatedAt: true,
      versions: {
        where: { submittedAt: { not: null } },
        orderBy: { submittedAt: "desc" as const },
        take: 1,
        select: { submittedAt: true },
      },
    },
  },
} satisfies Prisma.GrantReportingObligationSelect;

export type GrantReportingMonitoringRecord = Prisma.GrantReportingObligationGetPayload<{
  select: typeof grantReportingMonitoringSelect;
}>;

function monitoringBaseWhere(filters: GrantReportingMonitoringFiltersInput): Prisma.GrantReportingObligationWhereInput {
  const predicates: Prisma.GrantReportingObligationWhereInput[] = [];
  const query = filters.query?.trim();

  if (filters.centreId) predicates.push({ award: { centreId: filters.centreId } });
  if (filters.type) predicates.push({ type: filters.type });
  if (filters.financialYear) predicates.push({ financialYear: filters.financialYear });
  if (filters.quarter) predicates.push({ quarter: filters.quarter });
  if (query) {
    predicates.push({
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { award: { awardNumber: { contains: query, mode: "insensitive" } } },
        { award: { title: { contains: query, mode: "insensitive" } } },
        { award: { centre: { centreName: { contains: query, mode: "insensitive" } } } },
        { award: { fundingProject: { title: { contains: query, mode: "insensitive" } } } },
      ],
    });
  }

  return predicates.length ? { AND: predicates } : {};
}

function activeObligationWhere(): Prisma.GrantReportingObligationWhereInput {
  return { status: { notIn: [...GRANT_REPORT_TERMINAL_OBLIGATION_STATUSES] } };
}

export function buildGrantReportingMonitoringWhere(filters: GrantReportingMonitoringFiltersInput, today: Date | string = new Date()): Prisma.GrantReportingObligationWhereInput {
  const base = monitoringBaseWhere(filters);
  const active = activeObligationWhere();
  const bounds = grantReportDueDateBounds(today);

  const viewWhere: Prisma.GrantReportingObligationWhereInput = filters.monitor === "attention"
    ? { AND: [active, { OR: [{ dueAt: { lt: bounds.afterDueSoon } }, { report: { is: { status: "RETURNED" } } }] }] }
    : filters.monitor === "due_soon"
      ? { AND: [active, { dueAt: { gte: bounds.today, lt: bounds.afterDueSoon } }] }
      : filters.monitor === "overdue"
        ? { AND: [active, { dueAt: { lt: bounds.today } }] }
        : filters.monitor === "draft"
          ? { AND: [active, { report: { is: { status: { in: ["DRAFT", "RETURNED"] } } } }] }
          : filters.monitor === "submitted"
            ? { OR: [{ status: "SUBMITTED" }, { report: { is: { status: "SUBMITTED" } } }] }
            : base;

  return filters.monitor === "all" ? base : { AND: [base, viewWhere] };
}

export function buildGrantReportingMonitoringMetricWheres(filters: GrantReportingMonitoringFiltersInput, today: Date | string = new Date()) {
  const base = monitoringBaseWhere(filters);
  const active = activeObligationWhere();
  const bounds = grantReportDueDateBounds(today);
  return {
    attentionNeeded: { AND: [base, active, { OR: [{ dueAt: { lt: bounds.afterDueSoon } }, { report: { is: { status: "RETURNED" } } }] }] },
    dueSoon: { AND: [base, active, { dueAt: { gte: bounds.today, lt: bounds.afterDueSoon } }] },
    overdue: { AND: [base, active, { dueAt: { lt: bounds.today } }] },
    draftInProgress: { AND: [base, active, { report: { is: { status: { in: ["DRAFT", "RETURNED"] } } } }] },
  } satisfies Record<string, Prisma.GrantReportingObligationWhereInput>;
}

export function buildGrantReportingMonitoringOrderBy(filters: GrantReportingMonitoringFiltersInput): Prisma.GrantReportingObligationOrderByWithRelationInput[] {
  return filters.monitor === "submitted"
    ? [{ dueAt: "desc" }, { createdAt: "desc" }]
    : [{ dueAt: "asc" }, { createdAt: "asc" }];
}

type Organisation = GrantReportingMonitoringRecord["award"]["organisations"][number];

function organisationName(organisation: Organisation) {
  return organisation.fundingOrganisation?.name
    ?? organisation.donorOrganisation?.organisationName
    ?? organisation.donorOrganisation?.name
    ?? "Unnamed organisation";
}

export function formatGrantAwardOrganisationSummary(organisations: Organisation[]) {
  if (organisations.length === 0) return "Unassigned";
  if (organisations.length === 1) return organisationName(organisations[0]);

  const primary = organisations.filter((organisation) => organisation.isPrimary || organisation.role === "LEAD_FUNDER");
  if (primary.length === 1) return `${organisationName(primary[0])} +${organisations.length - 1}`;
  return `${organisations.length} funding organisations`;
}

export function mapGrantReportingMonitoringRow(record: GrantReportingMonitoringRecord, today: Date | string = new Date()) {
  const due = deriveGrantReportDueDetails({ dueAt: record.dueAt, obligationStatus: record.status, today });
  const reportStatus = record.report?.status ?? null;
  return {
    obligationId: record.id,
    reportId: record.report?.id ?? null,
    awardId: record.grantAwardId,
    centreId: record.award.centre.id,
    centreName: record.award.centre.centreName,
    awardNumber: record.award.awardNumber,
    awardTitle: record.award.title,
    projectId: record.award.fundingProject.id,
    projectTitle: record.award.fundingProject.title,
    fundingOrganisations: record.award.organisations.map((organisation) => ({
      id: organisation.fundingOrganisation?.id ?? organisation.donorOrganisation?.id ?? organisation.id,
      type: organisation.organisationType,
      name: organisationName(organisation),
      role: organisation.role,
      isPrimary: organisation.isPrimary,
    })),
    fundingOrganisationSummary: formatGrantAwardOrganisationSummary(record.award.organisations),
    title: record.title,
    reportType: record.type,
    financialYear: record.financialYear,
    quarter: record.quarter,
    reportingPeriodStart: record.reportingPeriodStart?.toISOString() ?? null,
    reportingPeriodEnd: record.reportingPeriodEnd?.toISOString() ?? null,
    dueAt: record.dueAt.toISOString(),
    obligationStatus: record.status,
    reportStatus,
    currentVersionNumber: record.report?.currentVersionNumber ?? null,
    progressState: deriveGrantReportProgressState({ obligationStatus: record.status, reportStatus }),
    dueState: due.dueState,
    daysFromDue: due.daysFromDue,
    dueLabel: due.label,
    submittedAt: record.report?.versions[0]?.submittedAt?.toISOString() ?? null,
  };
}

type MonitoringClient = Pick<typeof prisma, "grantReportingObligation" | "grantReportVersion">;

export async function getGrantReportingMonitoring(
  filters: GrantReportingMonitoringFiltersInput,
  client: MonitoringClient = prisma,
  today: Date = new Date(),
) {
  const where = buildGrantReportingMonitoringWhere(filters, today);
  const metricWheres = buildGrantReportingMonitoringMetricWheres(filters, today);
  const activeWhere: Prisma.GrantReportingObligationWhereInput | null = filters.monitor === "all"
    ? { AND: [monitoringBaseWhere(filters), activeObligationWhere()] }
    : null;
  // Keep each batch below the application's five-connection Prisma pool. The
  // Reports page can otherwise queue all KPI counts while other route data is
  // still using the pool, causing P2024 connection-acquisition timeouts.
  const [total, attentionNeeded, dueSoon] = await Promise.all([
    client.grantReportingObligation.count({ where }),
    client.grantReportingObligation.count({ where: metricWheres.attentionNeeded }),
    client.grantReportingObligation.count({ where: metricWheres.dueSoon }),
  ]);
  const [overdue, draftInProgress, financialYearRows] = await Promise.all([
    client.grantReportingObligation.count({ where: metricWheres.overdue }),
    client.grantReportingObligation.count({ where: metricWheres.draftInProgress }),
    client.grantReportingObligation.findMany({
      where: { financialYear: { not: null } },
      distinct: ["financialYear"],
      select: { financialYear: true },
      orderBy: { financialYear: "desc" },
      take: 100,
    }),
  ]);
  const activeTotal = activeWhere
    ? await client.grantReportingObligation.count({ where: activeWhere })
    : 0;
  const totalPages = Math.max(1, Math.ceil(total / GRANT_REPORT_MONITOR_PAGE_SIZE));
  const page = Math.min(filters.page, totalPages);
  let records: GrantReportingMonitoringRecord[];
  if (filters.monitor === "submitted") {
    const submissions = await client.grantReportVersion.findMany({
      where: { status: "SUBMITTED", submittedAt: { not: null }, report: { status: "SUBMITTED", obligation: where } },
      select: { report: { select: { obligationId: true } } },
      orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * GRANT_REPORT_MONITOR_PAGE_SIZE,
      take: GRANT_REPORT_MONITOR_PAGE_SIZE,
    });
    const obligationIds = submissions.map((submission) => submission.report.obligationId);
    const submittedRecords = obligationIds.length ? await client.grantReportingObligation.findMany({
      where: { id: { in: obligationIds } },
      select: grantReportingMonitoringSelect,
    }) : [];
    const byId = new Map(submittedRecords.map((record) => [record.id, record]));
    records = obligationIds.map((id) => byId.get(id)).filter((record): record is GrantReportingMonitoringRecord => Boolean(record));
  } else if (filters.monitor === "all") {
    const allActiveWhere = activeWhere ?? { id: { in: [] } };
    const offset = (page - 1) * GRANT_REPORT_MONITOR_PAGE_SIZE;
    const activeTake = Math.min(GRANT_REPORT_MONITOR_PAGE_SIZE, Math.max(0, activeTotal - offset));
    const terminalSkip = Math.max(0, offset - activeTotal);
    const terminalTake = Math.min(
      GRANT_REPORT_MONITOR_PAGE_SIZE - activeTake,
      Math.max(0, total - activeTotal - terminalSkip),
    );
    const [activeRecords, terminalRecords] = await Promise.all([
      activeTake > 0 ? client.grantReportingObligation.findMany({
        where: allActiveWhere,
        select: grantReportingMonitoringSelect,
        orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
        skip: offset,
        take: activeTake,
      }) : Promise.resolve([]),
      terminalTake > 0 ? client.grantReportingObligation.findMany({
        where: { AND: [monitoringBaseWhere(filters), { status: { in: [...GRANT_REPORT_TERMINAL_OBLIGATION_STATUSES] } }] },
        select: grantReportingMonitoringSelect,
        orderBy: [{ report: { updatedAt: "desc" } }, { dueAt: "desc" }, { createdAt: "desc" }],
        skip: terminalSkip,
        take: terminalTake,
      }) : Promise.resolve([]),
    ]);
    records = [...activeRecords, ...terminalRecords];
  } else {
    records = await client.grantReportingObligation.findMany({
      where,
      select: grantReportingMonitoringSelect,
      orderBy: buildGrantReportingMonitoringOrderBy(filters),
      skip: (page - 1) * GRANT_REPORT_MONITOR_PAGE_SIZE,
      take: GRANT_REPORT_MONITOR_PAGE_SIZE,
    });
  }

  return {
    metrics: { attentionNeeded, dueSoon, overdue, draftInProgress },
    rows: records.map((record) => mapGrantReportingMonitoringRow(record, today)),
    pagination: {
      page,
      pageSize: GRANT_REPORT_MONITOR_PAGE_SIZE,
      total,
      totalPages,
      hasPreviousPage: page > 1,
      hasNextPage: page < totalPages,
    },
    options: {
      financialYears: financialYearRows.map((row) => row.financialYear).filter((value): value is string => Boolean(value)),
    },
  };
}

export async function getGrantReportingMonitoringCentres() {
  return prisma.ecdCentre.findMany({
    where: { archivedAt: null },
    select: { id: true, centreName: true },
    orderBy: { centreName: "asc" },
    take: 500,
  });
}

export type GrantReportingMonitoringData = Awaited<ReturnType<typeof getGrantReportingMonitoring>>;
