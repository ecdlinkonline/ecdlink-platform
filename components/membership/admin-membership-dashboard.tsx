"use client";

import Link from "next/link";
import { Bell, Download, FileText, ReceiptText, WalletCards } from "lucide-react";
import { BarChart } from "@/components/charts/bar-chart";
import { Alert, DataTable, InvoiceLayout, KpiCard, PageHeader, StatusBadge } from "@/components/design-system";
import { MembershipTable } from "@/components/membership/membership-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMembershipCurrency, formatMembershipDate } from "@/lib/membership/format";
import type { MembershipRecord, MembershipReport } from "@/lib/membership/types";

export function AdminMembershipDashboard({ memberships, reports }: { memberships: MembershipRecord[]; reports: MembershipReport }) {
  return (
    <div className="space-y-6">
        <PageHeader
          eyebrow="Super Admin"
          title="Membership & Billing"
          description="Manage annual ECDLink membership fees, renewal tracking, invoices, receipts and payment readiness across the centre network."
          actions={<Link href="/dashboard/super-admin"><Button variant="secondary">Back to admin dashboard</Button></Link>}
        />

        <Alert
          title="Payment gateway placeholder"
          description="Membership invoices and receipts are generated as placeholders. Payment gateway integration will be added in a future billing module."
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard label="Annual Fee" value={formatMembershipCurrency(reports.annualFee)} description="Per ECD centre" icon={WalletCards} />
          <KpiCard label="Active" value={String(reports.activeCount)} description="Memberships in good standing" icon={WalletCards} tone="green" />
          <KpiCard label="Pending" value={String(reports.pendingCount)} description="Awaiting onboarding or payment" icon={FileText} tone="warning" />
          <KpiCard label="Overdue" value={String(reports.overdueCount)} description="Renewal follow-up needed" icon={Bell} tone="warning" />
          <KpiCard label="Collected" value={formatMembershipCurrency(reports.collectedRevenue)} description="Paid membership value" icon={ReceiptText} tone="green" />
        </div>

        <MembershipTable memberships={memberships} />

        <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
          <Card className="dark:border-slate-800 dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="dark:text-white">Membership reports</CardTitle>
              <CardDescription className="dark:text-slate-400">Status breakdown, renewal pressure and regional revenue.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))] gap-3">
                {[
                  ["Expected", reports.expectedAnnualRevenue],
                  ["Collected", reports.collectedRevenue],
                  ["Outstanding", reports.outstandingRevenue]
                ].map(([label, value]) => (
                  <div key={label} className="min-w-0 rounded-lg border border-brand-line p-4 dark:border-slate-800">
                    <p className="text-sm font-semibold text-slate-500">{label}</p>
                    <p className="mt-1 text-xl font-bold leading-tight tabular-nums text-brand-navy dark:text-blue-200">{formatMembershipCurrency(Number(value))}</p>
                  </div>
                ))}
              </div>
              <div>
                <p className="mb-3 font-bold text-brand-ink dark:text-white">Status breakdown</p>
                <BarChart data={reports.statusBreakdown} />
              </div>
              <div>
                <p className="mb-3 font-bold text-brand-ink dark:text-white">Collected revenue by region</p>
                <BarChart data={reports.revenueByRegion} />
              </div>
              <Button>
                <Download className="h-4 w-4" />
                Export membership report
              </Button>
            </CardContent>
          </Card>

          <Card className="dark:border-slate-800 dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="dark:text-white">Renewal reminders</CardTitle>
              <CardDescription className="dark:text-slate-400">Centres needing payment, renewal or document follow-up.</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={["Centre", "Status", "Reminder", "Payment"]}
                rows={reports.renewalsDue.map((membership) => [
                  <span key="centre" className="font-bold text-brand-ink dark:text-white">{membership.centreName}</span>,
                  <StatusBadge key="status" status={membership.status} />,
                  formatMembershipDate(membership.renewalReminderDate),
                  <StatusBadge key="payment" status={membership.paymentStatus} />
                ])}
              />
            </CardContent>
          </Card>
        </div>

        <InvoiceLayout
          invoiceNo="MEM-INV-2026-SAMPLE"
          recipient="ECDLink Centre Membership"
          total={formatMembershipCurrency(reports.annualFee)}
          status="PDF Placeholder"
        />
    </div>
  );
}
