export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { NlcGrantReportEditor } from "@/components/reports/nlc-grant-report-editor";
import { DbeQuarterlyExpenditureEditor } from "@/components/reports/dbe-quarterly-expenditure-editor";
import { DbeQuarterlyCashFlowEditor } from "@/components/reports/dbe-quarterly-cash-flow-editor";
import { GrantReportSubmissionHistory } from "@/components/reports/grant-report-submission-history";
import { GrantReportingLifecycle } from "@/components/reports/grant-reporting-lifecycle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSuperAdmin } from "@/lib/auth/permissions";
import { getGrantAwardReportingLifecycleByReportId, getGrantReportEditor, getGrantReportSubmissionHistory } from "@/lib/repositories/grant-reports";

export default async function GrantReportPage({ params, searchParams }: { params: Promise<{ reportId: string }>; searchParams: Promise<{ version?: string | string[] }> }) {
  await requireSuperAdmin();
  const { reportId } = await params;
  const requestedVersion = (await searchParams).version;
  if (requestedVersion !== undefined && (typeof requestedVersion !== "string" || !/^[1-9]\d*$/.test(requestedVersion) || !Number.isSafeInteger(Number(requestedVersion)))) notFound();
  const [report, history, lifecycle] = await Promise.all([
    getGrantReportEditor(reportId, undefined, requestedVersion === undefined ? undefined : Number(requestedVersion)),
    getGrantReportSubmissionHistory(reportId),
    getGrantAwardReportingLifecycleByReportId(reportId),
  ]);
  if (!report) notFound();
  const editor = report.report.template === "NLC" ? <NlcGrantReportEditor key={report.version.id} initialData={report} />
    : report.report.template === "DBE_QUARTERLY_EXPENDITURE" ? <DbeQuarterlyExpenditureEditor key={report.version.id} initialData={report} />
    : report.report.template === "DBE_QUARTERLY_CASH_FLOW" ? <DbeQuarterlyCashFlowEditor key={report.version.id} initialData={report} />
    : (
        <Card className="dark:border-slate-800 dark:bg-slate-900">
          <CardHeader><CardTitle className="dark:text-white">{report.report.title}</CardTitle></CardHeader>
          <CardContent><p className="rounded-lg border border-dashed border-brand-line p-8 text-center text-sm text-slate-500">Template implementation coming in the next phase.</p></CardContent>
        </Card>
      );
  return <div className="space-y-6">
    {lifecycle ? <GrantReportingLifecycle lifecycle={lifecycle} currentReportId={reportId} /> : null}
    <GrantReportSubmissionHistory history={history ?? []} reportId={reportId} versionNumber={report.version.versionNumber} />
    {report.version.submittedAt ? <p className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-900">Submitted version {report.version.versionNumber} · Read-only review. {report.version.historical ? "Recorded submission readiness is shown in Submission History; current-version validation is not applied to this earlier version." : "Financial reconciliation and submission readiness below are shown from the saved report and linked bank evidence."}</p> : null}
    {editor}
  </div>;
}
