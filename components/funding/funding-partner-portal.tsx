import Link from "next/link";
import { ClipboardCheck, Clock3, FileCheck2, FileText, HandCoins, MessageSquareWarning } from "lucide-react";
import { DataTable, KpiCard, PageHeader, StatusBadge } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatFundingCurrency } from "@/lib/funding/format";
import type { FundingPartnerApplicationRecord, FundingPartnerPortalData } from "@/lib/funding/types";

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-ZA", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value)) : "—";
}

function applicationRows(applications: FundingPartnerApplicationRecord[]) {
  return applications.map((application) => [
    <span key="application" className="font-bold text-brand-ink dark:text-white">{application.applicationNumber}</span>,
    application.centreName,
    application.projectTitle,
    <StatusBadge key="status" status={application.status} />,
    formatFundingCurrency(application.requestedAmount),
    formatDate(application.submittedAt),
    <Link key="review" href={`/dashboard/funding-partner/applications/${application.id}`}><Button variant="secondary" className="min-h-9 px-3">Review</Button></Link>,
  ]);
}

function ApplicationTable({ applications, title, description }: { applications: FundingPartnerApplicationRecord[]; title: string; description: string }) {
  return <Card className="dark:border-slate-800 dark:bg-slate-900"><CardHeader><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardContent>{applications.length ? <DataTable columns={["Application", "Centre", "Project", "Status", "Requested", "Submitted", "Action"]} rows={applicationRows(applications)} /> : <p className="rounded-lg border border-dashed p-8 text-center text-sm text-slate-500">No applications match this queue.</p>}</CardContent></Card>;
}

export function FundingPartnerDashboard({ data }: { data: FundingPartnerPortalData }) {
  return <div className="space-y-6">
    <PageHeader eyebrow="Funding operations" title="Funding Partner Workspace" description={`Organisation-scoped workspace for ${data.organisationNames.join(", ")}.`} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard label="Funding Calls" value={String(data.metrics.fundingCalls)} description="Organisation programmes" icon={HandCoins} tone="navy" />
      <KpiCard label="Applications" value={String(data.metrics.assignedApplications)} description="Assigned to your organisations" icon={FileText} />
      <KpiCard label="Awaiting Review" value={String(data.metrics.awaitingReview)} description="Active decision queue" icon={ClipboardCheck} />
      <KpiCard label="Approvals" value={String(data.metrics.approvals)} description="Approved applications" icon={FileCheck2} tone="green" />
    </div>
    <Card className="dark:border-slate-800 dark:bg-slate-900"><CardHeader><CardTitle>My Work</CardTitle><CardDescription>Outstanding actions across your assigned organisations.</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-3">
      <Link href="/dashboard/funding-partner/applications?queue=mine" className="rounded-lg border p-4 hover:border-brand-navy"><p className="text-sm text-slate-500">Assigned to me</p><p className="mt-2 text-2xl font-bold">{data.myWork.assignedToMe.length}</p></Link>
      <Link href="/dashboard/funding-partner/approvals" className="rounded-lg border p-4 hover:border-brand-navy"><p className="text-sm text-slate-500">Awaiting review</p><p className="mt-2 text-2xl font-bold">{data.myWork.awaitingReview.length}</p></Link>
      <Link href="/dashboard/funding-partner/applications?queue=clarification" className="rounded-lg border p-4 hover:border-brand-navy"><p className="text-sm text-slate-500">Clarification requests</p><p className="mt-2 text-2xl font-bold">{data.myWork.clarificationRequests.length}</p></Link>
    </CardContent></Card>
    <ApplicationTable applications={data.myWork.assignedToMe.slice(0, 6)} title="Assigned actions" description="Your current non-terminal reviewer assignments." />
  </div>;
}

export function FundingPartnerApplications({ data, queue }: { data: FundingPartnerPortalData; queue?: string }) {
  const applications = queue === "mine" ? data.myWork.assignedToMe : queue === "clarification" ? data.myWork.clarificationRequests : data.applications;
  return <div className="space-y-6"><PageHeader eyebrow="Funding operations" title="Applications" description="Applications are restricted to your Funding Organisation memberships." /><ApplicationTable applications={applications} title="Application queue" description="Open an application to use the shared review workspace." /></div>;
}

export function FundingPartnerApprovals({ data }: { data: FundingPartnerPortalData }) {
  return <div className="space-y-6"><PageHeader eyebrow="Decision workspace" title="Approvals" description="Submitted applications that still require a partner decision." /><ApplicationTable applications={data.myWork.awaitingReview} title="Awaiting review" description="Submitted, under-review and clarification-requested applications." /></div>;
}

export function FundingPartnerCalls({ data }: { data: FundingPartnerPortalData }) {
  return <div className="space-y-6"><PageHeader eyebrow="Funding operations" title="Funding Calls" description="Programmes owned by your Funding Organisations." /><Card><CardContent className="pt-6"><DataTable columns={["Call", "Type", "Status", "Closes", "Applications"]} rows={data.calls.map((call) => [call.title, call.type ?? "—", <StatusBadge key="status" status={call.status} />, formatDate(call.closesAt), String(call.applicationCount)])} /></CardContent></Card></div>;
}

export function FundingPartnerAssessments({ data }: { data: FundingPartnerPortalData }) {
  return <div className="space-y-6"><PageHeader eyebrow="Funding operations" title="Assessments" description="Assessments scoped to your Funding Organisations." /><Card><CardContent className="pt-6"><DataTable columns={["Application", "Centre", "Status", "Score", "Updated"]} rows={data.assessments.map((assessment) => [assessment.applicationNumber ?? "Unlinked", assessment.centreName ?? "—", <StatusBadge key="status" status={assessment.status} />, assessment.score == null ? "—" : String(assessment.score), formatDate(assessment.updatedAt)])} /></CardContent></Card></div>;
}

export function FundingPartnerReports({ data }: { data: FundingPartnerPortalData }) {
  const reportCards = [
    ["Assigned applications", data.reports.assignedApplications, FileText, ""],
    ["Awaiting review", data.reports.awaitingReview, Clock3, ""],
    ["Clarification requests", data.reports.clarificationRequests, MessageSquareWarning, ""],
    ["Approval rate", `${data.reports.approvalRate}%`, FileCheck2, ""],
    ["Average decision time", `${data.reports.averageDecisionDays} days`, Clock3, ""],
    ["Funding committed", formatFundingCurrency(data.reports.fundingCommitted), HandCoins, ""],
  ] as const;
  return <div className="space-y-6"><PageHeader eyebrow="Organisation reporting" title="Funding Reports" description="A lightweight operational view of assigned funding activity." /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{reportCards.map(([label, value, Icon]) => <KpiCard key={label} label={label} value={String(value)} description="Live organisation-scoped data" icon={Icon} />)}</div></div>;
}
