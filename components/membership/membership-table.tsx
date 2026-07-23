"use client";

import { useMemo, useState } from "react";
import { Bell, FileText, RefreshCw, Search, XCircle } from "lucide-react";
import { DataTable, StatusBadge, useToast } from "@/components/design-system";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMembershipCurrency, formatMembershipDate } from "@/lib/membership/format";
import type { MembershipPaymentStatus, MembershipRecord, MembershipStatus } from "@/lib/membership/types";

const membershipStatuses: Array<MembershipStatus | "All"> = ["All", "Active", "Pending", "Overdue", "Expired", "Cancelled"];
const paymentStatuses: Array<MembershipPaymentStatus | "All"> = ["All", "Paid", "Partially Paid", "Pending", "Overdue", "Not Paid", "Refunded"];

export function MembershipTable({ memberships }: { memberships: MembershipRecord[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<MembershipStatus | "All">("All");
  const [paymentStatus, setPaymentStatus] = useState<MembershipPaymentStatus | "All">("All");
  const [region, setRegion] = useState("All");
  const { pushToast } = useToast();
  const regions = useMemo(() => ["All", ...Array.from(new Set(memberships.map((membership) => membership.region)))], [memberships]);

  async function runMembershipAction(path: string, title: string, init?: RequestInit) {
    const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, ...init });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      pushToast({ title: "Action could not be completed", description: body?.error ?? "Please try again." });
      return;
    }
    pushToast({ title, description: "Refresh the page to view the latest database values." });
  }

  const filteredMemberships = useMemo(() => {
    const search = query.trim().toLowerCase();
    return memberships.filter((membership) => {
      const searchable = [
        membership.centreName,
        membership.region,
        membership.area,
        membership.contactPerson,
        membership.emailAddress,
        membership.invoiceNumber,
        membership.status,
        membership.paymentStatus
      ].join(" ").toLowerCase();

      return (
        (!search || searchable.includes(search)) &&
        (status === "All" || membership.status === status) &&
        (paymentStatus === "All" || membership.paymentStatus === paymentStatus) &&
        (region === "All" || membership.region === region)
      );
    });
  }, [memberships, paymentStatus, query, region, status]);

  return (
    <Card className="dark:border-slate-800 dark:bg-slate-900">
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <CardTitle className="dark:text-white">Centre memberships</CardTitle>
            <CardDescription className="dark:text-slate-400">Search and filter annual membership records across all ECDLink centres.</CardDescription>
          </div>
          <Badge variant="muted">{filteredMemberships.length} records shown</Badge>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_160px_160px_170px]">
          <label className="flex min-h-11 items-center gap-2 rounded-lg border border-brand-line bg-white px-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search centres, invoices or contacts"
              className="w-full bg-transparent outline-none"
            />
          </label>
          <select value={status} onChange={(event) => setStatus(event.target.value as MembershipStatus | "All")} className="rounded-lg border border-brand-line bg-white px-3 text-sm font-semibold text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
            {membershipStatuses.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value as MembershipPaymentStatus | "All")} className="rounded-lg border border-brand-line bg-white px-3 text-sm font-semibold text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
            {paymentStatuses.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select value={region} onChange={(event) => setRegion(event.target.value)} className="rounded-lg border border-brand-line bg-white px-3 text-sm font-semibold text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
            {regions.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
      </CardHeader>
      <CardContent>
        {filteredMemberships.length === 0 ? (
          <div className="rounded-lg border border-dashed border-brand-line p-8 text-center dark:border-slate-800">
            <p className="font-bold text-brand-ink dark:text-white">No memberships found</p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Adjust the search or filters to see more records.</p>
          </div>
        ) : (
          <DataTable
            columns={["Centre", "Region", "Status", "Expiry", "Invoice", "Payment", "Fee", "Actions"]}
            rows={filteredMemberships.map((membership) => [
            <span key="centre" className="font-bold text-brand-ink dark:text-white">{membership.centreName}</span>,
            `${membership.area}, ${membership.region}`,
            <StatusBadge key="status" status={membership.status} />,
            formatMembershipDate(membership.expiryDate),
            <span key="invoice" className="font-semibold text-brand-navy dark:text-blue-200">{membership.invoiceNumber}</span>,
            <StatusBadge key="payment" status={membership.paymentStatus} />,
            formatMembershipCurrency(membership.annualFee),
            <div key="actions" className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                className="min-h-9 px-3"
                onClick={() => runMembershipAction(`/api/memberships/${membership.id}/invoice`, "Invoice placeholder generated")}
              >
                <FileText className="h-4 w-4" />
                Invoice
              </Button>
              <Button
                variant="ghost"
                className="min-h-9 px-3"
                onClick={() => pushToast({ title: "Renewal reminder queued", description: `${membership.centreName} will receive a renewal reminder.` })}
              >
                <Bell className="h-4 w-4" />
                Remind
              </Button>
              <Button
                variant="ghost"
                className="min-h-9 px-3"
                onClick={() => {
                  if (window.confirm(`Renew membership for ${membership.centreName}?`)) {
                    void runMembershipAction(`/api/memberships/${membership.id}/renew`, "Renewal created");
                  }
                }}
              >
                <RefreshCw className="h-4 w-4" />
                Renew
              </Button>
              <Button
                variant="ghost"
                className="min-h-9 px-3 text-red-700"
                onClick={() => {
                  if (window.confirm(`Cancel membership for ${membership.centreName}?`)) {
                    void runMembershipAction(`/api/memberships/${membership.id}/cancel`, "Membership cancelled", { body: JSON.stringify({ reason: "Cancelled from Super Admin dashboard." }) });
                  }
                }}
              >
                <XCircle className="h-4 w-4" />
                Cancel
              </Button>
            </div>
            ])}
          />
        )}
      </CardContent>
    </Card>
  );
}
