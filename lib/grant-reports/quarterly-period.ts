export type QuarterlyReportingPeriod = {
  reportingPeriodStart: string;
  reportingPeriodEnd: string;
};

function dateOnly(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}

export function resolveQuarterlyReportingPeriod(financialYear: string, quarter: number | string | ""): QuarterlyReportingPeriod | null {
  const normalizedYear = financialYear.trim();
  const normalizedQuarter = Number(quarter);
  if (!/^\d{4}$/.test(normalizedYear) || !Number.isInteger(normalizedQuarter) || normalizedQuarter < 1 || normalizedQuarter > 4) return null;

  const financialYearStart = Number(normalizedYear);
  const startMonth = normalizedQuarter === 4 ? 0 : 3 + ((normalizedQuarter - 1) * 3);
  const startYear = normalizedQuarter === 4 ? financialYearStart + 1 : financialYearStart;
  return {
    reportingPeriodStart: dateOnly(startYear, startMonth, 1),
    reportingPeriodEnd: dateOnly(startYear, startMonth + 3, 0),
  };
}

export function applyQuarterlyReportingPeriod<T extends { financialYear: string; quarter: number | string | ""; reportingPeriodStart: string; reportingPeriodEnd: string }>(values: T): T {
  const period = resolveQuarterlyReportingPeriod(values.financialYear, values.quarter);
  return period ? { ...values, ...period } : values;
}
