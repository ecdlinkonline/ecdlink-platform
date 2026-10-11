import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { buildAnnualCoverage, type AnnualCoverageRecord, type AnnualCoverageReportType } from "@/lib/grant-reports/annual-coverage";
import { currentGrantReportingCalendarPeriod } from "@/lib/grant-reports/calendar";
import type { GrantReportingAnnualCoverageFiltersInput } from "@/lib/validators/grant-reports";

export const GRANT_REPORT_ANNUAL_AWARD_LIMIT = 500;
export const GRANT_REPORT_ANNUAL_OBLIGATION_LIMIT = 200;

const obligationSelect = {
  id: true, type: true, basis: true, title: true, financialYear: true, quarter: true,
  reportingPeriodStart: true, reportingPeriodEnd: true, dueAt: true, status: true, customRequirements: true,
  report: {
    select: {
      id: true, status: true, currentVersionNumber: true,
      versions: {
        where: { submittedAt: { not: null } },
        orderBy: [{ submittedAt: "desc" as const }, { versionNumber: "desc" as const }],
        take: 1,
        select: { versionNumber: true, status: true, submittedAt: true, currency: true, totalIncome: true, totalExpenditure: true },
      },
    },
  },
} satisfies Prisma.GrantReportingObligationSelect;

type AnnualCoverageClient = Pick<typeof prisma, "grantAward" | "grantReportingObligation">;

function date(value: Date | null) { return value?.toISOString().slice(0, 10) ?? null; }

export async function getGrantReportingAnnualCoverage(filters: GrantReportingAnnualCoverageFiltersInput, client: AnnualCoverageClient = prisma, today = new Date()) {
  const awards = await client.grantAward.findMany({
    where: { status: { not: "ARCHIVED" } },
    select: { id: true, awardNumber: true, title: true, centre: { select: { centreName: true } }, fundingProject: { select: { title: true } } },
    orderBy: [{ awardNumber: "asc" }, { createdAt: "asc" }],
    take: GRANT_REPORT_ANNUAL_AWARD_LIMIT,
  });
  const selectedAward = filters.awardId ? awards.find((award) => award.id === filters.awardId) ?? null : awards[0] ?? null;
  const obligations = selectedAward ? await client.grantReportingObligation.findMany({
    where: { grantAwardId: selectedAward.id },
    select: obligationSelect,
    orderBy: [{ reportingPeriodStart: "asc" }, { dueAt: "asc" }, { createdAt: "asc" }],
    take: GRANT_REPORT_ANNUAL_OBLIGATION_LIMIT,
  }) : [];
  const reportType = filters.reportType as AnnualCoverageReportType;
  const years = Array.from(new Set(obligations.filter((row) => row.type === reportType && row.financialYear).map((row) => row.financialYear!))).sort().reverse();
  const fallbackYear = currentGrantReportingCalendarPeriod(today).financialYear;
  const financialYear = filters.financialYear ?? years[0] ?? fallbackYear;
  const records: AnnualCoverageRecord[] = obligations.map((row) => ({
    id: row.id, type: row.type, basis: row.basis, title: row.title, financialYear: row.financialYear, quarter: row.quarter,
    reportingPeriodStart: date(row.reportingPeriodStart), reportingPeriodEnd: date(row.reportingPeriodEnd), dueAt: row.dueAt.toISOString(), status: row.status,
    report: row.report ? {
      id: row.report.id, status: row.report.status, currentVersionNumber: row.report.currentVersionNumber,
      submittedVersions: row.report.versions.map((version) => ({
        versionNumber: version.versionNumber, status: version.status, submittedAt: version.submittedAt!.toISOString(), currency: version.currency,
        totalIncome: version.totalIncome.toFixed(2), totalExpenditure: version.totalExpenditure.toFixed(2),
      })),
    } : null,
  }));
  return {
    selection: { awardId: selectedAward?.id ?? null, financialYear, reportType },
    options: { awards, financialYears: years.includes(financialYear) ? years : [financialYear, ...years] },
    coverage: selectedAward ? buildAnnualCoverage({ financialYear, reportType, obligations: records }) : null,
    award: selectedAward,
    queryCount: selectedAward ? 2 : 1,
    maximumConcurrency: 1,
  };
}

export type GrantReportingAnnualCoverageData = Awaited<ReturnType<typeof getGrantReportingAnnualCoverage>>;
