"use client";

import Link from "next/link";
import { CheckCircle2, ClipboardCheck, FileText, HandCoins, ListChecks, Send, Upload, UsersRound } from "lucide-react";
import { Alert, DataTable, KpiCard, PageHeader, StatusBadge, useToast } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatFundingCurrency, fundingBuilderPlaceholders } from "@/lib/funding/format";
import type { FundingReadinessRecord } from "@/lib/funding/types";

export function CentreFundingView({ record }: { record: FundingReadinessRecord }) {
  const { pushToast } = useToast();
  const completeChecklist = record.applicationChecklist.filter((item) => item.complete).length;
  const completeDocuments = record.supportingDocuments.filter((item) => item.complete).length;
  const totalRequested = record.projectProfiles.reduce((sum, project) => sum + project.requestedAmount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ECD Centre"
        title="My Funding Readiness"
        description="Prepare complete funding applications with project profiles, proposal and budget placeholders, beneficiary lists and supporting documents."
        actions={<Link href="/dashboard/ecd-centre"><Button variant="secondary">Back to centre dashboard</Button></Link>}
      />

      <Alert
        tone={record.readinessScore >= 80 ? "success" : "warning"}
        title={`Funding readiness score: ${record.readinessScore}%`}
        description="Proposal builder, budget builder, beneficiary list manager and donor portal connections are placeholders for future modules."
      />

      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard label="Readiness Score" value={`${record.readinessScore}%`} description={record.status} icon={ClipboardCheck} tone={record.readinessScore >= 80 ? "green" : "warning"} />
        <KpiCard label="Projects" value={String(record.projectProfiles.length)} description={record.funderType} icon={FileText} />
        <KpiCard label="Requested" value={formatFundingCurrency(totalRequested)} description="Across project profiles" icon={HandCoins} tone="green" />
        <KpiCard label="Documents" value={`${completeDocuments}/${record.supportingDocuments.length}`} description="Supporting documents ready" icon={Upload} tone="warning" />
      </div>

      <Card className="dark:border-slate-800 dark:bg-slate-900">
        <CardHeader>
          <CardTitle className="dark:text-white">Readiness score</CardTitle>
          <CardDescription className="dark:text-slate-400">Complete proposal, budget, beneficiary and document steps to become submission-ready.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-2 flex justify-between text-sm font-semibold"><span>{record.centreName}</span><span>{record.readinessScore}%</span></div>
          <Progress value={record.readinessScore} />
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card className="dark:border-slate-800 dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="dark:text-white">Application checklist</CardTitle>
            <CardDescription className="dark:text-slate-400">{completeChecklist}/{record.applicationChecklist.length} readiness tasks complete.</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={["Item", "Status", "Note"]}
              rows={record.applicationChecklist.map((item) => [
                <span key="item" className="font-bold text-brand-ink dark:text-white">{item.label}</span>,
                <StatusBadge key="status" status={item.complete ? "Ready" : "In Progress"} />,
                item.note
              ])}
            />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="dark:border-slate-800 dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="dark:text-white">Builder placeholders</CardTitle>
              <CardDescription className="dark:text-slate-400">Future guided tools that will plug into this module.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {fundingBuilderPlaceholders.map((item) => (
                <Button
                  key={item}
                  variant="secondary"
                  className="w-full justify-start"
                  onClick={() => pushToast({ title: item, description: "This workflow is reserved for a future guided builder." })}
                >
                  <ListChecks className="h-4 w-4" />
                  {item}
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card className="dark:border-slate-800 dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="dark:text-white">Admin notes</CardTitle>
              <CardDescription className="dark:text-slate-400">ECDLink funding desk guidance.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {record.adminNotes.map((note) => (
                <div key={note} className="rounded-lg bg-brand-accent p-4 text-sm leading-6 text-slate-700 dark:bg-slate-950 dark:text-slate-300">{note}</div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="dark:border-slate-800 dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="dark:text-white">Project profiles</CardTitle>
            <CardDescription className="dark:text-slate-400">Funding projects prepared for funder matching.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {record.projectProfiles.map((project) => (
              <div key={project.id} className="rounded-lg border border-brand-line p-4 dark:border-slate-800">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-brand-ink dark:text-white">{project.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{project.objective}</p>
                  </div>
                  <StatusBadge status={project.status} />
                </div>
                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                  <div><p className="text-slate-500">Requested</p><p className="font-bold text-brand-navy dark:text-blue-200">{formatFundingCurrency(project.requestedAmount)}</p></div>
                  <div><p className="text-slate-500">Beneficiaries</p><p className="font-bold text-brand-ink dark:text-white">{project.beneficiaries}</p></div>
                  <div><p className="text-slate-500">Type</p><p className="font-bold text-brand-ink dark:text-white">{project.funderType}</p></div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="dark:border-slate-800 dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="dark:text-white">Supporting documents checklist</CardTitle>
            <CardDescription className="dark:text-slate-400">{completeDocuments}/{record.supportingDocuments.length} supporting documents ready.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {record.supportingDocuments.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3 rounded-lg border border-brand-line p-4 dark:border-slate-800">
                <div>
                  <p className="font-bold text-brand-ink dark:text-white">{item.label}</p>
                  <p className="mt-1 text-sm text-slate-500">{item.note}</p>
                </div>
                <StatusBadge status={item.complete ? "Ready" : "Draft"} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="dark:border-slate-800 dark:bg-slate-900">
        <CardHeader>
          <CardTitle className="dark:text-white">Funding application tracker</CardTitle>
          <CardDescription className="dark:text-slate-400">Current application pack status from match to decision.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {record.applicationTracker.map((stage, index) => (
            <div key={stage.stage} className="rounded-lg border border-brand-line p-4 dark:border-slate-800">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-brand-navy">
                {stage.status === "Approved" || stage.status === "Ready" ? <CheckCircle2 className="h-5 w-5" /> : <span className="text-sm font-bold">{index + 1}</span>}
              </div>
              <p className="mt-3 font-bold text-brand-ink dark:text-white">{stage.stage}</p>
              <div className="mt-2"><StatusBadge status={stage.status} /></div>
              <p className="mt-2 text-sm text-slate-500">{stage.date ?? "Pending"}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Button onClick={() => pushToast({ title: "Application placeholder", description: "Submission workflow will connect to future funder and donor modules." })}>
        <Send className="h-4 w-4" />
        Submit application placeholder
      </Button>
    </div>
  );
}
