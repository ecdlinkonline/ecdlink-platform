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

export function formatGrantReconciliationCurrency(value: string | number, currency = "ZAR") {
  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue)) return "—";
  const amount = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(numericValue));
  const sign = numericValue < 0 ? "-" : "";
  return currency.toUpperCase() === "ZAR" ? `${sign}R${amount}` : `${sign}${currency.toUpperCase()} ${amount}`;
}
