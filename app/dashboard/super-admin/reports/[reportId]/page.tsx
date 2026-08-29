export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { NlcGrantReportEditor } from "@/components/reports/nlc-grant-report-editor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSuperAdmin } from "@/lib/auth/permissions";
import { getGrantReportEditor } from "@/lib/repositories/grant-reports";

export default async function GrantReportPage({ params }: { params: Promise<{ reportId: string }> }) {
  await requireSuperAdmin();
  const report = await getGrantReportEditor((await params).reportId);
  if (!report) notFound();
  return report.report.template === "NLC" ? <NlcGrantReportEditor initialData={report} /> : (
        <Card className="dark:border-slate-800 dark:bg-slate-900">
          <CardHeader><CardTitle className="dark:text-white">{report.report.title}</CardTitle></CardHeader>
          <CardContent><p className="rounded-lg border border-dashed border-brand-line p-8 text-center text-sm text-slate-500">Template implementation coming in the next phase.</p></CardContent>
        </Card>
      );
}
