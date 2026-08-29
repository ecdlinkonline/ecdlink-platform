export type GrantReportWorkspaceData = Awaited<ReturnType<typeof import("@/lib/repositories/grant-reports").getGrantReportWorkspace>>;
export type GrantReportEditorData = NonNullable<Awaited<ReturnType<typeof import("@/lib/repositories/grant-reports").getGrantReportEditor>>>;

export const reportTypeLabels = {
  INTERIM: "Interim",
  FINAL: "Final",
  QUARTERLY_EXPENDITURE: "Quarterly Expenditure",
  QUARTERLY_CASH_FLOW: "Quarterly Cash Flow",
  CUSTOM: "Custom",
} as const;

export function formatGrantLabel(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatGrantCurrency(value: number, currency = "ZAR") {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}
