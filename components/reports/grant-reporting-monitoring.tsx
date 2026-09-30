"use client";

import Link from "next/link";
import { AlertTriangle, CalendarClock, FileClock, TimerOff } from "lucide-react";
import { DataTable, KpiCard, StatusBadge } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatGrantLabel, reportTypeLabels, type GrantReportWorkspaceData } from "@/lib/grant-reports/types";
import type { GrantReportingMonitoringData } from "@/lib/repositories/grant-report-monitoring";
import type { GrantReportingMonitoringFiltersInput } from "@/lib/validators/grant-reports";

const monitoringViews = [
  { value: "all", label: "All" },
  { value: "attention", label: "Attention Needed" },
  { value: "due_soon", label: "Due Soon" },
  { value: "overdue", label: "Overdue" },
  { value: "draft", label: "Draft / In Progress" },
  { value: "submitted", label: "Submitted" },
] as const;

function dateLabel(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value)) : "—";
}

function monitoringHref(filters: GrantReportingMonitoringFiltersInput, changes: Partial<GrantReportingMonitoringFiltersInput>) {
  const next = { ...filters, ...changes };
  const params = new URLSearchParams({ tab: "monitoring", monitor: next.monitor });
  if (next.query) params.set("query", next.query);
  if (next.centreId) params.set("centreId", next.centreId);
  if (next.type) params.set("type", next.type);
  if (next.financialYear) params.set("financialYear", next.financialYear);
  if (next.quarter) params.set("quarter", String(next.quarter));
  if (next.page > 1) params.set("page", String(next.page));
  return `?${params.toString()}`;
}

export function GrantReportingMonitoring({
  data,
  filters,
  centres,
}: {
  data: GrantReportingMonitoringData;
  filters: GrantReportingMonitoringFiltersInput;
  centres: GrantReportWorkspaceData["options"]["centres"];
}) {
  const years = Array.from(new Set([filters.financialYear, ...data.options.financialYears].filter((value): value is string => Boolean(value))));
  const pageStart = data.pagination.total === 0 ? 0 : (data.pagination.page - 1) * data.pagination.pageSize + 1;
  const pageEnd = Math.min(data.pagination.page * data.pagination.pageSize, data.pagination.total);

  return <div className="space-y-6">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Link href={monitoringHref(filters, { monitor: "attention", page: 1 })}><KpiCard label="Attention Needed" value={String(data.metrics.attentionNeeded)} description="Due soon, overdue or returned" icon={AlertTriangle} tone="warning" /></Link>
      <Link href={monitoringHref(filters, { monitor: "due_soon", page: 1 })}><KpiCard label="Due Soon" value={String(data.metrics.dueSoon)} description="Due today through the next 14 days" icon={CalendarClock} tone="warning" /></Link>
      <Link href={monitoringHref(filters, { monitor: "overdue", page: 1 })}><KpiCard label="Overdue" value={String(data.metrics.overdue)} description="Past deadline and still active" icon={TimerOff} tone="warning" /></Link>
      <Link href={monitoringHref(filters, { monitor: "draft", page: 1 })}><KpiCard label="Draft / In Progress" value={String(data.metrics.draftInProgress)} description="Draft or returned reports" icon={FileClock} /></Link>
    </div>
    <p className="text-xs text-slate-500 dark:text-slate-400">Attention Needed is a unique roll-up of Due Soon, Overdue and returned obligations. Draft / In Progress is a workflow state and may intentionally overlap an urgency card.</p>

    <Card className="dark:border-slate-800 dark:bg-slate-900">
      <CardHeader>
        <CardTitle className="dark:text-white">Reporting Monitoring</CardTitle>
        <CardDescription className="dark:text-slate-400">Monitor reporting deadlines and open the relevant report across centres and grant awards.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="grid gap-3 rounded-lg border border-brand-line bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-4 dark:border-slate-700 dark:bg-slate-950">
          <input type="hidden" name="tab" value="monitoring" />
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300 xl:col-span-2">Search
            <input name="query" defaultValue={filters.query} maxLength={100} placeholder="Centre, award, project or report" className="mt-1 w-full rounded-lg border border-brand-line bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
          </label>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Operational view
            <select name="monitor" defaultValue={filters.monitor} className="mt-1 w-full rounded-lg border border-brand-line bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">{monitoringViews.map((view) => <option key={view.value} value={view.value}>{view.label}</option>)}</select>
          </label>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">ECD Centre
            <select name="centreId" defaultValue={filters.centreId ?? ""} className="mt-1 w-full rounded-lg border border-brand-line bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"><option value="">All centres</option>{centres.map((centre) => <option key={centre.id} value={centre.id}>{centre.centreName}</option>)}</select>
          </label>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Report type
            <select name="type" defaultValue={filters.type ?? ""} className="mt-1 w-full rounded-lg border border-brand-line bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"><option value="">All types</option>{Object.entries(reportTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          </label>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Financial year
            <select name="financialYear" defaultValue={filters.financialYear ?? ""} className="mt-1 w-full rounded-lg border border-brand-line bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"><option value="">All years</option>{years.map((year) => <option key={year} value={year}>{year}</option>)}</select>
          </label>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Quarter
            <select name="quarter" defaultValue={filters.quarter ?? ""} className="mt-1 w-full rounded-lg border border-brand-line bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"><option value="">All quarters</option>{[1, 2, 3, 4].map((quarter) => <option key={quarter} value={quarter}>Q{quarter}</option>)}</select>
          </label>
          <div className="flex items-end gap-2"><Button type="submit">Apply filters</Button><Link href="?tab=monitoring"><Button type="button" variant="ghost">Clear</Button></Link></div>
        </form>

        {data.rows.length ? <DataTable columns={["ECD Centre", "Award / Project", "Funder(s)", "Report", "Period", "Due", "Workflow", "Urgency", "Action"]} rows={data.rows.map((row) => [
          <span key="centre" className="font-bold">{row.centreName}</span>,
          <div key="award" className="min-w-40"><p className="font-semibold">{row.awardNumber}</p><p className="text-xs text-slate-500">{row.awardTitle} · {row.projectTitle}</p></div>,
          <span key="funders" className="min-w-32">{row.fundingOrganisationSummary}</span>,
          <div key="report" className="min-w-40"><p className="font-semibold">{row.title}</p><p className="text-xs text-slate-500">{reportTypeLabels[row.reportType]}{row.currentVersionNumber ? ` · v${row.currentVersionNumber}` : ""}</p></div>,
          <span key="period" className="whitespace-nowrap">{dateLabel(row.reportingPeriodStart)} – {dateLabel(row.reportingPeriodEnd)}</span>,
          <span key="due" className="whitespace-nowrap">{dateLabel(row.dueAt)}</span>,
          <div key="workflow" className="flex min-w-28 flex-wrap gap-1"><StatusBadge status={formatGrantLabel(row.progressState)} />{row.reportStatus && row.reportStatus !== row.progressState ? <StatusBadge status={`Report ${formatGrantLabel(row.reportStatus)}`} /> : null}</div>,
          row.dueState ? <div key="urgency" className="min-w-28 space-y-1"><StatusBadge status={formatGrantLabel(row.dueState)} /><p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{row.dueLabel}</p></div> : <span key="urgency" className="text-sm text-slate-500">Terminal</span>,
          row.reportId ? <Link key="action" href={`/dashboard/super-admin/reports/${row.reportId}`} aria-label={`Open report ${row.title}`} className="inline-flex min-h-8 items-center whitespace-nowrap rounded-md border border-brand-line px-3 text-xs font-bold text-brand-navy hover:border-brand-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy">Open Report</Link> : <span key="action" className="text-xs text-slate-500">Not created</span>,
        ])} /> : <div className="rounded-lg border border-dashed border-brand-line p-8 text-center"><p className="font-bold">No reporting obligations match these filters</p><p className="mt-2 text-sm text-slate-500">Adjust the operational view or clear one of the filters.</p></div>}

        <div className="flex flex-col gap-3 border-t border-brand-line pt-4 text-sm sm:flex-row sm:items-center sm:justify-between dark:border-slate-700">
          <p className="text-slate-500">Showing {pageStart}–{pageEnd} of {data.pagination.total} obligations</p>
          <div className="flex items-center gap-2">
            {data.pagination.hasPreviousPage ? <Link href={monitoringHref(filters, { page: data.pagination.page - 1 })}><Button type="button" variant="secondary">Previous</Button></Link> : <Button type="button" variant="secondary" disabled>Previous</Button>}
            <span className="px-2 font-semibold">Page {data.pagination.page} of {data.pagination.totalPages}</span>
            {data.pagination.hasNextPage ? <Link href={monitoringHref(filters, { page: data.pagination.page + 1 })}><Button type="button" variant="secondary">Next</Button></Link> : <Button type="button" variant="secondary" disabled>Next</Button>}
          </div>
        </div>
      </CardContent>
    </Card>
  </div>;
}
