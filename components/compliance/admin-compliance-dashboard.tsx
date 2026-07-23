"use client";

import Link from "next/link";
import { AlertTriangle, Download, FileCheck2, FileX2, ShieldCheck } from "lucide-react";
import { BarChart } from "@/components/charts/bar-chart";
import { DonutChart } from "@/components/charts/donut-chart";
import { Alert, DataTable, KpiCard, PageHeader, StatusBadge } from "@/components/design-system";
import { ComplianceRecordsTable } from "@/components/compliance/compliance-records-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatComplianceDate } from "@/lib/compliance/format";
import type { CentreComplianceRecord, ComplianceReport } from "@/lib/compliance/types";

export function AdminComplianceDashboard({ records, reports }: { records: CentreComplianceRecord[]; reports: ComplianceReport }) {
  const attentionRecords = records.filter((record) => record.scoreLight !== "Green").slice(0, 8);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Super Admin"
        title="Compliance Management"
        description="Monitor document status, expiry dates, traffic-light scores, verification notes and renewal reminders across every ECD centre."
        actions={<Link href="/dashboard/super-admin"><Button variant="secondary">Back to admin dashboard</Button></Link>}
      />

      <Alert
        tone="warning"
        title="Funding and procurement connections are placeholders"
        description="This module stores compliance readiness only. Funding and procurement workflows will consume these scores in future modules."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Centres Tracked" value={String(reports.totalCentres)} description="Compliance profiles seeded" icon={ShieldCheck} />
        <KpiCard label="Green" value={String(reports.greenCount)} description="Ready or near-ready" icon={ShieldCheck} tone="green" />
        <KpiCard label="Amber" value={String(reports.amberCount)} description="Needs attention" icon={AlertTriangle} tone="warning" />
        <KpiCard label="Missing Docs" value={String(reports.missingDocuments)} description="Required uploads missing" icon={FileX2} tone="warning" />
        <KpiCard label="Verified Docs" value={String(reports.verifiedDocuments)} description="Admin verified" icon={FileCheck2} tone="green" />
      </div>

      <ComplianceRecordsTable records={records} />

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card className="dark:border-slate-800 dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="dark:text-white">Traffic-light overview</CardTitle>
            <CardDescription className="dark:text-slate-400">Green, amber and red compliance profile distribution.</CardDescription>
          </CardHeader>
          <CardContent>
            <DonutChart
              data={[
                { label: "Green", value: reports.greenCount, color: "#2E7D32" },
                { label: "Amber", value: reports.amberCount, color: "#F59E0B" },
                { label: "Red", value: reports.redCount, color: "#DC2626" }
              ]}
            />
          </CardContent>
        </Card>

        <Card className="dark:border-slate-800 dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="dark:text-white">Compliance reports</CardTitle>
            <CardDescription className="dark:text-slate-400">Document status and regional readiness analytics.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="mb-3 font-bold text-brand-ink dark:text-white">Document status breakdown</p>
              <BarChart data={reports.documentStatusBreakdown} />
            </div>
            <div>
              <p className="mb-3 font-bold text-brand-ink dark:text-white">Regional readiness score</p>
              <BarChart data={reports.regionalReadiness} />
            </div>
            <Button>
              <Download className="h-4 w-4" />
              Export compliance report
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="dark:border-slate-800 dark:bg-slate-900">
        <CardHeader>
          <CardTitle className="dark:text-white">Renewal reminders and admin notes</CardTitle>
          <CardDescription className="dark:text-slate-400">Centres with missing, expired or rejected documents requiring follow-up.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={["Centre", "Compliance", "Document", "Status", "Expiry", "Admin verification note"]}
            rows={attentionRecords.flatMap((record) =>
              record.documents
                .filter((document) => ["Missing", "Expired", "Expiring Soon", "Rejected"].includes(document.status))
                .slice(0, 2)
                .map((document) => [
                  <span key="centre" className="font-bold text-brand-ink dark:text-white">{record.centreName}</span>,
                  <StatusBadge key="score" status={record.scoreLight} />,
                  document.type,
                  <StatusBadge key="status" status={document.status} />,
                  formatComplianceDate(document.expiryDate),
                  document.verificationNote
                ])
            )}
          />
        </CardContent>
      </Card>
    </div>
  );
}
