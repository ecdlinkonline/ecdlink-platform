"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, CheckCircle2, ClipboardList, FileClock, FileText, HandCoins } from "lucide-react";
import { DataTable, KpiCard, PageHeader, StatusBadge } from "@/components/design-system";
import { GrantAwardDialog } from "@/components/reports/grant-award-dialog";
import { GrantObligationDialog } from "@/components/reports/grant-obligation-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatGrantCurrency, formatGrantLabel, reportTypeLabels } from "@/lib/grant-reports/types";
import { grantReportEmptyStateMessage } from "@/lib/grant-reports/presentation";
import type { GrantReportWorkspaceData } from "@/lib/grant-reports/types";
import type { GrantReportFiltersInput } from "@/lib/validators/grant-reports";

const tabs = [{ id: "reports", label: "Reports" }, { id: "awards", label: "Grant Awards" }, { id: "obligations", label: "Reporting Obligations" }] as const;
type TabId = typeof tabs[number]["id"];


function dateLabel(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium" }).format(new Date(value)) : "—";
}

export function GrantReportsWorkspace({ data, initialTab, filters }: { data: GrantReportWorkspaceData; initialTab?: string; filters: GrantReportFiltersInput }) {
  const router = useRouter();
  const activeTab: TabId = tabs.some((tab) => tab.id === initialTab) ? initialTab as TabId : "reports";
  const refresh = () => router.refresh();
  const organisationOptions = [
    ...data.options.fundingOrganisations.map((organisation) => ({ label: `Funding · ${organisation.name}`, value: organisation.id })),
    ...data.options.donorOrganisations.map((organisation) => ({ label: `Donor · ${organisation.name}`, value: organisation.id })),
  ];

  return <div className="space-y-6">
    <PageHeader eyebrow="Super Admin" title="Grant Reports" description="Oversee confirmed grant awards, reporting obligations and formal report lifecycles across ECDLink." actions={<><GrantAwardDialog data={data} onSuccess={refresh} /><GrantObligationDialog data={data} onSuccess={refresh} /><Link href="/dashboard/super-admin"><Button variant="secondary">Back to dashboard</Button></Link></>} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
      <KpiCard label="Active Awards" value={String(data.metrics.activeAwards)} description="Confirmed active grants" icon={HandCoins} />
      <KpiCard label="Reports Due" value={String(data.metrics.reportsDue)} description="Open and overdue" icon={CalendarClock} tone="warning" />
      <KpiCard label="Draft Reports" value={String(data.metrics.draftReports)} description="Awaiting preparation" icon={FileClock} />
      <KpiCard label="Submitted" value={String(data.metrics.submittedReports)} description="Under review" icon={ClipboardList} />
      <KpiCard label="Returned" value={String(data.metrics.returnedReports)} description="Requires revision" icon={FileText} tone="warning" />
      <KpiCard label="Approved" value={String(data.metrics.approvedReports)} description="Completed review" icon={CheckCircle2} tone="green" />
    </div>
    <div className="flex gap-2 overflow-x-auto rounded-lg border border-brand-line bg-white p-2 dark:border-slate-800 dark:bg-slate-900">{tabs.map((tab) => <Link key={tab.id} href={`?tab=${tab.id}`} className={`shrink-0 rounded-lg px-4 py-2 text-sm font-bold ${activeTab === tab.id ? "bg-brand-navy text-white" : "text-slate-600 hover:bg-brand-accent dark:text-slate-300"}`}>{tab.label}</Link>)}</div>
    {activeTab === "reports" ? <ReportsSection data={data} filters={filters} organisations={organisationOptions} /> : null}
    {activeTab === "awards" ? <AwardsSection data={data} /> : null}
    {activeTab === "obligations" ? <ObligationsSection data={data} /> : null}
  </div>;
}

function ReportsSection({ data, filters, organisations }: { data: GrantReportWorkspaceData; filters: GrantReportFiltersInput; organisations: Array<{ label: string; value: string }> }) {
  return <Card className="dark:border-slate-800 dark:bg-slate-900"><CardHeader><CardTitle className="dark:text-white">Reports register</CardTitle><CardDescription className="dark:text-slate-400">Search and filter persisted grant reports. Full editing begins in Phase 2.</CardDescription></CardHeader><CardContent className="space-y-4">
    <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-5"><input name="query" defaultValue={filters.query} placeholder="Search reports" className="rounded-lg border border-brand-line px-3 py-2 text-sm" /><select name="status" defaultValue={filters.status ?? ""} className="rounded-lg border border-brand-line px-3 py-2 text-sm"><option value="">All statuses</option>{["DRAFT","SUBMITTED","RETURNED","APPROVED","ARCHIVED"].map((status)=><option key={status}>{status}</option>)}</select><select name="type" defaultValue={filters.type ?? ""} className="rounded-lg border border-brand-line px-3 py-2 text-sm"><option value="">All types</option>{Object.entries(reportTypeLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><select name="centreId" defaultValue={filters.centreId ?? ""} className="rounded-lg border border-brand-line px-3 py-2 text-sm"><option value="">All centres</option>{data.options.centres.map((centre)=><option key={centre.id} value={centre.id}>{centre.centreName}</option>)}</select><select name="organisationId" defaultValue={filters.organisationId ?? ""} className="rounded-lg border border-brand-line px-3 py-2 text-sm"><option value="">All funders</option>{organisations.map((option)=><option key={`${option.label}-${option.value}`} value={option.value}>{option.label}</option>)}</select><input type="hidden" name="tab" value="reports" /><div className="flex gap-2"><Button type="submit">Apply filters</Button><Link href="?tab=reports"><Button type="button" variant="ghost">Clear</Button></Link></div></form>
    {data.reports.length ? <DataTable columns={["Report","Centre","Funder / Partner","Project","Type","Reporting Period","Due","Status","Version","Actions"]} rows={data.reports.map((report)=>[<span key="title" className="font-bold">{report.title}</span>,report.centre,report.funder,report.project,reportTypeLabels[report.type],`${dateLabel(report.reportingPeriodStart)} – ${dateLabel(report.reportingPeriodEnd)}`,dateLabel(report.dueAt),<StatusBadge key="status" status={formatGrantLabel(report.status)} />,`v${report.version}`,<Link key="action" href={`/dashboard/super-admin/reports/${report.id}`} className="text-xs font-bold text-brand-navy underline">Open report</Link>])} /> : <div className="rounded-lg border border-dashed border-brand-line p-8 text-center"><FileText className="mx-auto h-8 w-8 text-slate-400" /><p className="mt-3 font-bold">No reports found</p><p className="mt-2 text-sm text-slate-500">{grantReportEmptyStateMessage()}</p></div>}
  </CardContent></Card>;
}

function AwardsSection({ data }: { data: GrantReportWorkspaceData }) { return <Card className="dark:border-slate-800 dark:bg-slate-900"><CardHeader><CardTitle className="dark:text-white">Grant Awards</CardTitle><CardDescription>Confirmed funding relationships. Awards are never created automatically.</CardDescription></CardHeader><CardContent>{data.awards.length ? <DataTable columns={["Award Number","Centre","Project","Lead Funder / Partner","Awarded","Dates","Status","Agreement","Tranches","Obligations"]} rows={data.awards.map((award)=>[<span key="number" className="font-bold">{award.awardNumber}</span>,award.centre,award.project,award.leadOrganisation,formatGrantCurrency(award.awardedAmount,award.currency),`${dateLabel(award.startDate)} – ${dateLabel(award.endDate)}`,<StatusBadge key="status" status={formatGrantLabel(award.status)} />,award.signedAgreement?<div key="agreement" className="space-y-1"><p className="max-w-48 truncate text-xs font-semibold" title={award.signedAgreement.originalFilename}>{award.signedAgreement.originalFilename}</p><div className="flex gap-2"><a className="text-xs font-bold text-brand-navy underline" href={`/api/grant-awards/${award.id}/agreement?preview=1`} target="_blank" rel="noreferrer">Preview</a><a className="text-xs font-bold text-brand-navy underline" href={`/api/grant-awards/${award.id}/agreement?download=1`}>Download</a></div></div>:"—",String(award.trancheCount),String(award.obligationCount)])} /> : <p className="rounded-lg border border-dashed p-8 text-center text-sm text-slate-500">No confirmed Grant Awards yet. Use “Create Grant Award” to explicitly convert an approved relationship or record a manual agreement.</p>}</CardContent></Card>; }

function ObligationsSection({ data }: { data: GrantReportWorkspaceData }) { return <Card className="dark:border-slate-800 dark:bg-slate-900"><CardHeader><CardTitle className="dark:text-white">Reporting Obligations</CardTitle><CardDescription>Each obligation creates one Draft report and version 1 for future preparation.</CardDescription></CardHeader><CardContent>{data.obligations.length ? <DataTable columns={["Obligation","Award","Centre","Funder","Type","Basis","Tranche","Due","Status","Report"]} rows={data.obligations.map((item)=>[<span key="title" className="font-bold">{item.title}</span>,item.awardNumber,item.centre,item.funder,reportTypeLabels[item.type],formatGrantLabel(item.basis),item.tranche ? `Tranche ${item.tranche.trancheNumber}` : "—",dateLabel(item.dueAt),<StatusBadge key="status" status={formatGrantLabel(item.status)} />,item.report ? `${formatGrantLabel(item.report.status)} · v${item.report.currentVersionNumber}` : "Not created"])} /> : <p className="rounded-lg border border-dashed p-8 text-center text-sm text-slate-500">No reporting obligations yet. Create an award first, then add its required reporting schedule.</p>}</CardContent></Card>; }
