"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { WorkflowActionDialog, type WorkflowActionResult } from "@/components/workflows/workflow-action-dialog";
import { StatusBadge } from "@/components/design-system";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatGrantLabel, reportTypeLabels } from "@/lib/grant-reports/types";
import type { getGrantAwardReportingLifecycleByReportId } from "@/lib/repositories/grant-reports";

type Lifecycle = NonNullable<Awaited<ReturnType<typeof getGrantAwardReportingLifecycleByReportId>>>;
type NextPeriodResult = { report: { id: string } };

function dateLabel(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value)) : "—";
}

export function GrantReportingLifecycle({ lifecycle, currentReportId }: { lifecycle: Lifecycle; currentReportId: string }) {
  const router = useRouter();
  return <Card className="dark:border-slate-800 dark:bg-slate-900">
    <CardHeader><CardTitle className="dark:text-white">Reporting Lifecycle</CardTitle><CardDescription>{lifecycle.award.awardNumber} · {lifecycle.award.title}. Operational periods are shown chronologically; Submission History remains the immutable submission record.</CardDescription></CardHeader>
    <CardContent className="space-y-3">
      {lifecycle.items.map((item) => <div key={item.id} className={`rounded-lg border p-4 ${item.reportId === currentReportId ? "border-brand-navy bg-brand-accent/40" : "border-brand-line dark:border-slate-700"}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="font-bold">{item.quarter ? `Q${item.quarter} · ` : ""}{reportTypeLabels[item.type]}</p><p className="text-sm text-slate-600 dark:text-slate-300">{dateLabel(item.reportingPeriodStart)} – {dateLabel(item.reportingPeriodEnd)} · Due {dateLabel(item.dueAt)}</p></div>
          <div className="flex flex-wrap items-center gap-2"><StatusBadge status={`Obligation ${formatGrantLabel(item.obligationStatus)}`} />{item.reportStatus ? <StatusBadge status={`Report ${formatGrantLabel(item.reportStatus)}`} /> : null}{item.currentVersion ? <span className="whitespace-nowrap text-sm font-semibold">Version {item.currentVersion}</span> : null}{item.dueState ? <StatusBadge status={formatGrantLabel(item.dueState)} /> : null}{item.reportId ? <Link className="text-sm font-bold text-brand-navy underline" href={`/dashboard/super-admin/reports/${item.reportId}`}>Open</Link> : null}</div>
        </div>
        {item.nextPeriodProposal ? <div className="mt-3 border-t border-brand-line pt-3 dark:border-slate-700">
          <WorkflowActionDialog<{ dueAt: string }, NextPeriodResult>
            title="Create Next Reporting Period"
            description="Review the server-derived canonical period and standard quarterly due date. Opening this dialog does not create anything."
            trigger={{ label: "Create Next Period", variant: "secondary" }}
            confirmationButton={{ label: "Create Draft Report", loadingLabel: "Creating…" }}
            fields={[{ name: "dueAt", type: "text", label: "Due date", description: "Standard quarterly deadline. Review before creating the next period.", placeholder: "YYYY-MM-DD", required: true }]}
            initialValues={{ dueAt: item.nextPeriodProposal.dueAt }}
            validate={(values) => /^\d{4}-\d{2}-\d{2}$/.test(values.dueAt) ? {} : { dueAt: "Enter a due date as YYYY-MM-DD." }}
            renderFields={() => <div className="rounded-lg bg-slate-50 p-4 text-sm dark:bg-slate-950"><dl className="grid gap-2 sm:grid-cols-2"><div><dt className="font-bold">Source period</dt><dd>{dateLabel(item.reportingPeriodStart)} – {dateLabel(item.reportingPeriodEnd)}</dd></div><div><dt className="font-bold">Proposed period</dt><dd>{dateLabel(item.nextPeriodProposal!.reportingPeriodStart)} – {dateLabel(item.nextPeriodProposal!.reportingPeriodEnd)}</dd></div><div><dt className="font-bold">Report type</dt><dd>{reportTypeLabels[item.nextPeriodProposal!.reportType]}</dd></div><div><dt className="font-bold">Financial year / quarter</dt><dd>{item.nextPeriodProposal!.financialYear} · Q{item.nextPeriodProposal!.quarter}</dd></div><div><dt className="font-bold">Proposed due date</dt><dd>{dateLabel(item.nextPeriodProposal!.dueAt)}</dd></div></dl><p className="mt-3 font-semibold text-amber-800 dark:text-amber-300">Financial lines, bank evidence, documents, certifications, readiness and reconciliation data will not be copied.</p></div>}
            action={async (values): Promise<WorkflowActionResult<NextPeriodResult>> => {
              const response = await fetch(`/api/grant-reporting-obligations/${item.id}/next`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ grantAwardId: lifecycle.award.id, dueAt: values.dueAt }) });
              const result = await response.json();
              return response.ok && result.ok ? { ok: true, data: result.data } : { ok: false, error: result.error ?? "The next reporting period could not be created." };
            }}
            successToast={{ title: "Next reporting period created", description: "A new, financially isolated Draft report is ready." }}
            errorToast={{ title: "Period creation failed", fallbackDescription: "The next reporting period could not be created." }}
            onSuccess={(data) => data?.report.id ? router.push(`/dashboard/super-admin/reports/${data.report.id}`) : router.refresh()}
          />
        </div> : null}
      </div>)}
    </CardContent>
  </Card>;
}
