import { resolveQuarterlyReportingPeriod } from "@/lib/grant-reports/quarterly-period";

export const GRANT_REPORT_DUE_SOON_DAYS = 14;

export type GrantReportDueState = "UPCOMING" | "DUE_SOON" | "OVERDUE" | null;

export const GRANT_REPORT_TERMINAL_OBLIGATION_STATUSES = ["SUBMITTED", "SATISFIED", "WAIVED", "CANCELLED", "ARCHIVED"] as const;

const terminalObligationStatuses = new Set<string>(GRANT_REPORT_TERMINAL_OBLIGATION_STATUSES);

function dateOnly(value: Date | string) {
  return (value instanceof Date ? value.toISOString() : value).slice(0, 10);
}

function utcDayNumber(value: Date | string) {
  const [year, month, day] = dateOnly(value).split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

export function grantReportDueDateBounds(today: Date | string = new Date()) {
  const todayDay = utcDayNumber(today);
  return {
    today: new Date(todayDay * 86_400_000),
    afterDueSoon: new Date((todayDay + GRANT_REPORT_DUE_SOON_DAYS + 1) * 86_400_000),
  };
}

export function deriveGrantReportDueDetails(input: { dueAt: Date | string; obligationStatus: string; today?: Date | string }) {
  if (terminalObligationStatuses.has(input.obligationStatus)) {
    return { dueState: null, daysFromDue: null, label: null } as const;
  }

  const daysFromDue = utcDayNumber(input.dueAt) - utcDayNumber(input.today ?? new Date());
  const dueState: Exclude<GrantReportDueState, null> = daysFromDue < 0
    ? "OVERDUE"
    : daysFromDue <= GRANT_REPORT_DUE_SOON_DAYS
      ? "DUE_SOON"
      : "UPCOMING";
  const label = daysFromDue === 0
    ? "Due today"
    : daysFromDue === 1
      ? "1 day remaining"
      : daysFromDue > 1
        ? `${daysFromDue} days remaining`
        : daysFromDue === -1
          ? "1 day overdue"
          : `${Math.abs(daysFromDue)} days overdue`;

  return { dueState, daysFromDue, label };
}

export function deriveGrantReportDueState(input: { dueAt: Date | string; obligationStatus: string; today?: Date | string }): GrantReportDueState {
  return deriveGrantReportDueDetails(input).dueState;
}

export function deriveGrantReportProgressState(input: { obligationStatus: string; reportStatus: string | null }) {
  if (input.obligationStatus === "SUBMITTED" || input.reportStatus === "SUBMITTED") return "SUBMITTED" as const;
  if (input.reportStatus === "DRAFT" || input.reportStatus === "RETURNED") return "DRAFT_IN_PROGRESS" as const;
  return input.obligationStatus;
}

export type NextQuarterlyReportingPeriodProposal = {
  reportType: "QUARTERLY_EXPENDITURE" | "QUARTERLY_CASH_FLOW";
  financialYear: string;
  quarter: number;
  reportingPeriodStart: string;
  reportingPeriodEnd: string;
  dueAt: string;
};

export function canonicalQuarterlyDueDate(reportingPeriodEnd: string) {
  const [year, month] = reportingPeriodEnd.split("-").map(Number);
  if (!year || !month) return null;
  return new Date(Date.UTC(month === 12 ? year + 1 : year, month === 12 ? 0 : month, 7)).toISOString().slice(0, 10);
}

export function proposeNextQuarterlyReportingPeriod(source: {
  type: string;
  basis: string;
  financialYear: string | null;
  quarter: number | null;
  reportingPeriodStart: Date | string | null;
  reportingPeriodEnd: Date | string | null;
}): NextQuarterlyReportingPeriodProposal | null {
  if (!(["QUARTERLY_EXPENDITURE", "QUARTERLY_CASH_FLOW"] as string[]).includes(source.type) || source.basis !== "QUARTER" || !source.financialYear || !source.quarter || !source.reportingPeriodStart || !source.reportingPeriodEnd) return null;
  const canonicalSource = resolveQuarterlyReportingPeriod(source.financialYear, source.quarter);
  if (!canonicalSource || dateOnly(source.reportingPeriodStart) !== canonicalSource.reportingPeriodStart || dateOnly(source.reportingPeriodEnd) !== canonicalSource.reportingPeriodEnd) return null;
  const quarter = source.quarter === 4 ? 1 : source.quarter + 1;
  const financialYear = String(Number(source.financialYear) + (source.quarter === 4 ? 1 : 0));
  const period = resolveQuarterlyReportingPeriod(financialYear, quarter);
  if (!period) return null;
  const dueAt = canonicalQuarterlyDueDate(period.reportingPeriodEnd);
  if (!dueAt) return null;
  return { reportType: source.type as NextQuarterlyReportingPeriodProposal["reportType"], financialYear, quarter, ...period, dueAt };
}
