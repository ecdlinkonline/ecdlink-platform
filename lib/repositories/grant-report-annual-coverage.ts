import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { buildAnnualCoverage, type AnnualCoverageRecord, type AnnualCoverageReportType } from "@/lib/grant-reports/annual-coverage";
import { buildQuarterlyFinancialQa, hasRecordedFinancialActivity, type FinancialQaQuarter, type FinancialQaVersion } from "@/lib/grant-reports/financial-qa";
import { currentGrantReportingCalendarPeriod } from "@/lib/grant-reports/calendar";
import { resolveQuarterlyReportingPeriod } from "@/lib/grant-reports/quarterly-period";
import type { GrantReportingAnnualCoverageFiltersInput } from "@/lib/validators/grant-reports";

export const GRANT_REPORT_ANNUAL_AWARD_LIMIT = 500;
export const GRANT_REPORT_ANNUAL_OBLIGATION_LIMIT = 200;
export const GRANT_REPORT_ANNUAL_VERSION_LIMIT = 20;
export const GRANT_REPORT_ANNUAL_FINANCIAL_LINE_LIMIT = 1_000;
export const GRANT_REPORT_ANNUAL_BANK_IMPORT_LIMIT = 20;

const versionSelect = {
  id: true, versionNumber: true, status: true, submittedAt: true, currency: true,
  totalIncome: true, totalExpenditure: true, quarterlyExpenditureTotal: true, cumulativeExpenditureTotal: true,
  openingBankBalance: true, closingBankBalance: true,
} satisfies Prisma.GrantReportVersionSelect;

const obligationSelect = {
  id: true, type: true, basis: true, title: true, financialYear: true, quarter: true,
  reportingPeriodStart: true, reportingPeriodEnd: true, dueAt: true, status: true, customRequirements: true,
  report: {
    select: {
      id: true, status: true, currentVersionNumber: true,
      versions: { orderBy: { versionNumber: "desc" as const }, take: GRANT_REPORT_ANNUAL_VERSION_LIMIT, select: versionSelect },
    },
  },
} satisfies Prisma.GrantReportingObligationSelect;

type AnnualCoverageClient = Pick<typeof prisma, "grantAward" | "grantReportingObligation" | "grantReportFinancialLine" | "grantBankImportBatch">;
type ObligationRow = Prisma.GrantReportingObligationGetPayload<{ select: typeof obligationSelect }>;
type VersionRow = NonNullable<ObligationRow["report"]>["versions"][number];

function date(value: Date | null) { return value?.toISOString().slice(0, 10) ?? null; }
function officialVersion(report: NonNullable<ObligationRow["report"]>) {
  return report.versions.find((version) => ["SUBMITTED", "APPROVED"].includes(version.status) && version.submittedAt) ?? null;
}
function draftVersion(report: NonNullable<ObligationRow["report"]>) {
  return report.status === "DRAFT" ? report.versions.find((version) => version.versionNumber === report.currentVersionNumber && version.status === "DRAFT") ?? null : null;
}
function authoritativeVersion(report: ObligationRow["report"]) { return report ? officialVersion(report) ?? draftVersion(report) : null; }

function exactObligation(rows: ObligationRow[], financialYear: string, quarter: number, reportType: AnnualCoverageReportType) {
  const period = resolveQuarterlyReportingPeriod(financialYear, quarter);
  if (!period) return null;
  const matches = rows.filter((row) => row.type === reportType && row.basis === "QUARTER" && row.financialYear === financialYear && row.quarter === quarter && date(row.reportingPeriodStart) === period.reportingPeriodStart && date(row.reportingPeriodEnd) === period.reportingPeriodEnd);
  return matches.length === 1 ? matches[0] : null;
}

function statementEvidence(batches: Array<{ originatingGrantReportId: string; currency: string; statements: Array<{ accountFingerprint: string | null; openingBalance: Prisma.Decimal | null; closingBalance: Prisma.Decimal | null; currency: string | null; periodStart: Date | null; periodEnd: Date | null; statementMonth: Date | null }> }>, reportId: string) {
  const statements = batches.filter((batch) => batch.originatingGrantReportId === reportId).flatMap((batch) => batch.statements.map((statement) => ({ ...statement, batchCurrency: batch.currency }))).sort((left, right) => (left.periodStart ?? left.statementMonth ?? left.periodEnd ?? new Date(0)).getTime() - (right.periodStart ?? right.statementMonth ?? right.periodEnd ?? new Date(0)).getTime());
  if (!statements.length) return null;
  return {
    openingBalance: statements[0].openingBalance?.toFixed(2) ?? null,
    closingBalance: statements.at(-1)?.closingBalance?.toFixed(2) ?? null,
    accountFingerprints: Array.from(new Set(statements.map((row) => row.accountFingerprint).filter((value): value is string => Boolean(value)))),
    currencies: Array.from(new Set(statements.map((row) => (row.currency ?? row.batchCurrency).toUpperCase()))),
  };
}

function qaVersion(row: VersionRow | null, reportId: string | null, lines: Map<string, FinancialQaVersion["financialLines"]>, batches: Parameters<typeof statementEvidence>[0]): FinancialQaVersion | null {
  if (!row || !reportId) return null;
  const financialLines = lines.get(row.id) ?? [];
  return {
    reportId, versionNumber: row.versionNumber, authority: row.submittedAt && ["SUBMITTED", "APPROVED"].includes(row.status) ? "SUBMITTED" : "DRAFT",
    currency: row.currency, totalIncome: row.totalIncome.toFixed(2), totalExpenditure: row.totalExpenditure.toFixed(2), quarterlyExpenditureTotal: row.quarterlyExpenditureTotal.toFixed(2), cumulativeExpenditureTotal: row.cumulativeExpenditureTotal.toFixed(2),
    openingBankBalance: row.openingBankBalance?.toFixed(2) ?? null, closingBankBalance: row.closingBankBalance?.toFixed(2) ?? null,
    financialLines, hasRecordedFinancialActivity: hasRecordedFinancialActivity(financialLines), bankEvidence: statementEvidence(batches, reportId),
  };
}

function qaQuarter(input: { financialYear: string; quarter: 1 | 2 | 3 | 4; reportType: AnnualCoverageReportType; state: string; obligation: ObligationRow | null; lines: Map<string, FinancialQaVersion["financialLines"]>; batches: Parameters<typeof statementEvidence>[0] }): FinancialQaQuarter {
  const period = resolveQuarterlyReportingPeriod(input.financialYear, input.quarter)!;
  const report = input.obligation?.report ?? null;
  return { financialYear: input.financialYear, quarter: input.quarter, reportType: input.reportType, ...period, coverageState: input.state, reportId: report?.id ?? null, version: qaVersion(authoritativeVersion(report), report?.id ?? null, input.lines, input.batches) };
}

export async function getGrantReportingAnnualCoverage(filters: GrantReportingAnnualCoverageFiltersInput, client: AnnualCoverageClient = prisma, today = new Date()) {
  const awards = await client.grantAward.findMany({
    where: { status: { not: "ARCHIVED" } },
    select: { id: true, awardNumber: true, title: true, centre: { select: { centreName: true } }, fundingProject: { select: { title: true } } },
    orderBy: [{ awardNumber: "asc" }, { createdAt: "asc" }], take: GRANT_REPORT_ANNUAL_AWARD_LIMIT,
  });
  const selectedAward = filters.awardId ? awards.find((award) => award.id === filters.awardId) ?? null : awards[0] ?? null;
  const obligations = selectedAward ? await client.grantReportingObligation.findMany({ where: { grantAwardId: selectedAward.id }, select: obligationSelect, orderBy: [{ reportingPeriodStart: "asc" }, { dueAt: "asc" }, { createdAt: "asc" }], take: GRANT_REPORT_ANNUAL_OBLIGATION_LIMIT }) : [];
  const reportType = filters.reportType as AnnualCoverageReportType;
  const years = Array.from(new Set(obligations.filter((row) => row.type === reportType && row.financialYear).map((row) => row.financialYear!))).sort().reverse();
  const fallbackYear = currentGrantReportingCalendarPeriod(today).financialYear;
  const financialYear = filters.financialYear ?? years[0] ?? fallbackYear;
  const selectedRows = [...[1, 2, 3, 4].map((quarter) => exactObligation(obligations, financialYear, quarter, reportType)), exactObligation(obligations, String(Number(financialYear) + 1), 1, reportType)].filter((row): row is ObligationRow => Boolean(row));
  const selectedVersions = selectedRows.flatMap((row) => authoritativeVersion(row.report) ?? []).filter((row, index, all) => all.findIndex((candidate) => candidate.id === row.id) === index);
  const reportIds = selectedRows.flatMap((row) => row.report?.id ? [row.report.id] : []);
  const [financialLines, bankImports] = selectedAward && selectedVersions.length ? await Promise.all([
    client.grantReportFinancialLine.findMany({ where: { grantReportVersionId: { in: selectedVersions.map((version) => version.id) } }, select: { grantReportVersionId: true, lineType: true, categoryCode: true, categoryName: true, quarterlyActual: true, estimatedExpenditure: true }, orderBy: [{ grantReportVersionId: "asc" }, { displayOrder: "asc" }], take: GRANT_REPORT_ANNUAL_FINANCIAL_LINE_LIMIT }),
    client.grantBankImportBatch.findMany({ where: { originatingGrantReportId: { in: reportIds }, status: "CONFIRMED" }, select: { originatingGrantReportId: true, currency: true, statements: { select: { accountFingerprint: true, openingBalance: true, closingBalance: true, currency: true, periodStart: true, periodEnd: true, statementMonth: true }, orderBy: [{ periodStart: "asc" }, { statementMonth: "asc" }], take: 24 } }, orderBy: { createdAt: "asc" }, take: GRANT_REPORT_ANNUAL_BANK_IMPORT_LIMIT }),
  ]) : [[], []];
  const linesByVersion = new Map<string, FinancialQaVersion["financialLines"]>();
  for (const line of financialLines) linesByVersion.set(line.grantReportVersionId, [...(linesByVersion.get(line.grantReportVersionId) ?? []), { lineType: line.lineType, categoryCode: line.categoryCode, categoryName: line.categoryName, quarterlyActual: line.quarterlyActual?.toFixed(2) ?? null, estimatedExpenditure: line.estimatedExpenditure?.toFixed(2) ?? null }]);

  const records: AnnualCoverageRecord[] = obligations.map((row) => {
    const official = row.report ? officialVersion(row.report) : null;
    return { id: row.id, type: row.type, basis: row.basis, title: row.title, financialYear: row.financialYear, quarter: row.quarter, reportingPeriodStart: date(row.reportingPeriodStart), reportingPeriodEnd: date(row.reportingPeriodEnd), dueAt: row.dueAt.toISOString(), status: row.status, report: row.report ? { id: row.report.id, status: row.report.status, currentVersionNumber: row.report.currentVersionNumber, submittedVersions: official ? [{ versionNumber: official.versionNumber, status: official.status, submittedAt: official.submittedAt!.toISOString(), currency: official.currency, totalIncome: official.totalIncome.toFixed(2), totalExpenditure: official.totalExpenditure.toFixed(2) }] : [] } : null };
  });
  const coverage = selectedAward ? buildAnnualCoverage({ financialYear, reportType, obligations: records }) : null;
  const batches = bankImports as Parameters<typeof statementEvidence>[0];
  const financialQa = coverage ? buildQuarterlyFinancialQa({
    financialYear, reportType,
    quarters: coverage.quarters.map((quarter) => qaQuarter({ financialYear, quarter: quarter.quarter as 1 | 2 | 3 | 4, reportType, state: quarter.state, obligation: quarter.records.length === 1 ? obligations.find((row) => row.id === quarter.records[0].obligationId) ?? null : null, lines: linesByVersion, batches })),
    nextFinancialYearQ1: qaQuarter({ financialYear: String(Number(financialYear) + 1), quarter: 1, reportType, state: exactObligation(obligations, String(Number(financialYear) + 1), 1, reportType)?.report ? (officialVersion(exactObligation(obligations, String(Number(financialYear) + 1), 1, reportType)!.report!) ? "SUBMITTED" : "DRAFT") : "MISSING", obligation: exactObligation(obligations, String(Number(financialYear) + 1), 1, reportType), lines: linesByVersion, batches }),
  }) : null;
  return { selection: { awardId: selectedAward?.id ?? null, financialYear, reportType }, options: { awards, financialYears: years.includes(financialYear) ? years : [financialYear, ...years] }, coverage, financialQa, award: selectedAward, queryCount: selectedAward ? selectedVersions.length ? 4 : 2 : 1, maximumConcurrency: selectedAward && selectedVersions.length ? 2 : 1 };
}

export type GrantReportingAnnualCoverageData = Awaited<ReturnType<typeof getGrantReportingAnnualCoverage>>;
