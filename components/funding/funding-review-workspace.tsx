"use client";

import { useState } from "react";
import Link from "next/link";
import { ClipboardCheck, FileText, HandCoins, Upload, UsersRound } from "lucide-react";
import { DataTable, KpiCard, PageHeader, StatusBadge } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatFundingCurrency } from "@/lib/funding/format";
import type { FundingReviewWorkspaceData } from "@/lib/funding/types";

export const fundingWorkspaceTabs = [
  { id: "overview", label: "Overview" },
  { id: "readiness", label: "Readiness" },
  { id: "applications", label: "Applications" },
  { id: "projects", label: "Projects" },
  { id: "documents", label: "Documents" },
  { id: "timeline", label: "Timeline" },
] as const;

type FundingWorkspaceTabId = (typeof fundingWorkspaceTabs)[number]["id"];

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-ZA", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function EmptyState({ children }: { children: string }) {
  return <div className="rounded-lg border border-dashed border-brand-line p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">{children}</div>;
}

export function FundingReviewWorkspace({ data }: { data: FundingReviewWorkspaceData }) {
  const [activeTab, setActiveTab] = useState<FundingWorkspaceTabId>("overview");
  const { summary } = data;
  const currentApplication = data.applications.find((application) => application.id === data.currentApplicationId) ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Funding Review"
        title={summary.centreName}
        description={`${summary.area}, ${summary.region} · Last updated ${formatDate(summary.lastUpdatedAt)}`}
        actions={<Link href="/dashboard/super-admin/funding"><Button variant="secondary">Back to funding readiness</Button></Link>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Readiness" value={`${summary.readinessScore}%`} description={summary.readinessStatus} icon={ClipboardCheck} tone="green" />
        <KpiCard label="Application Status" value={summary.applicationStatus} description={currentApplication?.applicationNumber ?? "No application"} icon={FileText} />
        <KpiCard label="Requested" value={formatFundingCurrency(currentApplication?.requestedAmount ?? 0)} description="Current application" icon={HandCoins} tone="navy" />
        <KpiCard label="Approved" value={currentApplication?.approvedAmount == null ? "—" : formatFundingCurrency(currentApplication.approvedAmount)} description="Current application" icon={HandCoins} tone="green" />
        <KpiCard label="Projects" value={String(data.projects.length)} description={summary.fundingOrganisation ?? summary.funderType} icon={UsersRound} />
      </div>

      <div className="flex gap-2 overflow-x-auto rounded-lg border border-brand-line bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
        {fundingWorkspaceTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 rounded-lg px-3 py-2 text-sm font-bold ${activeTab === tab.id ? "bg-brand-navy text-white" : "text-slate-600 hover:bg-brand-accent dark:text-slate-300 dark:hover:bg-slate-950"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" ? (
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="dark:border-slate-800 dark:bg-slate-900">
            <CardHeader><CardTitle className="dark:text-white">Current funding position</CardTitle><CardDescription className="dark:text-slate-400">Latest application and funding relationship.</CardDescription></CardHeader>
            <CardContent>
              {currentApplication ? (
                <DataTable columns={["Field", "Value"]} rows={[
                  ["Application", currentApplication.applicationNumber],
                  ["Status", <StatusBadge key="status" status={currentApplication.status} />],
                  ["Funding organisation", currentApplication.fundingOrganisation ?? "Not assigned"],
                  ["Funding opportunity", currentApplication.fundingOpportunity ?? "Not assigned"],
                  ["Submitted", formatDate(currentApplication.submittedAt)],
                  ["Decision", formatDate(currentApplication.decisionDate)],
                ]} />
              ) : <EmptyState>No funding applications have been created for this centre.</EmptyState>}
            </CardContent>
          </Card>
          <Card className="dark:border-slate-800 dark:bg-slate-900">
            <CardHeader><CardTitle className="dark:text-white">Reminders</CardTitle><CardDescription className="dark:text-slate-400">Recent operational follow-ups.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {data.reminders.length ? data.reminders.map((reminder) => (
                <div key={reminder.id} className="rounded-lg border border-brand-line p-4 dark:border-slate-800">
                  <div className="flex items-start justify-between gap-3"><p className="font-bold text-brand-ink dark:text-white">{reminder.title}</p><StatusBadge status={reminder.status} /></div>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{reminder.body}</p>
                  <p className="mt-2 text-xs text-slate-500">Due {formatDate(reminder.dueAt)}</p>
                </div>
              )) : <EmptyState>No funding reminders exist for this centre.</EmptyState>}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {activeTab === "readiness" ? (
        <div className="space-y-6">
          <Card className="dark:border-slate-800 dark:bg-slate-900">
            <CardHeader><CardTitle className="dark:text-white">Funding readiness</CardTitle><CardDescription className="dark:text-slate-400">{summary.readinessStatus}</CardDescription></CardHeader>
            <CardContent><div className="mb-2 flex justify-between text-sm font-semibold"><span>{summary.centreName}</span><span>{summary.readinessScore}%</span></div><Progress value={summary.readinessScore} /></CardContent>
          </Card>
          <Card className="dark:border-slate-800 dark:bg-slate-900">
            <CardHeader><CardTitle className="dark:text-white">Readiness checklist</CardTitle></CardHeader>
            <CardContent>{data.checklistItems.length ? <DataTable columns={["Item", "Category", "Status", "Required", "Completed", "Note"]} rows={data.checklistItems.map((item) => [item.label, item.category, <StatusBadge key="status" status={item.status} />, item.required ? "Yes" : "No", formatDate(item.completedAt), item.note ?? "—"])} /> : <EmptyState>No readiness checklist items exist for this centre.</EmptyState>}</CardContent>
          </Card>
        </div>
      ) : null}

      {activeTab === "applications" ? (
        <Card className="dark:border-slate-800 dark:bg-slate-900">
          <CardHeader><CardTitle className="dark:text-white">Funding applications</CardTitle><CardDescription className="dark:text-slate-400">Submitted applications and funder decisions.</CardDescription></CardHeader>
          <CardContent>{data.applications.length ? <DataTable columns={["Application", "Project", "Status", "Requested", "Approved", "Organisation", "Opportunity", "Submitted", "Decision"]} rows={data.applications.map((application) => [application.applicationNumber, application.projectTitle, <StatusBadge key="status" status={application.status} />, formatFundingCurrency(application.requestedAmount), application.approvedAmount == null ? "—" : formatFundingCurrency(application.approvedAmount), application.fundingOrganisation ?? "—", application.fundingOpportunity ?? "—", formatDate(application.submittedAt), formatDate(application.decisionDate)])} /> : <EmptyState>No funding applications exist for this centre.</EmptyState>}</CardContent>
        </Card>
      ) : null}

      {activeTab === "projects" ? (
        <Card className="dark:border-slate-800 dark:bg-slate-900">
          <CardHeader><CardTitle className="dark:text-white">Funding projects</CardTitle><CardDescription className="dark:text-slate-400">Project profiles prepared for funding opportunities.</CardDescription></CardHeader>
          <CardContent className="space-y-3">{data.projects.length ? data.projects.map((project) => (
            <div key={project.id} className="rounded-lg border border-brand-line p-4 dark:border-slate-800">
              <div className="flex items-start justify-between gap-3"><div><p className="font-bold text-brand-ink dark:text-white">{project.title}</p><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{project.objective}</p></div><StatusBadge status={project.status} /></div>
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-4"><div><p className="text-slate-500">Requested</p><p className="font-bold">{formatFundingCurrency(project.requestedAmount)}</p></div><div><p className="text-slate-500">Secured</p><p className="font-bold">{formatFundingCurrency(project.amountSecured)}</p></div><div><p className="text-slate-500">Funding gap</p><p className="font-bold">{formatFundingCurrency(project.fundingGap)}</p></div><div><p className="text-slate-500">Beneficiaries</p><p className="font-bold">{project.beneficiaries}</p></div></div>
            </div>
          )) : <EmptyState>No funding projects exist for this centre.</EmptyState>}</CardContent>
        </Card>
      ) : null}

      {activeTab === "documents" ? (
        <Card className="dark:border-slate-800 dark:bg-slate-900">
          <CardHeader><CardTitle className="dark:text-white">Supporting documents</CardTitle><CardDescription className="dark:text-slate-400">Documents attached to the funding-readiness profile.</CardDescription></CardHeader>
          <CardContent>{data.supportingDocuments.length ? <DataTable columns={["Document", "Type", "Status", "Uploaded", "Verified", "Note"]} rows={data.supportingDocuments.map((document) => [document.label, document.documentType, <StatusBadge key="status" status={document.status} />, formatDate(document.uploadedAt), formatDate(document.verifiedAt), document.note ?? "—"])} /> : <EmptyState>No supporting documents exist for this centre.</EmptyState>}</CardContent>
        </Card>
      ) : null}

      {activeTab === "timeline" ? (
        <Card className="dark:border-slate-800 dark:bg-slate-900">
          <CardHeader><CardTitle className="dark:text-white">Funding timeline</CardTitle><CardDescription className="dark:text-slate-400">Recent profile, project, application, document and reminder activity.</CardDescription></CardHeader>
          <CardContent className="space-y-3">{data.timeline.length ? data.timeline.map((item) => (
            <div key={item.id} className="flex items-start gap-4 rounded-lg border border-brand-line p-4 dark:border-slate-800"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-blue-50 text-brand-navy"><Upload className="h-4 w-4" /></div><div className="flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><p className="font-bold text-brand-ink dark:text-white">{item.title}</p><p className="text-xs text-slate-500">{formatDate(item.occurredAt)}</p></div><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{item.description}</p>{item.status ? <div className="mt-2"><StatusBadge status={item.status} /></div> : null}</div></div>
          )) : <EmptyState>No dated funding activity exists for this centre.</EmptyState>}</CardContent>
        </Card>
      ) : null}
    </div>
  );
}
