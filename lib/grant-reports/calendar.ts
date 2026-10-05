export type GrantReportingCalendarPeriod = {
  financialYear: string;
  quarter: number;
  windowStart: string;
  windowEnd: string;
};

function dateOnly(value: Date | string) {
  if (typeof value === "string") return value.slice(0, 10);
  const parts = new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function isoDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}

export function currentGrantReportingCalendarPeriod(today: Date | string = new Date()): GrantReportingCalendarPeriod {
  const [calendarYear, calendarMonth] = dateOnly(today).split("-").map(Number);
  const quarter = calendarMonth >= 4 && calendarMonth <= 6
    ? 1
    : calendarMonth >= 7 && calendarMonth <= 9
      ? 2
      : calendarMonth >= 10
        ? 3
        : 4;
  const financialYear = quarter === 4 ? calendarYear - 1 : calendarYear;
  return resolveGrantReportingCalendarPeriod(String(financialYear), quarter);
}

export function resolveGrantReportingCalendarPeriod(financialYear: string, quarter: number): GrantReportingCalendarPeriod {
  const year = Number(financialYear);
  if (!/^\d{4}$/.test(financialYear) || !Number.isInteger(quarter) || quarter < 1 || quarter > 4) {
    throw new Error("A valid financial year and quarter are required.");
  }
  const startMonth = quarter === 4 ? 0 : 3 + ((quarter - 1) * 3);
  const startYear = quarter === 4 ? year + 1 : year;
  return {
    financialYear,
    quarter,
    windowStart: isoDate(startYear, startMonth, 1),
    windowEnd: isoDate(startYear, startMonth + 3, 0),
  };
}

export function shiftGrantReportingCalendarPeriod(period: Pick<GrantReportingCalendarPeriod, "financialYear" | "quarter">, offset: -1 | 1) {
  const quarter = period.quarter + offset;
  if (quarter === 0) return resolveGrantReportingCalendarPeriod(String(Number(period.financialYear) - 1), 4);
  if (quarter === 5) return resolveGrantReportingCalendarPeriod(String(Number(period.financialYear) + 1), 1);
  return resolveGrantReportingCalendarPeriod(period.financialYear, quarter);
}

export function grantReportingCalendarDateBounds(period: GrantReportingCalendarPeriod) {
  const endYear = Number(period.windowEnd.slice(0, 4));
  const endMonth = Number(period.windowEnd.slice(5, 7));
  return {
    start: new Date(`${period.windowStart}T00:00:00.000Z`),
    endExclusive: new Date(Date.UTC(endYear, endMonth, 1)),
  };
}
