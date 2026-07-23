import { notFound } from "next/navigation";
import { RoleDashboardShell } from "@/components/app-shell/role-dashboard-shell";
import { PageHeader, StatusBadge } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getImpactProject } from "@/lib/donor/api";
import { formatDonorCurrency } from "@/lib/donor/format";

export default async function DonorProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await getImpactProject(projectId);
  if (!project) notFound();

  return (
    <RoleDashboardShell role="donor">
      <div className="space-y-6">
        <PageHeader eyebrow="Project Profile" title={project.title} description={`${project.centreName} | ${project.category} | ${project.province}`} />
        <Card className="dark:border-slate-800 dark:bg-slate-900">
          <CardHeader><CardTitle className="dark:text-white">Project overview</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap gap-2"><StatusBadge status={project.status} /><StatusBadge status={project.category} /></div>
            <p className="leading-7 text-slate-600 dark:text-slate-300">{project.description}</p>
            <div><div className="mb-2 flex justify-between text-sm"><span className="font-semibold">Budget progress</span><span className="font-bold">{project.progress}% of {formatDonorCurrency(project.budget)}</span></div><Progress value={project.progress} /></div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-brand-line p-4 dark:border-slate-800"><p className="text-sm text-slate-500">Goal</p><p className="mt-1 font-bold">{project.goal}</p></div>
              <div className="rounded-lg border border-brand-line p-4 dark:border-slate-800"><p className="text-sm text-slate-500">Impact</p><p className="mt-1 font-bold">{project.impact}</p></div>
              <div className="rounded-lg border border-brand-line p-4 dark:border-slate-800"><p className="text-sm text-slate-500">Timeline</p><p className="mt-1 font-bold">{project.timeline}</p></div>
            </div>
            <div className="flex flex-wrap gap-3">
              {["Express interest", "Request meeting", "Sponsor project placeholder", "Request proposal", "Bookmark project"].map((action) => <Button key={action} variant="secondary">{action}</Button>)}
            </div>
          </CardContent>
        </Card>
      </div>
    </RoleDashboardShell>
  );
}
