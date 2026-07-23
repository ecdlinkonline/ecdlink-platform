"use client";

import Link from "next/link";
import { Download, PackageCheck, Truck, WalletCards } from "lucide-react";
import { DataTable, DeliveryTracker, KpiCard, PageHeader, StatusBadge } from "@/components/design-system";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { calculateCart, deliveryStages, formatCurrency, getProductFromList } from "@/lib/procurement/catalog";
import type { CentreOrder, ConsolidatedSupplierOrder, ProcurementProduct } from "@/lib/procurement/types";

export function SupplierCombinedOrder({ orders, consolidated, products }: { orders: CentreOrder[]; consolidated: ConsolidatedSupplierOrder[]; products: ProcurementProduct[] }) {
  const totalValue = orders.reduce((sum, order) => sum + (order.currentSpend ?? calculateCart(order.items, products).total), 0);
  const requiredProducts = orders.flatMap((order) => order.items).reduce<Record<string, number>>((acc, item) => {
    acc[item.productId] = (acc[item.productId] ?? 0) + item.quantity;
    return acc;
  }, {});

  return (
    <main className="min-h-screen bg-brand-accent dark:bg-slate-950">
      <section className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Supplier Procurement"
          title="Consolidated Supplier Orders"
          description="Receive combined orders, view required products, pack per centre, follow delivery schedules and update delivery status."
          actions={<Link href="/dashboard/supplier"><Button variant="secondary">Back to supplier dashboard</Button></Link>}
        />

        <div className="grid gap-4 md:grid-cols-4">
          <KpiCard label="Consolidated Orders" value={String(consolidated.length)} description="Current cycle" icon={PackageCheck} />
          <KpiCard label="Centres Ordered" value={String(orders.length)} description="Centre packs required" icon={PackageCheck} tone="green" />
          <KpiCard label="Order Value" value={formatCurrency(totalValue)} description="ECDLink managed payment" icon={WalletCards} tone="green" />
          <KpiCard label="Deliveries" value="4" description="Scheduled centre drops" icon={Truck} tone="warning" />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="dark:border-slate-800 dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="dark:text-white">Products required</CardTitle>
              <CardDescription className="dark:text-slate-400">Total quantities across all centres.</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={["Product", "Pack size", "Supplier/Brand", "Total Quantity", "Availability"]}
                rows={Object.entries(requiredProducts).slice(0, 12).map(([productId, quantity]) => {
                  const product = getProductFromList(products, productId);
                  return [
                    <span key="product" className="font-bold text-brand-ink dark:text-white">{product.name}</span>,
                    product.packSize,
                    product.supplierBrand,
                    <span key="qty" className="font-bold text-brand-navy dark:text-blue-200">{quantity}</span>,
                    <StatusBadge key="status" status={product.availability} />
                  ];
                })}
              />
            </CardContent>
          </Card>

          <Card className="dark:border-slate-800 dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="dark:text-white">Packing instructions</CardTitle>
              <CardDescription className="dark:text-slate-400">Products must be packed separately for each centre.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {orders.map((order) => (
                <div key={order.id} className="rounded-lg border border-brand-line p-4 dark:border-slate-800">
                  <div className="flex justify-between gap-3">
                    <div>
                      <p className="font-bold text-brand-ink dark:text-white">{order.centreName}</p>
                      <p className="text-sm text-slate-500">{order.items.length} product lines | {order.region}</p>
                    </div>
                    <Badge>{order.orderNumber}</Badge>
                  </div>
                  <Progress value={order.deliveryStatus === "Delivered" ? 100 : order.deliveryStatus === "Packed" ? 60 : 25} className="mt-4" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="dark:border-slate-800 dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="dark:text-white">Delivery schedule</CardTitle>
            <CardDescription className="dark:text-slate-400">Pending, packed, out for delivery, delivered and proof of delivery placeholder.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <DeliveryTracker stages={deliveryStages.map((stage, index) => ({ label: stage, complete: index < 2 }))} />
            <DataTable
              columns={["Centre", "Order", "Delivery Status", "Proof of Delivery", "Notes"]}
              rows={orders.map((order) => [
                order.centreName,
                order.orderNumber,
                <StatusBadge key="status" status={order.deliveryStatus} />,
                "POD upload placeholder",
                order.deliveryNotes
              ])}
            />
            <Button>
              <Download className="h-4 w-4" />
              Download delivery schedule
            </Button>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
