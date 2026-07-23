"use client";

import Link from "next/link";
import { Download, PackageCheck, ShoppingCart, Truck, WalletCards } from "lucide-react";
import { BarChart } from "@/components/charts/bar-chart";
import { Alert, KpiCard, PageHeader } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AdminOrdersTable } from "@/components/procurement/admin-orders-table";
import { formatCurrency } from "@/lib/procurement/catalog";
import type { CentreOrder, ProcurementProduct } from "@/lib/procurement/types";
import type { ProcurementReport } from "@/lib/procurement/api";

export function AdminProcurementConsole({ orders, reports, products }: { orders: CentreOrder[]; reports: ProcurementReport; products: ProcurementProduct[] }) {
  const counts = {
    awaiting: orders.filter((order) => order.status === "Awaiting Approval").length,
    approved: orders.filter((order) => order.status === "Approved").length,
    packed: orders.filter((order) => order.status === "Packed").length,
    delivered: orders.filter((order) => order.status === "Delivered").length,
    cancelled: orders.filter((order) => order.status === "Cancelled").length
  };

  return (
    <main className="min-h-screen bg-brand-accent dark:bg-slate-950">
      <section className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Super Admin"
          title="Procurement Management"
          description="Approve centre orders, monitor packing and delivery, consolidate supplier demand and track procurement performance."
          actions={<Link href="/dashboard/super-admin"><Button variant="secondary">Back to admin dashboard</Button></Link>}
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard label="Awaiting Approval" value={String(counts.awaiting)} description="Orders needing review" icon={ShoppingCart} tone="warning" />
          <KpiCard label="Approved" value={String(counts.approved)} description="Ready for supplier batching" icon={PackageCheck} tone="green" />
          <KpiCard label="Packed" value={String(counts.packed)} description="Centre packs prepared" icon={PackageCheck} tone="navy" />
          <KpiCard label="Delivered" value={String(counts.delivered)} description="Completed deliveries" icon={Truck} tone="green" />
          <KpiCard label="Monthly Value" value={formatCurrency(reports.monthlyValue)} description="Network procurement value" icon={WalletCards} tone="navy" />
        </div>

        <AdminOrdersTable orders={orders} products={products} />

        <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
          <Card className="dark:border-slate-800 dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="dark:text-white">Reports</CardTitle>
              <CardDescription className="dark:text-slate-400">Monthly procurement value, top products and performance.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <p className="mb-3 font-bold text-brand-ink dark:text-white">Top ordered products</p>
                <BarChart data={reports.topProducts} />
              </div>
              <div>
                <p className="mb-3 font-bold text-brand-ink dark:text-white">Centre spending</p>
                <BarChart data={reports.centreSpending} />
              </div>
            </CardContent>
          </Card>

          <Card className="dark:border-slate-800 dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="dark:text-white">Performance</CardTitle>
              <CardDescription className="dark:text-slate-400">Supplier and delivery performance snapshots.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <Alert title="Payment gateway placeholder" description="Payment integration is intentionally not enabled yet." />
              <div>
                <p className="mb-3 font-bold text-brand-ink dark:text-white">Supplier performance</p>
                {reports.supplierPerformance.map((item) => (
                  <div key={item.label} className="mb-3">
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{item.label}</span>
                      <span className="font-bold">{item.value}%</span>
                    </div>
                    <Progress value={item.value} />
                  </div>
                ))}
              </div>
              <Button className="w-full">
                <Download className="h-4 w-4" />
                Export procurement reports
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
