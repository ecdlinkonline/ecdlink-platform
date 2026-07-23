"use client";

import { BarChart } from "@/components/charts/bar-chart";
import { DataTable, KpiCard, PageHeader, StatusBadge } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, CheckCircle2, EyeOff, HandHeart, UsersRound } from "lucide-react";
import { formatDonorCurrency } from "@/lib/donor/format";
import type { DonorReport, ImpactProject, PartnerOrganisation, PartnershipRequest } from "@/lib/donor/types";

export function AdminPartnerDashboard({
  projects,
  partners,
  requests,
  reports
}: {
  projects: ImpactProject[];
  partners: PartnerOrganisation[];
  requests: PartnershipRequest[];
  reports: DonorReport;
}) {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Super Admin" title="Partner & Impact Management" description="Approve projects, feature or hide projects, approve partners and monitor engagement." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Partners" value={String(partners.length)} description="Donor and CSI organisations" icon={UsersRound} />
        <KpiCard label="Projects" value={String(projects.length)} description="Impact project pipeline" icon={HandHeart} tone="green" />
        <KpiCard label="Requests" value={String(requests.length)} description="Partnership requests" icon={Building2} tone="warning" />
        <KpiCard label="Children" value={String(reports.childrenReached)} description="Potential reach" icon={UsersRound} tone="green" />
        <KpiCard label="Pipeline" value={formatDonorCurrency(reports.totalImpact)} description="Funds placeholder" icon={HandHeart} />
      </div>
      <Card className="dark:border-slate-800 dark:bg-slate-900">
        <CardHeader><CardTitle className="dark:text-white">Project moderation</CardTitle><CardDescription className="dark:text-slate-400">Approve, feature or hide centre projects.</CardDescription></CardHeader>
        <CardContent><DataTable columns={["Project", "Centre", "Category", "Budget", "Status", "Actions"]} rows={projects.slice(0, 12).map((project) => [project.title, project.centreName, project.category, formatDonorCurrency(project.budget), <StatusBadge key="status" status={project.status} />, <div key="actions" className="flex gap-2"><Button variant="secondary" className="min-h-9 px-3"><CheckCircle2 className="h-4 w-4" /> Approve</Button><Button variant="ghost" className="min-h-9 px-3"><EyeOff className="h-4 w-4" /> Hide</Button></div>])} /></CardContent>
      </Card>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="dark:border-slate-800 dark:bg-slate-900"><CardHeader><CardTitle className="dark:text-white">Funding pipeline</CardTitle></CardHeader><CardContent><BarChart data={reports.fundingPipeline} /></CardContent></Card>
        <Card className="dark:border-slate-800 dark:bg-slate-900"><CardHeader><CardTitle className="dark:text-white">Corporate engagement</CardTitle></CardHeader><CardContent><BarChart data={reports.corporateEngagement} /></CardContent></Card>
      </div>
      <Card className="dark:border-slate-800 dark:bg-slate-900">
        <CardHeader><CardTitle className="dark:text-white">Partner approvals and engagement</CardTitle></CardHeader>
        <CardContent><DataTable columns={["Partner", "Type", "Focus", "Status", "Engagement"]} rows={partners.map((partner) => [partner.name, partner.type, partner.focusAreas.join(", "), <StatusBadge key="status" status={partner.status} />, `${partner.engagementScore}%`])} /></CardContent>
      </Card>
    </div>
  );
}
