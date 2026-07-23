"use client";

import Link from "next/link";
import { Bell, CalendarClock, FileText, ReceiptText, WalletCards } from "lucide-react";
import { Alert, InvoiceLayout, KpiCard, PageHeader, StatusBadge, useToast } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMembershipCurrency, formatMembershipDate, membershipReminderTemplates } from "@/lib/membership/format";
import type { MembershipRecord } from "@/lib/membership/types";

export function CentreMembershipView({ membership }: { membership: MembershipRecord }) {
  const { pushToast } = useToast();

  return (
    <div className="space-y-6">
        <PageHeader
          eyebrow="ECD Centre"
          title="My Membership"
          description="View your annual ECDLink membership status, renewal date, invoice, receipt placeholder and payment readiness."
          actions={<Link href="/dashboard/ecd-centre"><Button variant="secondary">Back to centre dashboard</Button></Link>}
        />

        <Alert
          tone={membership.status === "Active" ? "success" : "warning"}
          title={membership.status === "Active" ? "Membership in good standing" : "Membership follow-up required"}
          description={membership.status === "Active" ? "Your centre can access ECDLink procurement, compliance support and funding readiness services." : "Please review your invoice and renewal reminder. Payment capture is a future integration placeholder."}
        />

        <div className="grid gap-4 md:grid-cols-4">
          <KpiCard label="Membership Status" value={membership.status} description={membership.centreName} icon={WalletCards} tone={membership.status === "Active" ? "green" : "warning"} />
          <KpiCard label="Annual Fee" value={formatMembershipCurrency(membership.annualFee)} description="ECDLink annual membership" icon={ReceiptText} />
          <KpiCard label="Expiry Date" value={formatMembershipDate(membership.expiryDate)} description={`Started ${formatMembershipDate(membership.startDate)}`} icon={CalendarClock} tone="warning" />
          <KpiCard label="Payment Status" value={membership.paymentStatus} description="Gateway integration pending" icon={FileText} tone={membership.paymentStatus === "Paid" ? "green" : "warning"} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <Card className="dark:border-slate-800 dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="dark:text-white">Membership record</CardTitle>
              <CardDescription className="dark:text-slate-400">Annual membership fee is fixed at {formatMembershipCurrency(membership.annualFee)} per ECD centre.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {[
                ["Centre", membership.centreName],
                ["Contact person", membership.contactPerson],
                ["Email", membership.emailAddress],
                ["Area / Region", `${membership.area}, ${membership.region}`],
                ["Start date", formatMembershipDate(membership.startDate)],
                ["Expiry date", formatMembershipDate(membership.expiryDate)],
                ["Renewal reminder", formatMembershipDate(membership.renewalReminderDate)],
                ["Invoice number", membership.invoiceNumber]
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-brand-line p-4 dark:border-slate-800">
                  <p className="text-sm font-semibold text-slate-500">{label}</p>
                  <p className="mt-1 font-bold text-brand-ink dark:text-white">{value}</p>
                </div>
              ))}
              <div className="rounded-lg border border-brand-line p-4 dark:border-slate-800">
                <p className="text-sm font-semibold text-slate-500">Membership status</p>
                <div className="mt-2"><StatusBadge status={membership.status} /></div>
              </div>
              <div className="rounded-lg border border-brand-line p-4 dark:border-slate-800">
                <p className="text-sm font-semibold text-slate-500">Payment status</p>
                <div className="mt-2"><StatusBadge status={membership.paymentStatus} /></div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <InvoiceLayout
              invoiceNo={membership.invoiceNumber}
              recipient={membership.centreName}
              total={formatMembershipCurrency(membership.annualFee)}
              status={membership.invoiceStatus}
            />

            <Card className="dark:border-slate-800 dark:bg-slate-900">
              <CardHeader>
                <CardTitle className="dark:text-white">Renewal actions</CardTitle>
                <CardDescription className="dark:text-slate-400">These actions are placeholders for billing automation.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  className="w-full"
                  onClick={() => pushToast({ title: "Invoice placeholder ready", description: `${membership.invoiceNumber} can be exported when PDF generation is connected.` })}
                >
                  <FileText className="h-4 w-4" />
                  Generate invoice
                </Button>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => pushToast({ title: "Receipt placeholder", description: membership.receiptPlaceholder })}
                >
                  <ReceiptText className="h-4 w-4" />
                  View receipt placeholder
                </Button>
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => pushToast({ title: "Renewal reminder scheduled", description: `Reminder date: ${formatMembershipDate(membership.renewalReminderDate)}.` })}
                >
                  <Bell className="h-4 w-4" />
                  Renewal reminder
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="dark:border-slate-800 dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="dark:text-white">Billing activity</CardTitle>
            <CardDescription className="dark:text-slate-400">Payment integration is intentionally not enabled yet.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-4">
            {membershipReminderTemplates.map((item, index) => (
              <div key={item} className="rounded-lg border border-brand-line p-4 dark:border-slate-800">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-brand-navy">
                  <span className="text-sm font-bold">{index + 1}</span>
                </div>
                <p className="mt-3 text-sm font-bold text-brand-ink dark:text-white">{item}</p>
              </div>
            ))}
          </CardContent>
        </Card>
    </div>
  );
}
