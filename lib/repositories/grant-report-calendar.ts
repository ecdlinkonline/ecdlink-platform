import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  currentGrantReportingCalendarPeriod,
  grantReportingCalendarDateBounds,
  resolveGrantReportingCalendarPeriod,
  shiftGrantReportingCalendarPeriod,
} from "@/lib/grant-reports/calendar";
import {
  grantReportDueDateBounds,
  GRANT_REPORT_TERMINAL_OBLIGATION_STATUSES,
} from "@/lib/grant-reports/lifecycle";
import {
  grantReportingMonitoringSelect,
  mapGrantReportingMonitoringRow,
} from "@/lib/repositories/grant-report-monitoring";
import type { GrantReportingCalendarFiltersInput } from "@/lib/validators/grant-reports";

export const GRANT_REPORT_CALENDAR_PAGE_SIZE = 25;

function activeObligationWhere(): Prisma.GrantReportingObligationWhereInput {
  return { status: { notIn: [...GRANT_REPORT_TERMINAL_OBLIGATION_STATUSES] } };
}

export function resolveGrantReportingCalendarFiltersPeriod(filters: GrantReportingCalendarFiltersInput, today: Date | string = new Date()) {
  return filters.financialYear && filters.quarter
    ? resolveGrantReportingCalendarPeriod(filters.financialYear, filters.quarter)
    : currentGrantReportingCalendarPeriod(today);
}

export function buildGrantReportingCalendarWhere(filters: GrantReportingCalendarFiltersInput, today: Date | string = new Date()): Prisma.GrantReportingObligationWhereInput {
  const period = resolveGrantReportingCalendarFiltersPeriod(filters, today);
  const window = grantReportingCalendarDateBounds(period);
  const due = grantReportDueDateBounds(today);
  const predicates: Prisma.GrantReportingObligationWhereInput[] = [{ dueAt: { gte: window.start, lt: window.endExclusive } }];
  const query = filters.query?.trim();

  if (filters.centreId) predicates.push({ award: { centreId: filters.centreId } });
  if (filters.awardId) predicates.push({ grantAwardId: filters.awardId });
  if (filters.type) predicates.push({ type: filters.type });
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

  if (filters.state === "overdue") predicates.push({ AND: [activeObligationWhere(), { dueAt: { lt: due.today } }] });
  if (filters.state === "due_soon") predicates.push({ AND: [activeObligationWhere(), { dueAt: { gte: due.today, lt: due.afterDueSoon } }] });
  if (filters.state === "upcoming") predicates.push({ AND: [activeObligationWhere(), { dueAt: { gte: due.afterDueSoon } }] });
  if (filters.state === "submitted") predicates.push({ OR: [{ status: "SUBMITTED" }, { report: { is: { status: "SUBMITTED" } } }] });

  return { AND: predicates };
}

type CalendarClient = Pick<typeof prisma, "grantReportingObligation" | "ecdCentre" | "grantAward">;

export async function getGrantReportingCalendar(
  filters: GrantReportingCalendarFiltersInput,
  client: CalendarClient = prisma,
  today: Date = new Date(),
) {
  const period = resolveGrantReportingCalendarFiltersPeriod(filters, today);
  const currentPeriod = currentGrantReportingCalendarPeriod(today);
  const where = buildGrantReportingCalendarWhere(filters, today);
  const total = await client.grantReportingObligation.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / GRANT_REPORT_CALENDAR_PAGE_SIZE));
  const page = Math.min(filters.page, totalPages);
  const [records, centres, awards] = await Promise.all([
    client.grantReportingObligation.findMany({
      where,
      select: grantReportingMonitoringSelect,
      orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
      skip: (page - 1) * GRANT_REPORT_CALENDAR_PAGE_SIZE,
      take: GRANT_REPORT_CALENDAR_PAGE_SIZE,
    }),
    client.ecdCentre.findMany({
      where: { archivedAt: null },
      select: { id: true, centreName: true },
      orderBy: { centreName: "asc" },
      take: 500,
    }),
    client.grantAward.findMany({
      where: { status: { not: "ARCHIVED" } },
      select: { id: true, awardNumber: true, title: true, centreId: true },
      orderBy: [{ awardNumber: "asc" }, { createdAt: "asc" }],
      take: 500,
    }),
  ]);

  return {
    period: {
      ...period,
      current: period.financialYear === currentPeriod.financialYear && period.quarter === currentPeriod.quarter,
      previous: shiftGrantReportingCalendarPeriod(period, -1),
      next: shiftGrantReportingCalendarPeriod(period, 1),
    },
    rows: records.map((record) => mapGrantReportingMonitoringRow(record, today)),
    pagination: {
      page,
      pageSize: GRANT_REPORT_CALENDAR_PAGE_SIZE,
      total,
      totalPages,
      hasPreviousPage: page > 1,
      hasNextPage: page < totalPages,
    },
    options: { centres, awards },
  };
}

export type GrantReportingCalendarData = Awaited<ReturnType<typeof getGrantReportingCalendar>>;
