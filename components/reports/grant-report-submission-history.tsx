import Link from "next/link";
import { StatusBadge } from "@/components/design-system";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatGrantLabel, reportTypeLabels } from "@/lib/grant-reports/types";
import type { getGrantReportSubmissionHistory } from "@/lib/repositories/grant-reports";

type SubmissionHistory = NonNullable<Awaited<ReturnType<typeof getGrantReportSubmissionHistory>>>;

function dateTime(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Johannesburg" }).format(new Date(value)) : "Not recorded";
}

function date(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value)) : "Not recorded";
}

export function GrantReportSubmissionHistory({ history, reportId, versionNumber }: { history: SubmissionHistory; reportId: string; versionNumber: number }) {
  return <Card className="dark:border-slate-800 dark:bg-slate-900">
    <CardHeader>
      <CardTitle className="dark:text-white">Submission History</CardTitle>
      <CardDescription>Submitted versions and reporting periods for this grant. Open a version to review its recorded report and evidence without editing it.</CardDescription>
    </CardHeader>
    <CardContent>
      {history.length === 0 ? <p className="rounded-lg border border-dashed border-brand-line p-4 text-sm text-slate-500">No reports for this grant have been submitted yet. The current report remains a draft.</p> :
        <ol className="space-y-3">{history.map((item) => {
          const selected = item.reportId === reportId && item.versionNumber === versionNumber;
          const href = `/dashboard/super-admin/reports/${item.reportId}${item.isCurrentVersion ? "" : `?version=${item.versionNumber}`}`;
          return <li key={item.versionId} className={`rounded-lg border p-4 ${selected ? "border-brand-navy bg-brand-accent/30" : "border-brand-line"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2"><p className="font-bold">{item.reportTitle} · v{item.versionNumber}</p><StatusBadge status={formatGrantLabel(item.versionStatus)} />{selected ? <span className="text-xs font-semibold text-brand-navy">Viewing</span> : null}</div>
                <p className="text-sm text-slate-600 dark:text-slate-300">{reportTypeLabels[item.reportType]} · {date(item.reportingPeriodStart)} – {date(item.reportingPeriodEnd)}</p>
                <p className="text-xs text-slate-500">Submitted {dateTime(item.submittedAt)}{item.submittedBy ? ` by ${item.submittedBy}` : ""}</p>
                {item.recordedReadiness ? <p className="text-xs text-slate-500">Readiness at submission: {formatGrantLabel(item.recordedReadiness)}{item.warningsAcknowledged ? " · Warnings explicitly acknowledged" : ""}</p> : null}
                {item.readinessWarnings?.length ? <details className="text-xs text-slate-600 dark:text-slate-300"><summary className="cursor-pointer font-semibold">{item.readinessWarnings.length} warning(s) recorded at submission</summary><ul className="mt-2 list-disc space-y-1 pl-5">{item.readinessWarnings.map((warning) => <li key={warning.id}><strong>{warning.title}:</strong> {warning.detail}</li>)}</ul></details> : null}
                {item.recordedReadiness === "NEEDS_REVIEW" && item.readinessWarnings === null ? <p className="text-xs text-amber-800">Detailed warnings were not snapshotted for this earlier submission. Any current review is reconstructed from saved evidence, not an exact warning snapshot.</p> : null}
                {item.certifications.length ? <p className="text-xs text-slate-500">{item.certifications.map((certification) => `${formatGrantLabel(certification.party)}: ${certification.name}${certification.designation ? ` (${certification.designation})` : ""}${certification.certificationDate ? `, certified ${date(certification.certificationDate)}` : ""}${certification.digitallyConfirmed ? `, digitally confirmed ${dateTime(certification.confirmedAt)}` : ", not confirmed"}`).join(" · ")}</p> : null}
              </div>
              {!selected ? <Link href={href} aria-label={`Review submitted ${item.reportTitle} version ${item.versionNumber}`} className="inline-flex min-h-9 items-center rounded-md border border-brand-line px-3 text-xs font-bold text-brand-navy hover:border-brand-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy">Review submitted version</Link> : null}
            </div>
          </li>;
        })}</ol>}
    </CardContent>
  </Card>;
}
