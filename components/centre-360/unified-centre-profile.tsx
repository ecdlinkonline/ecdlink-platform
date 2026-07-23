"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Edit,
  HandCoins,
  History,
  NotebookPen,
  PackageCheck,
  Search,
  ShieldCheck,
  UsersRound,
  WalletCards
} from "lucide-react";
import { Alert, DataTable, InvoiceLayout, KpiCard, PageHeader, StatusBadge, useToast } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/procurement/catalog";
import { formatComplianceDate } from "@/lib/compliance/format";
import { formatFundingCurrency } from "@/lib/funding/format";
import { formatMembershipCurrency, formatMembershipDate } from "@/lib/membership/format";
import type { UnifiedCentreProfile } from "@/lib/centre-360/types";

const tabs = ["Overview", "Membership", "Compliance", "Procurement", "Funding", "Documents", "Orders", "Invoices", "Notes", "Timeline"] as const;
type CentreTab = (typeof tabs)[number];

function ScoreCard({ label, value, status }: { label: string; value: number; status: string }) {
  return (
    <Card className="dark:border-slate-800 dark:bg-slate-900">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-bold text-brand-ink dark:text-white">{value}%</p>
          </div>
          <StatusBadge status={status} />
        </div>
        <Progress value={value} className="mt-4" />
      </CardContent>
    </Card>
  );
}

export function UnifiedCentreProfileView({ profile }: { profile: UnifiedCentreProfile }) {
  const [activeTab, setActiveTab] = useState<CentreTab>("Overview");
  const [note, setNote] = useState("");
  const { pushToast } = useToast();
  const { centre, membership, compliance, funding, procurementOrders } = profile;
  const orderTotal = (order: UnifiedCentreProfile["procurementOrders"][number]) => order.currentSpend ?? 0;
  const procurementValue = procurementOrders.reduce((sum, order) => sum + orderTotal(order), 0);
  const topProducts = useMemo(() => {
    const totals = procurementOrders.flatMap((order) => order.items).reduce<Record<string, number>>((acc, item) => {
      acc[item.productId] = (acc[item.productId] ?? 0) + item.quantity;
      return acc;
    }, {});
    return Object.entries(totals).map(([productId, quantity]) => ({ productId, quantity })).sort((a, b) => b.quantity - a.quantity).slice(0, 8);
  }, [procurementOrders]);
  const invoices = [
    ...(membership ? [{ id: membership.invoiceNumber, type: "Membership", amount: membership.annualFee, status: membership.invoiceStatus, recipient: centre.centreName }] : []),
    ...procurementOrders.map((order) => ({ id: order.invoiceNumber, type: "Procurement", amount: orderTotal(order), status: order.status, recipient: centre.centreName }))
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="360 Centre View"
        title={centre.centreName}
        description={`${centre.principalName} | ${centre.area}, ${centre.region} | ${centre.npoNumber} | ${centre.dbeRegistrationStatus}`}
        actions={
          <>
            <Link href="/dashboard/super-admin/centres"><Button variant="secondary">Back to centres</Button></Link>
            <Link href={`/dashboard/super-admin/centres/${centre.id}/edit`}><Button><Edit className="h-4 w-4" /> Edit profile</Button></Link>
          </>
        }
      />

      <Card className="overflow-hidden dark:border-slate-800 dark:bg-slate-900">
        <div className="bg-brand-navy p-6 text-white sm:p-8">
          <div className="grid gap-6 xl:grid-cols-[1fr_360px] xl:items-end">
            <div>
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={profile.healthLabel} />
                <StatusBadge status={`${profile.riskLevel} Risk`} />
                <StatusBadge status={centre.registrationStatus} />
              </div>
              <h2 className="mt-4 text-3xl font-bold">Overall health score: {profile.healthScore}%</h2>
              <p className="mt-3 max-w-3xl leading-7 text-blue-100">
                Unified operating profile for membership, compliance, procurement, funding, documents, invoices, notes and activity.
              </p>
            </div>
            <div className="rounded-lg bg-white/10 p-4">
              <div className="mb-2 flex justify-between text-sm text-blue-100">
                <span>Centre health</span>
                <span className="font-bold text-white">{profile.healthLabel}</span>
              </div>
              <Progress value={profile.healthScore} />
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Membership" value={membership?.status ?? "Missing"} description={membership ? `Expires ${formatMembershipDate(membership.expiryDate)}` : "No record"} icon={WalletCards} tone={membership?.status === "Active" ? "green" : "warning"} />
        <KpiCard label="Compliance" value={`${compliance?.score ?? 0}%`} description={compliance?.scoreLight ?? "No score"} icon={ShieldCheck} tone={(compliance?.score ?? 0) >= 80 ? "green" : "warning"} />
        <KpiCard label="Funding" value={`${funding?.readinessScore ?? 0}%`} description={funding?.status ?? "No record"} icon={HandCoins} tone={(funding?.readinessScore ?? 0) >= 80 ? "green" : "warning"} />
        <KpiCard label="Procurement" value={centre.procurementStatus} description={`${procurementOrders.length} orders | ${formatCurrency(procurementValue)}`} icon={PackageCheck} tone={centre.procurementStatus === "Active" ? "green" : "warning"} />
        <KpiCard label="Children / Staff" value={`${centre.numberOfChildren}/${centre.numberOfStaff}`} description="Children and staff" icon={UsersRound} />
      </div>

      <div className="flex gap-2 overflow-x-auto rounded-lg border border-brand-line bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`shrink-0 rounded-lg px-3 py-2 text-sm font-bold ${activeTab === tab ? "bg-brand-navy text-white" : "text-slate-600 hover:bg-brand-accent dark:text-slate-300 dark:hover:bg-slate-950"}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Overview" ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <ScoreCard label="Overall Health" value={profile.healthScore} status={profile.healthLabel} />
            <ScoreCard label="Compliance Score" value={compliance?.score ?? 0} status={compliance?.scoreLight ?? "Red"} />
            <ScoreCard label="Funding Readiness" value={funding?.readinessScore ?? 0} status={funding?.status ?? "Draft"} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
            <Card className="dark:border-slate-800 dark:bg-slate-900">
              <CardHeader>
                <CardTitle className="dark:text-white">Centre overview</CardTitle>
                <CardDescription className="dark:text-slate-400">Core operating profile and quick indicators.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                {[
                  ["Centre name", centre.centreName],
                  ["Principal", centre.principalName],
                  ["Region", `${centre.area}, ${centre.region}`],
                  ["Registration", centre.registrationStatus],
                  ["NPO", centre.npoNumber],
                  ["DBE", centre.dbeRegistrationStatus],
                  ["Risk level", profile.riskLevel],
                  ["Last updated", centre.lastUpdatedDate]
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-brand-line p-4 dark:border-slate-800">
                    <p className="text-sm font-semibold text-slate-500">{label}</p>
                    <p className="mt-1 font-bold text-brand-ink dark:text-white">{value}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="dark:border-slate-800 dark:bg-slate-900">
              <CardHeader>
                <CardTitle className="dark:text-white">Outstanding actions</CardTitle>
                <CardDescription className="dark:text-slate-400">Highest-priority work for ECDLink staff.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {profile.outstandingActions.length > 0 ? profile.outstandingActions.map((action) => (
                  <div key={action.id} className="rounded-lg border border-brand-line p-4 dark:border-slate-800">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-bold text-brand-ink dark:text-white">{action.title}</p>
                      <StatusBadge status={action.status} />
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{action.description}</p>
                  </div>
                )) : <Alert tone="success" title="No urgent actions" description="This centre has no critical operational follow-up right now." />}
              </CardContent>
            </Card>
          </div>

          <Card className="dark:border-slate-800 dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="dark:text-white">Latest activity</CardTitle>
              <CardDescription className="dark:text-slate-400">Combined activity from all modules.</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={["Date", "Source", "Activity", "Detail"]}
                rows={profile.timeline.slice(0, 8).map((item) => [item.date, <StatusBadge key="source" status={item.source} />, item.title, item.description])}
              />
            </CardContent>
          </Card>

          <Card className="dark:border-slate-800 dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="dark:text-white">Quick actions</CardTitle>
              <CardDescription className="dark:text-slate-400">Common ECDLink staff tasks from this working screen.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              {["Add note", "Generate report", "Send renewal reminder", "Create document request", "Review funding pack"].map((action) => (
                <Button key={action} variant="secondary" onClick={() => pushToast({ title: `${action} placeholder`, description: "This quick action is ready for future workflow integration." })}>{action}</Button>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {activeTab === "Membership" ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <Card className="dark:border-slate-800 dark:bg-slate-900">
            <CardHeader><CardTitle className="dark:text-white">Membership history</CardTitle><CardDescription className="dark:text-slate-400">Annual fees, renewals and payment placeholders.</CardDescription></CardHeader>
            <CardContent>
              {membership ? (
                <DataTable columns={["Start", "Expiry", "Status", "Invoice", "Payment", "Receipt"]} rows={[[formatMembershipDate(membership.startDate), formatMembershipDate(membership.expiryDate), <StatusBadge key="status" status={membership.status} />, membership.invoiceNumber, <StatusBadge key="payment" status={membership.paymentStatus} />, membership.receiptPlaceholder]]} />
              ) : <Alert tone="warning" title="No membership record" description="Membership data has not been created for this centre." />}
            </CardContent>
          </Card>
          {membership ? <InvoiceLayout invoiceNo={membership.invoiceNumber} recipient={centre.centreName} total={formatMembershipCurrency(membership.annualFee)} status={membership.invoiceStatus} /> : null}
        </div>
      ) : null}

      {activeTab === "Compliance" ? (
        <Card className="dark:border-slate-800 dark:bg-slate-900">
          <CardHeader><CardTitle className="dark:text-white">Compliance documents</CardTitle><CardDescription className="dark:text-slate-400">Verification status, expiry dates, missing documents and compliance history.</CardDescription></CardHeader>
          <CardContent>
            <DataTable columns={["Document", "Status", "Expiry", "Uploaded", "Verification note"]} rows={(compliance?.documents ?? []).map((document) => [document.type, <StatusBadge key="status" status={document.status} />, formatComplianceDate(document.expiryDate), formatComplianceDate(document.uploadedAt), document.verificationNote])} />
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "Procurement" || activeTab === "Orders" ? (
        <div className="space-y-6">
          <Card className="dark:border-slate-800 dark:bg-slate-900">
            <CardHeader><CardTitle className="dark:text-white">Procurement order history</CardTitle><CardDescription className="dark:text-slate-400">Monthly budgets, invoices, delivery history and order status.</CardDescription></CardHeader>
            <CardContent>
              <DataTable
                columns={["Order", "Month", "Budget", "Total", "Status", "Delivery", "Invoice"]}
                rows={procurementOrders.map((order) => [order.orderNumber, order.month, formatCurrency(order.budget), formatCurrency(orderTotal(order)), <StatusBadge key="status" status={order.status} />, <StatusBadge key="delivery" status={order.deliveryStatus} />, order.invoiceNumber])}
              />
            </CardContent>
          </Card>
          <Card className="dark:border-slate-800 dark:bg-slate-900">
            <CardHeader><CardTitle className="dark:text-white">Products ordered</CardTitle><CardDescription className="dark:text-slate-400">Top products and centre-level packing history.</CardDescription></CardHeader>
            <CardContent>
              <DataTable columns={["Product", "Supplier", "Pack", "Quantity"]} rows={topProducts.map((item) => [item.productId, "Snapshot", "Stored on order", String(item.quantity)])} />
            </CardContent>
          </Card>
        </div>
      ) : null}

      {activeTab === "Funding" ? (
        <div className="space-y-6">
          <Card className="dark:border-slate-800 dark:bg-slate-900">
            <CardHeader><CardTitle className="dark:text-white">Funding projects</CardTitle><CardDescription className="dark:text-slate-400">Projects, application status, proposal status and budget readiness.</CardDescription></CardHeader>
            <CardContent>
              <DataTable columns={["Project", "Funder Type", "Requested", "Beneficiaries", "Status"]} rows={(funding?.projectProfiles ?? []).map((project) => [project.title, project.funderType, formatFundingCurrency(project.requestedAmount), String(project.beneficiaries), <StatusBadge key="status" status={project.status} />])} />
            </CardContent>
          </Card>
          <Card className="dark:border-slate-800 dark:bg-slate-900">
            <CardHeader><CardTitle className="dark:text-white">Application tracker</CardTitle><CardDescription className="dark:text-slate-400">Readiness status from opportunity match to decision.</CardDescription></CardHeader>
            <CardContent>
              <DataTable columns={["Stage", "Status", "Date"]} rows={(funding?.applicationTracker ?? []).map((stage) => [stage.stage, <StatusBadge key="status" status={stage.status} />, stage.date ?? "Pending"])} />
            </CardContent>
          </Card>
        </div>
      ) : null}

      {activeTab === "Documents" ? (
        <Card className="dark:border-slate-800 dark:bg-slate-900">
          <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div><CardTitle className="dark:text-white">Unified document vault</CardTitle><CardDescription className="dark:text-slate-400">Every uploaded or generated document across all modules with preview placeholders.</CardDescription></div>
            <div className="flex min-h-10 items-center gap-2 rounded-lg border border-brand-line bg-white px-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950"><Search className="h-4 w-4" /> Preview placeholders</div>
          </CardHeader>
          <CardContent>
            <DataTable columns={["Document", "Source", "Status", "Expiry", "File", "Preview"]} rows={profile.documents.map((document) => [document.title, document.source, <StatusBadge key="status" status={document.status} />, formatComplianceDate(document.expiryDate), document.fileName ?? "Not uploaded", <Button key="preview" variant="ghost" className="min-h-9 px-3" onClick={() => pushToast({ title: "Preview placeholder", description: `${document.title} preview will open when storage is connected.` })}>Preview</Button>])} />
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "Invoices" ? (
        <Card className="dark:border-slate-800 dark:bg-slate-900">
          <CardHeader><CardTitle className="dark:text-white">Invoices</CardTitle><CardDescription className="dark:text-slate-400">Membership and procurement invoices with payment placeholders.</CardDescription></CardHeader>
          <CardContent>
            <DataTable columns={["Invoice", "Type", "Recipient", "Amount", "Status"]} rows={invoices.map((invoice) => [invoice.id, invoice.type, invoice.recipient, formatCurrency(invoice.amount), <StatusBadge key="status" status={invoice.status} />])} />
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "Notes" ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <Card className="dark:border-slate-800 dark:bg-slate-900">
            <CardHeader><CardTitle className="dark:text-white">Admin notes</CardTitle><CardDescription className="dark:text-slate-400">Internal ECDLink notes from centre, compliance and funding records.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {[...centre.notes.map((item) => ({ author: item.author, body: item.body, date: item.createdAt })), ...(compliance?.adminVerificationNotes ?? []).map((body) => ({ author: "Compliance Desk", body, date: compliance?.lastUpdatedAt ?? centre.lastUpdatedDate })), ...(funding?.adminNotes ?? []).map((body) => ({ author: "Funding Desk", body, date: funding?.lastUpdatedAt ?? centre.lastUpdatedDate }))].map((item, index) => (
                <div key={`${item.author}-${index}`} className="rounded-lg border border-brand-line p-4 dark:border-slate-800">
                  <p className="font-bold text-brand-ink dark:text-white">{item.author}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.body}</p>
                  <p className="mt-2 text-xs font-semibold text-slate-400">{item.date}</p>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="dark:border-slate-800 dark:bg-slate-900">
            <CardHeader><CardTitle className="dark:text-white">Write internal note</CardTitle><CardDescription className="dark:text-slate-400">Placeholder for future persistence.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Write an internal note..." className="min-h-40 w-full rounded-lg border border-brand-line bg-white p-3 text-sm outline-none dark:border-slate-800 dark:bg-slate-950" />
              <Button onClick={() => { pushToast({ title: "Internal note placeholder", description: note ? "Note captured in the UI for future persistence." : "Add note text first." }); setNote(""); }}><NotebookPen className="h-4 w-4" /> Save note</Button>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {activeTab === "Timeline" ? (
        <Card className="dark:border-slate-800 dark:bg-slate-900">
          <CardHeader><CardTitle className="dark:text-white">Combined activity timeline</CardTitle><CardDescription className="dark:text-slate-400">Membership, orders, compliance, funding, documents, notes and profile activity in one place.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {profile.timeline.map((item) => (
              <div key={item.id} className="flex gap-3 rounded-lg border border-brand-line p-4 dark:border-slate-800">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-blue-50 text-brand-navy"><History className="h-5 w-5" /></div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><p className="font-bold text-brand-ink dark:text-white">{item.title}</p><StatusBadge status={item.source} /></div>
                  <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.description}</p>
                  <p className="mt-2 text-xs font-semibold text-slate-400">{item.date}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
