import { sumGrantAmounts } from "@/lib/grant-reports/editor";
import { resolveQuarterlyReportingPeriod } from "@/lib/grant-reports/quarterly-period";

export const annualCoverageReportTypes = ["QUARTERLY_EXPENDITURE", "QUARTERLY_CASH_FLOW"] as const;
export type AnnualCoverageReportType = typeof annualCoverageReportTypes[number];
export type AnnualQuarterState = "MISSING" | "OBLIGATION_ONLY" | "DRAFT" | "SUBMITTED" | "DUPLICATE" | "OVERLAPPING" | "NONCANONICAL" | "TERMINAL";

export type AnnualCoverageRecord = {
  id: string;
  type: string;
  basis: string;
  title: string;
  financialYear: string | null;
  quarter: number | null;
  reportingPeriodStart: string | null;
  reportingPeriodEnd: string | null;
  dueAt: string;
  status: string;
  report: null | {
    id: string;
    status: string;
    currentVersionNumber: number;
    submittedVersions: Array<{
      versionNumber: number;
      status: string;
      submittedAt: string;
      currency: string;
      totalIncome: string;
      totalExpenditure: string;
    }>;
  };
};

const terminalStatuses = new Set(["SATISFIED", "WAIVED", "CANCELLED", "ARCHIVED"]);
const completedReportStatuses = new Set(["SUBMITTED", "APPROVED"]);

function overlaps(record: AnnualCoverageRecord, start: string, end: string) {
  return Boolean(record.reportingPeriodStart && record.reportingPeriodEnd && record.reportingPeriodStart <= end && record.reportingPeriodEnd >= start);
}

function authoritativeSubmittedVersion(record: AnnualCoverageRecord) {
  return record.report?.submittedVersions[0] ?? null;
}

export function buildAnnualCoverage(input: { financialYear: string; reportType: AnnualCoverageReportType; obligations: AnnualCoverageRecord[] }) {
  const periods = [1, 2, 3, 4].map((quarter) => {
    const period = resolveQuarterlyReportingPeriod(input.financialYear, quarter);
    if (!period) throw new Error("A valid financial year is required.");
    return { quarter, ...period };
  });
  const relevant = input.obligations.filter((record) => record.type === input.reportType);
  const quarters = periods.map((period) => {
    const declared = relevant.filter((record) => record.financialYear === input.financialYear && record.quarter === period.quarter);
    const exact = declared.filter((record) => record.basis === "QUARTER" && record.reportingPeriodStart === period.reportingPeriodStart && record.reportingPeriodEnd === period.reportingPeriodEnd);
    const noncanonical = declared.filter((record) => !exact.includes(record));
    const overlapping = relevant.filter((record) => !declared.includes(record) && overlaps(record, period.reportingPeriodStart, period.reportingPeriodEnd));
    const candidates = [...declared, ...overlapping];
    const primary = exact[0] ?? noncanonical[0] ?? overlapping[0] ?? null;
    const submittedVersion = primary ? authoritativeSubmittedVersion(primary) : null;
    let state: AnnualQuarterState = "MISSING";
    if (candidates.length > 1) state = "DUPLICATE";
    else if (noncanonical.length) state = "NONCANONICAL";
    else if (!exact.length && overlapping.length) state = "OVERLAPPING";
    else if (primary && terminalStatuses.has(primary.status)) state = "TERMINAL";
    else if (primary && !primary.report) state = "OBLIGATION_ONLY";
    else if (primary && submittedVersion && completedReportStatuses.has(primary.report!.status)) state = "SUBMITTED";
    else if (primary?.report) state = "DRAFT";
    return {
      ...period,
      state,
      obligationStatus: primary?.status ?? null,
      persistedDueAt: primary?.dueAt ?? null,
      records: candidates.map((record) => ({
        obligationId: record.id,
        title: record.title,
        obligationStatus: record.status,
        reportId: record.report?.id ?? null,
        reportStatus: record.report?.status ?? null,
        currentVersionNumber: record.report?.currentVersionNumber ?? null,
        submittedVersionNumber: authoritativeSubmittedVersion(record)?.versionNumber ?? null,
        submittedAt: authoritativeSubmittedVersion(record)?.submittedAt ?? null,
      })),
      submittedFinancials: state === "SUBMITTED" && submittedVersion ? { currency: submittedVersion.currency, totalIncome: submittedVersion.totalIncome, totalExpenditure: submittedVersion.totalExpenditure } : null,
    };
  });
  const submitted = quarters.filter((quarter) => quarter.state === "SUBMITTED");
  const currencies = new Set(submitted.map((quarter) => quarter.submittedFinancials?.currency).filter(Boolean));
  const canAggregate = currencies.size <= 1;
  const complete = quarters.every((quarter) => quarter.state === "SUBMITTED");
  const customSchedules = input.obligations
    .filter((record) => record.basis !== "QUARTER" && overlaps(record, periods[0].reportingPeriodStart, periods[3].reportingPeriodEnd))
    .map((record) => ({ obligationId: record.id, title: record.title, type: record.type, basis: record.basis, reportingPeriodStart: record.reportingPeriodStart, reportingPeriodEnd: record.reportingPeriodEnd, dueAt: record.dueAt, status: record.status, reportId: record.report?.id ?? null }));
  return {
    financialYear: input.financialYear,
    reportType: input.reportType,
    quarters,
    customSchedules,
    summary: {
      obligationsPresent: quarters.filter((quarter) => quarter.state !== "MISSING").length,
      reportsCreated: quarters.filter((quarter) => quarter.records.some((record) => record.reportId)).length,
      reportsSubmitted: submitted.length,
      missingQuarters: quarters.filter((quarter) => quarter.state === "MISSING").length,
      draftOrInProgress: quarters.filter((quarter) => quarter.state === "DRAFT" || quarter.state === "OBLIGATION_ONLY").length,
      complete,
      percentage: submitted.length * 25,
    },
    financialSummary: {
      currency: currencies.size === 1 ? Array.from(currencies)[0] ?? null : null,
      totalIncome: canAggregate ? sumGrantAmounts(submitted.map((quarter) => quarter.submittedFinancials?.totalIncome)) : null,
      totalExpenditure: canAggregate ? sumGrantAmounts(submitted.map((quarter) => quarter.submittedFinancials?.totalExpenditure)) : null,
      provisional: !complete,
      available: submitted.length > 0 && canAggregate,
      reason: currencies.size > 1 ? "Submitted quarters use different currencies and cannot be safely aggregated." : null,
    },
  };
}
