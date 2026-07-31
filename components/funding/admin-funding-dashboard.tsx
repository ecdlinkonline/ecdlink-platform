"use client";

import Link from "next/link";
import { Download, FileText, HandCoins, Send, Target, UsersRound } from "lucide-react";
import { BarChart } from "@/components/charts/bar-chart";
import { Alert, DataTable, KpiCard, PageHeader, StatusBadge } from "@/components/design-system";
import { FundingRecordsTable } from "@/components/funding/funding-records-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatFundingCurrency } from "@/lib/funding/format";
import type { FundingFilters, FundingReadinessRecord, FundingReport } from "@/lib/funding/types";

export function AdminFundingDashboard({ records, reports, filters = {} }: { records: FundingReadinessRecord[]; reports: FundingReport; filters?: FundingFilters }) {
  const activeProjects = records.flatMap((record) => record.projectProfiles.map((project) => ({ ...project, centreName: record.centreName, region: record.region }))).slice(0, 10);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Super Admin"
        title="Funding Readiness"
        description="Manage centre readiness scores, project profiles, application checklists, supporting documents and funding application status across the network."
        actions={<Link href="/dashboard/super-admin"><Button variant="secondary">Back to admin dashboard</Button></Link>}
      />

      <Alert title="Donor portal connection placeholder" description="This module prepares funding applications. Donor browsing, sponsorship and CSI partner workflows remain placeholders for future modules." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Centres Tracked" value={String(reports.totalCentres)} description="Seeded readiness records" icon={UsersRound} />
        <KpiCard label="Average Readiness" value={`${reports.averageReadiness}%`} description="Across all centres" icon={Target} tone="green" />
        <KpiCard label="Submitted" value={String(reports.submittedCount)} description="Applications sent" icon={Send} tone="navy" />
        <KpiCard label="Approved" value={String(reports.approvedCount)} description="Successful applications" icon={FileText} tone="green" />
        <KpiCard label="Total Requested" value={formatFundingCurrency(reports.totalRequested)} description="All project profiles" icon={HandCoins} tone="navy" />
      </div>

      <FundingRecordsTable records={records} filters={filters} regions={reports.regionalReadiness.map(({ label }) => label)} />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="dark:border-slate-800 dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="dark:text-white">Funding reports</CardTitle>
            <CardDescription className="dark:text-slate-400">Status, funder type and regional readiness analytics.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="mb-3 font-bold text-brand-ink dark:text-white">Status breakdown</p>
              <BarChart data={reports.statusBreakdown} />
            </div>
            <div>
              <p className="mb-3 font-bold text-brand-ink dark:text-white">Regional readiness</p>
              <BarChart data={reports.regionalReadiness} />
            </div>
            <Button><Download className="h-4 w-4" /> Export funding report</Button>
          </CardContent>
        </Card>

        <Card className="dark:border-slate-800 dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="dark:text-white">Funder type pipeline</CardTitle>
            <CardDescription className="dark:text-slate-400">Opportunity type distribution across centre records.</CardDescription>
          </CardHeader>
          <CardContent>
            <BarChart data={reports.funderTypeBreakdown} />
          </CardContent>
        </Card>
      </div>

      <Card className="dark:border-slate-800 dark:bg-slate-900">
        <CardHeader>
          <CardTitle className="dark:text-white">Project profiles and application tracker</CardTitle>
          <CardDescription className="dark:text-slate-400">Active funding projects prepared by ECD centres.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={["Centre", "Project", "Funder Type", "Requested", "Beneficiaries", "Status"]}
            rows={activeProjects.map((project) => [
              <span key="centre" className="font-bold text-brand-ink dark:text-white">{project.centreName}</span>,
              project.title,
              project.funderType,
              <span key="amount" className="font-bold text-brand-navy dark:text-blue-200">{formatFundingCurrency(project.requestedAmount)}</span>,
              String(project.beneficiaries),
              <StatusBadge key="status" status={project.status} />
            ])}
          />
        </CardContent>
      </Card>
    </div>
  );
}
