"use client";

import Link from "next/link";
import { CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";
import { StatusBadge } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatGrantLabel, reportTypeLabels } from "@/lib/grant-reports/types";
import type { GrantReportingCalendarData } from "@/lib/repositories/grant-report-calendar";
import type { GrantReportingCalendarFiltersInput } from "@/lib/validators/grant-reports";

const calendarStates = [
  { value: "all", label: "All persisted obligations" },
  { value: "overdue", label: "Overdue" },
  { value: "due_soon", label: "Due Soon" },
  { value: "upcoming", label: "Upcoming" },
  { value: "submitted", label: "Submitted" },
] as const;

function dateLabel(value: string | null, options: Intl.DateTimeFormatOptions = { dateStyle: "medium" }) {
  return value ? new Intl.DateTimeFormat("en-ZA", { ...options, timeZone: "UTC" }).format(new Date(value)) : "—";
}

function calendarHref(filters: GrantReportingCalendarFiltersInput, changes: Partial<GrantReportingCalendarFiltersInput>) {
  const next = { ...filters, ...changes };
  const params = new URLSearchParams({ tab: "calendar", state: next.state });
  if (next.query) params.set("query", next.query);
  if (next.centreId) params.set("centreId", next.centreId);
  if (next.awardId) params.set("awardId", next.awardId);
  if (next.type) params.set("type", next.type);
  if (next.financialYear) params.set("financialYear", next.financialYear);
  if (next.quarter) params.set("quarter", String(next.quarter));
  if (next.page > 1) params.set("page", String(next.page));
  return `?${params.toString()}`;
}

export function GrantReportingCalendar({ data, filters }: { data: GrantReportingCalendarData; filters: GrantReportingCalendarFiltersInput }) {
  const grouped = new Map<string, typeof data.rows>();
  for (const row of data.rows) {
    const dueDate = row.dueAt.slice(0, 10);
    grouped.set(dueDate, [...(grouped.get(dueDate) ?? []), row]);
  }
  const pageStart = data.pagination.total === 0 ? 0 : (data.pagination.page - 1) * data.pagination.pageSize + 1;
  const pageEnd = Math.min(data.pagination.page * data.pagination.pageSize, data.pagination.total);

  return <div className="space-y-6">
    <Card className="dark:border-slate-800 dark:bg-slate-900">
      <CardHeader className="gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 dark:text-white"><CalendarClock className="h-5 w-5" />Reporting Calendar</CardTitle>
          <CardDescription className="mt-2 dark:text-slate-400">A due-date agenda of persisted reporting obligations. Viewing this calendar never creates a future reporting period.</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={calendarHref(filters, { financialYear: data.period.previous.financialYear, quarter: data.period.previous.quarter, page: 1 })}><Button type="button" variant="secondary"><ChevronLeft className="h-4 w-4" />Previous</Button></Link>
          <Link href={calendarHref(filters, { financialYear: undefined, quarter: undefined, page: 1 })}><Button type="button" variant={data.period.current ? "primary" : "secondary"}>Today</Button></Link>
          <Link href={calendarHref(filters, { financialYear: data.period.next.financialYear, quarter: data.period.next.quarter, page: 1 })}><Button type="button" variant="secondary">Next<ChevronRight className="h-4 w-4" /></Button></Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-brand-line bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Calendar window</p>
          <p className="mt-1 text-lg font-bold text-brand-ink dark:text-white">FY{data.period.financialYear} · Q{data.period.quarter}</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Due {dateLabel(data.period.windowStart)} – {dateLabel(data.period.windowEnd)}</p>
        </div>

        <form className="grid gap-3 rounded-lg border border-brand-line p-4 md:grid-cols-2 xl:grid-cols-3 dark:border-slate-700">
          <input type="hidden" name="tab" value="calendar" />
          <input type="hidden" name="financialYear" value={data.period.financialYear} />
          <input type="hidden" name="quarter" value={data.period.quarter} />
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300 md:col-span-2 xl:col-span-3">Search
            <input name="query" defaultValue={filters.query} maxLength={100} placeholder="Centre, award, project or report" className="mt-1 w-full rounded-lg border border-brand-line bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
          </label>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">State
            <select name="state" defaultValue={filters.state} className="mt-1 w-full rounded-lg border border-brand-line bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">{calendarStates.map((state) => <option key={state.value} value={state.value}>{state.label}</option>)}</select>
          </label>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">ECD Centre
            <select name="centreId" defaultValue={filters.centreId ?? ""} className="mt-1 w-full rounded-lg border border-brand-line bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"><option value="">All centres</option>{data.options.centres.map((centre) => <option key={centre.id} value={centre.id}>{centre.centreName}</option>)}</select>
          </label>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Grant Award
            <select name="awardId" defaultValue={filters.awardId ?? ""} className="mt-1 w-full rounded-lg border border-brand-line bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"><option value="">All awards</option>{data.options.awards.map((award) => <option key={award.id} value={award.id}>{award.awardNumber} · {award.title}</option>)}</select>
          </label>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Report Type
            <select name="type" defaultValue={filters.type ?? ""} className="mt-1 w-full rounded-lg border border-brand-line bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"><option value="">All types</option>{Object.entries(reportTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          </label>
          <div className="flex items-end gap-2 md:col-span-2"><Button type="submit">Apply filters</Button><Link href={calendarHref({ state: "all", page: 1 }, { financialYear: data.period.financialYear, quarter: data.period.quarter })}><Button type="button" variant="ghost">Clear</Button></Link></div>
        </form>
      </CardContent>
    </Card>

    {grouped.size ? <div className="space-y-6">{Array.from(grouped.entries()).map(([dueDate, rows]) => <section key={dueDate} aria-labelledby={`calendar-${dueDate}`} className="space-y-3">
      <div className="flex items-center gap-3"><div className="h-px flex-1 bg-brand-line dark:bg-slate-800" /><h3 id={`calendar-${dueDate}`} className="shrink-0 text-sm font-bold text-brand-navy dark:text-blue-200">Due {dateLabel(dueDate, { weekday: "short", day: "numeric", month: "long", year: "numeric" })}</h3><div className="h-px flex-1 bg-brand-line dark:bg-slate-800" /></div>
      {rows.map((row) => <Card key={row.obligationId} className="overflow-hidden dark:border-slate-800 dark:bg-slate-900"><CardContent className="p-0"><div className={`border-l-4 p-4 sm:p-5 ${row.dueState === "OVERDUE" ? "border-red-500" : row.dueState === "DUE_SOON" ? "border-amber-500" : row.dueState === "UPCOMING" ? "border-blue-400" : "border-green-500"}`}>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><h4 className="font-bold text-brand-ink dark:text-white">{row.title}</h4><StatusBadge status={formatGrantLabel(row.progressState)} />{row.dueState ? <StatusBadge status={formatGrantLabel(row.dueState)} /> : null}</div>
            <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">{row.centreName} · {row.awardNumber}</p>
            <p className="mt-1 text-sm text-slate-500">{row.awardTitle} · {row.projectTitle}</p>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm lg:grid-cols-1">
            <div><dt className="text-xs font-bold text-slate-500">Report type</dt><dd>{reportTypeLabels[row.reportType]}</dd></div>
            <div><dt className="text-xs font-bold text-slate-500">Reporting period</dt><dd>{dateLabel(row.reportingPeriodStart)} – {dateLabel(row.reportingPeriodEnd)}</dd></div>
            {row.submittedAt ? <div className="col-span-2 lg:col-span-1"><dt className="text-xs font-bold text-slate-500">Submitted</dt><dd>{dateLabel(row.submittedAt, { dateStyle: "medium", timeStyle: "short" })}</dd></div> : null}
          </dl>
          <div className="flex flex-wrap items-center gap-3 lg:flex-col lg:items-end">
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{row.dueLabel ?? "Terminal obligation"}</p>
            {row.reportId ? <Link href={`/dashboard/super-admin/reports/${row.reportId}`} className="inline-flex min-h-9 items-center rounded-md border border-brand-line px-3 text-xs font-bold text-brand-navy hover:border-brand-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy">Open Report</Link> : <span className="text-xs font-semibold text-slate-500">Persisted obligation · Report not created</span>}
          </div>
        </div>
      </div></CardContent></Card>)}
    </section>)}</div> : <Card className="dark:border-slate-800 dark:bg-slate-900"><CardContent className="p-8 text-center"><CalendarClock className="mx-auto h-8 w-8 text-slate-400" /><p className="mt-3 font-bold">No persisted obligations are due in this calendar period</p><p className="mt-2 text-sm text-slate-500">Move to another quarter or clear a filter. Future periods are not created or inferred here.</p></CardContent></Card>}

    <div className="flex flex-col gap-3 border-t border-brand-line pt-4 text-sm sm:flex-row sm:items-center sm:justify-between dark:border-slate-700">
      <p className="text-slate-500">Showing {pageStart}–{pageEnd} of {data.pagination.total} persisted obligations</p>
      <div className="flex items-center gap-2">
        {data.pagination.hasPreviousPage ? <Link href={calendarHref(filters, { financialYear: data.period.financialYear, quarter: data.period.quarter, page: data.pagination.page - 1 })}><Button type="button" variant="secondary">Previous page</Button></Link> : <Button type="button" variant="secondary" disabled>Previous page</Button>}
        <span className="px-2 font-semibold">Page {data.pagination.page} of {data.pagination.totalPages}</span>
        {data.pagination.hasNextPage ? <Link href={calendarHref(filters, { financialYear: data.period.financialYear, quarter: data.period.quarter, page: data.pagination.page + 1 })}><Button type="button" variant="secondary">Next page</Button></Link> : <Button type="button" variant="secondary" disabled>Next page</Button>}
      </div>
    </div>
  </div>;
}
