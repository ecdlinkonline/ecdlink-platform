"use client";

import { useMemo, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { DataTable, StatusBadge, useToast } from "@/components/design-system";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { calculateCart, formatCurrency, getProductFromList } from "@/lib/procurement/catalog";
import type { CentreOrder, OrderStatus, ProcurementProduct } from "@/lib/procurement/types";

const orderStatuses: Array<OrderStatus | "All"> = ["All", "Submitted", "Awaiting Approval", "Approved", "Rejected", "Packed", "Out for Delivery", "Delivered", "Cancelled"];

function supplierNames(order: CentreOrder, products: ProcurementProduct[]) {
  return Array.from(new Set(order.items.map((item) => getProductFromList(products, item.productId).supplierBrand))).join(", ");
}

export function AdminOrdersTable({ orders, products }: { orders: CentreOrder[]; products: ProcurementProduct[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<OrderStatus | "All">("All");
  const [region, setRegion] = useState("All");
  const [month, setMonth] = useState("All");
  const regions = useMemo(() => ["All", ...Array.from(new Set(orders.map((order) => order.region)))], [orders]);
  const months = useMemo(() => ["All", ...Array.from(new Set(orders.map((order) => order.month)))], [orders]);
  const { pushToast } = useToast();

  async function reviewOrder(orderId: string, decision: "approve" | "reject") {
    const response = await fetch(`/api/procurement/orders/${orderId}/${decision}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notes: `${decision} from procurement console.` }) });
    const body = await response.json().catch(() => null);
    pushToast({
      title: response.ok ? `Order ${decision === "approve" ? "approved" : "rejected"}` : "Order review failed",
      description: response.ok ? "Refresh to view the latest status." : body?.error ?? "Please try again."
    });
  }

  const filteredOrders = useMemo(() => {
    const search = query.trim().toLowerCase();
    return orders.filter((order) => {
      const searchable = [
        order.centreName,
        order.orderNumber,
        order.region,
        order.month,
        order.status,
        supplierNames(order, products)
      ].join(" ").toLowerCase();

      return (
        (!search || searchable.includes(search)) &&
        (status === "All" || order.status === status) &&
        (region === "All" || order.region === region) &&
        (month === "All" || order.month === month)
      );
    });
  }, [month, orders, products, query, region, status]);

  return (
    <Card className="dark:border-slate-800 dark:bg-slate-900">
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <CardTitle className="dark:text-white">All centre orders</CardTitle>
            <CardDescription className="dark:text-slate-400">Search by centre, supplier, region, status and month.</CardDescription>
          </div>
          <Badge variant="muted">{filteredOrders.length} orders shown</Badge>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_190px_180px_160px]">
          <label className="flex min-h-11 items-center gap-2 rounded-lg border border-brand-line bg-white px-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search orders, centres or suppliers"
              className="w-full bg-transparent outline-none"
            />
          </label>
          <select value={status} onChange={(event) => setStatus(event.target.value as OrderStatus | "All")} className="rounded-lg border border-brand-line bg-white px-3 text-sm font-semibold text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
            {orderStatuses.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select value={region} onChange={(event) => setRegion(event.target.value)} className="rounded-lg border border-brand-line bg-white px-3 text-sm font-semibold text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
            {regions.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select value={month} onChange={(event) => setMonth(event.target.value)} className="rounded-lg border border-brand-line bg-white px-3 text-sm font-semibold text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
            {months.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={["Order", "Centre", "Supplier", "Region", "Month", "Total", "Status", "Delivery", "Invoice", "Actions"]}
          rows={filteredOrders.map((order) => {
            const total = order.currentSpend ?? calculateCart(order.items, products).total;
            return [
              <span key="order" className="font-bold text-brand-ink dark:text-white">{order.orderNumber}</span>,
              order.centreName,
              supplierNames(order, products),
              order.region,
              order.month,
              <span key="total" className="font-bold text-brand-navy dark:text-blue-200">{formatCurrency(total)}</span>,
              <StatusBadge key="status" status={order.status} />,
              <StatusBadge key="delivery" status={order.deliveryStatus} />,
              order.invoiceNumber,
              <div key="actions" className="flex gap-2">
                <button onClick={() => reviewOrder(order.id, "approve")} className="grid h-9 w-9 place-items-center rounded-lg bg-green-50 text-brand-green"><Check className="h-4 w-4" /></button>
                <button onClick={() => reviewOrder(order.id, "reject")} className="grid h-9 w-9 place-items-center rounded-lg bg-red-50 text-red-700"><X className="h-4 w-4" /></button>
              </div>
            ];
          })}
        />
      </CardContent>
    </Card>
  );
}
