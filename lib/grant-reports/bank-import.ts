export const grantBankImportReportTypes = ["QUARTERLY_EXPENDITURE", "QUARTERLY_CASH_FLOW"] as const;
export const editableGrantBankImportStatuses = ["UPLOADING", "NEEDS_REVIEW", "FAILED"] as const;

export function isGrantBankImportReportType(value: string): value is (typeof grantBankImportReportTypes)[number] {
  return grantBankImportReportTypes.includes(value as (typeof grantBankImportReportTypes)[number]);
}

export function isEditableGrantBankImportStatus(value: string) {
  return editableGrantBankImportStatuses.includes(value as (typeof editableGrantBankImportStatuses)[number]);
}

export function assertGrantBankImportCapacity(statementCount: number, replacing = false) {
  if (!replacing && statementCount >= 3) throw new Error("This import already has three bank statements.");
}

export function grantBankImportMatchesContext(
  batch: { grantAwardId: string; centreId: string; originatingGrantReportId: string; financialYear: string; quarter: number },
  context: { reportId: string; grantAwardId: string; centreId: string; financialYear: string; quarter: number },
) {
  return batch.originatingGrantReportId === context.reportId
    && batch.grantAwardId === context.grantAwardId
    && batch.centreId === context.centreId
    && batch.financialYear === context.financialYear
    && batch.quarter === context.quarter;
}

export function expectedGrantBankStatementMonths(periodStart: string, periodEnd: string) {
  const start = new Date(`${periodStart.slice(0, 10)}T00:00:00.000Z`);
  const end = new Date(`${periodEnd.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];
  const formatter = new Intl.DateTimeFormat("en-ZA", { month: "long", year: "numeric", timeZone: "UTC" });
  return Array.from({ length: 3 }, (_, index) => {
    const month = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index, 1));
    return month <= end ? { value: month.toISOString().slice(0, 10), label: formatter.format(month) } : null;
  }).filter((month): month is { value: string; label: string } => month !== null);
}

export type GrantBankStatementDto = {
  id: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  status: string;
  statementMonth: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  statementDate: string | null;
  bankName: string | null;
  accountHolderName: string | null;
  maskedAccountReference: string | null;
  openingBalance: string | null;
  closingBalance: string | null;
  currency: string | null;
};

export type GrantBankImportWorkspaceDto = {
  id: string;
  reportId: string;
  reportType: "QUARTERLY_EXPENDITURE" | "QUARTERLY_CASH_FLOW";
  centreName: string;
  awardNumber: string;
  awardTitle: string;
  financialYear: string;
  quarter: number;
  reportingPeriodStart: string;
  reportingPeriodEnd: string;
  currency: string;
  status: string;
  editable: boolean;
  statementsUploaded: number;
  expectedMonths: Array<{ value: string; label: string }>;
  statements: GrantBankStatementDto[];
};
