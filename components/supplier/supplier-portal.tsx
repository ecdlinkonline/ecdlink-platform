"use client";

import { useState } from "react";
import Link from "next/link";
import { ClipboardList, FileText, PackageCheck, ReceiptText, Send, WalletCards } from "lucide-react";
import { BarChart } from "@/components/charts/bar-chart";
import { DataTable, DeliveryTracker, KpiCard, PageHeader, ProductCard, StatusBadge, useToast } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { deliveryStages } from "@/lib/procurement/catalog";
import { formatSupplierCurrency } from "@/lib/supplier/format";
import type { SupplierInvoice, SupplierOrder, SupplierProduct, SupplierProfile, SupplierQuote, SupplierReport } from "@/lib/supplier/types";

const tabs = ["Dashboard", "Profile", "Products", "Orders", "Quotations", "Invoices", "Payments", "Deliveries", "Reports"] as const;
export type SupplierTab = (typeof tabs)[number];

export function SupplierPortal({
  supplier,
  products,
  orders,
  quotes,
  invoices,
  report,
  mode = "supplier",
  initialTab = "Dashboard"
}: {
  supplier: SupplierProfile;
  products: SupplierProduct[];
  orders: SupplierOrder[];
  quotes: SupplierQuote[];
  invoices: SupplierInvoice[];
  report: SupplierReport;
  mode?: "supplier" | "admin";
  initialTab?: SupplierTab;
}) {
  const [activeTab, setActiveTab] = useState<SupplierTab>(initialTab);
  const { pushToast } = useToast();
  const orderValue = orders.reduce((sum, order) => sum + order.totalValue, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={mode === "admin" ? "Supplier Profile" : "Supplier Portal"}
        title={supplier.companyName}
        description={`${supplier.registrationNumber} | ${supplier.contactPerson} | ${supplier.areasServed.join(", ")}`}
        actions={mode === "admin" ? <Link href="/dashboard/super-admin/suppliers"><Button variant="secondary">Back to suppliers</Button></Link> : undefined}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Products" value={String(products.length)} description="Catalogue items" icon={PackageCheck} />
        <KpiCard label="Orders" value={String(orders.length)} description={formatSupplierCurrency(orderValue)} icon={ClipboardList} tone="green" />
        <KpiCard label="Quotes" value={String(quotes.length)} description="Quotation pipeline" icon={FileText} />
        <KpiCard label="Invoices" value={String(invoices.length)} description="Payment placeholders" icon={ReceiptText} tone="warning" />
        <KpiCard label="Performance" value={`${supplier.performanceScore}%`} description="Supplier score" icon={WalletCards} tone={supplier.performanceScore >= 80 ? "green" : "warning"} />
      </div>

      <div className="flex gap-2 overflow-x-auto rounded-lg border border-brand-line bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
        {tabs.map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-bold ${activeTab === tab ? "bg-brand-navy text-white" : "text-slate-600 hover:bg-brand-accent dark:text-slate-300"}`}>{tab}</button>
        ))}
      </div>

      {activeTab === "Dashboard" ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
          <Card className="dark:border-slate-800 dark:bg-slate-900">
            <CardHeader><CardTitle className="dark:text-white">Consolidated orders</CardTitle><CardDescription className="dark:text-slate-400">ECDLink monthly order value and fulfilment status.</CardDescription></CardHeader>
            <CardContent><BarChart data={report.monthlySupplierOrderValue} /></CardContent>
          </Card>
          <Card className="dark:border-slate-800 dark:bg-slate-900">
            <CardHeader><CardTitle className="dark:text-white">Supplier performance</CardTitle><CardDescription className="dark:text-slate-400">Delivery, fulfilment and quote response measures.</CardDescription></CardHeader>
            <CardContent>
              <DataTable columns={["Metric", "Value"]} rows={[
                ["Performance score", `${report.averagePerformanceScore}%`],
                ["On-time delivery rate", `${report.onTimeDeliveryRate}%`],
                ["Order fulfilment rate", `${report.fulfilmentRate}%`],
                ["Average quotation response", `${report.averageQuoteResponseHours} hours`]
              ]} />
            </CardContent>
          </Card>
        </div>
      ) : null}

      {activeTab === "Profile" ? (
        <Card className="dark:border-slate-800 dark:bg-slate-900">
          <CardHeader><CardTitle className="dark:text-white">Supplier profile</CardTitle><CardDescription className="dark:text-slate-400">Company, service and compliance details.</CardDescription></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {[
              ["Company name", supplier.companyName],
              ["Registration number", supplier.registrationNumber],
              ["Contact person", supplier.contactPerson],
              ["Phone", supplier.phoneNumber],
              ["Email", supplier.emailAddress],
              ["Address", supplier.physicalAddress],
              ["Areas served", supplier.areasServed.join(", ")],
              ["Delivery capability", supplier.deliveryCapability],
              ["Bulk pricing", supplier.bulkPricing ? "Available" : "Not available"],
              ["Tax compliance", supplier.taxComplianceStatus],
              ["Supplier status", supplier.status],
              ["Categories", supplier.productCategories.join(", ")]
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-brand-line p-4 dark:border-slate-800">
                <p className="text-sm font-semibold text-slate-500">{label}</p>
                <p className="mt-1 font-bold text-brand-ink dark:text-white">{value}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "Products" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product.id} title={product.productName} meta={`${product.category} | ${product.brand} | ${product.packSize}`} price={formatSupplierCurrency(product.unitPrice)} status={product.stockAvailability}>
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Minimum order</span><span className="font-bold">{product.minimumOrderQuantity}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Updated</span><span className="font-bold">{product.priceUpdatedAt}</span></div>
                <div className="rounded-lg bg-brand-accent p-3 text-slate-600 dark:bg-slate-950">{product.imagePlaceholder}</div>
              </div>
            </ProductCard>
          ))}
        </div>
      ) : null}

      {activeTab === "Orders" ? (
        <Card className="dark:border-slate-800 dark:bg-slate-900">
          <CardHeader><CardTitle className="dark:text-white">Consolidated procurement orders</CardTitle><CardDescription className="dark:text-slate-400">Total quantities, centre breakdown and packing instructions.</CardDescription></CardHeader>
          <CardContent>
            <DataTable columns={["Order", "Month", "Value", "Status", "Delivery", "Items"]} rows={orders.map((order) => [order.id, order.month, formatSupplierCurrency(order.totalValue), <StatusBadge key="status" status={order.status} />, order.deliveryDate, `${order.items.length} products`])} />
            <div className="mt-6 space-y-3">
              {orders.flatMap((order) => order.items.slice(0, 3).map((item) => (
                <div key={`${order.id}-${item.productName}`} className="rounded-lg border border-brand-line p-4 dark:border-slate-800">
                  <div className="flex justify-between gap-3"><p className="font-bold text-brand-ink dark:text-white">{item.productName}</p><span className="font-bold text-brand-navy dark:text-blue-200">{item.totalQuantity} units</span></div>
                  <p className="mt-2 text-sm text-slate-500">{item.centres.map((centre) => `${centre.centreName}: ${centre.quantity}`).join(" | ")}</p>
                </div>
              )))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "Quotations" ? (
        <Card className="dark:border-slate-800 dark:bg-slate-900">
          <CardHeader><CardTitle className="dark:text-white">Quotations</CardTitle><CardDescription className="dark:text-slate-400">Supplier quotation, admin comparison and approved quote placeholders.</CardDescription></CardHeader>
          <CardContent>
            <DataTable columns={["Quote", "Category", "Value", "Status", "Valid Until", "Response"]} rows={quotes.map((quote) => [quote.id, quote.category, formatSupplierCurrency(quote.value), <StatusBadge key="status" status={quote.status} />, quote.validUntil, `${quote.responseHours} hours`])} />
            <Button className="mt-5" onClick={() => pushToast({ title: "Quotation placeholder", description: "Supplier quotation workflow is ready for future persistence." })}><Send className="h-4 w-4" /> Submit quotation placeholder</Button>
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "Invoices" ? (
        <Card className="dark:border-slate-800 dark:bg-slate-900">
          <CardHeader><CardTitle className="dark:text-white">Invoices and payments</CardTitle><CardDescription className="dark:text-slate-400">Invoice, payment status and confirmation placeholders.</CardDescription></CardHeader>
          <CardContent><DataTable columns={["Invoice", "Order", "Amount", "Invoice Status", "Payment", "Due", "Confirmation"]} rows={invoices.map((invoice) => [invoice.id, invoice.orderId, formatSupplierCurrency(invoice.amount), <StatusBadge key="status" status={invoice.status} />, <StatusBadge key="payment" status={invoice.paymentStatus} />, invoice.dueDate, invoice.paymentConfirmationPlaceholder])} /></CardContent>
        </Card>
      ) : null}

      {activeTab === "Payments" ? (
        <Card className="dark:border-slate-800 dark:bg-slate-900">
          <CardHeader><CardTitle className="dark:text-white">Payments</CardTitle><CardDescription className="dark:text-slate-400">Payment due dates, statuses and confirmation placeholders.</CardDescription></CardHeader>
          <CardContent>
            <DataTable
              columns={["Order", "Amount", "Payment Status", "Due Date", "Confirmation"]}
              rows={invoices.map((invoice) => [
                invoice.orderId,
                formatSupplierCurrency(invoice.amount),
                <StatusBadge key="payment" status={invoice.paymentStatus} />,
                invoice.dueDate,
                invoice.paymentConfirmationPlaceholder
              ])}
            />
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "Deliveries" ? (
        <Card className="dark:border-slate-800 dark:bg-slate-900">
          <CardHeader><CardTitle className="dark:text-white">Delivery tracker</CardTitle><CardDescription className="dark:text-slate-400">Pending, packed, out for delivery, delivered and POD placeholders.</CardDescription></CardHeader>
          <CardContent className="space-y-5">
            <DeliveryTracker stages={deliveryStages.map((stage, index) => ({ label: stage, complete: index < 2 }))} />
            <DataTable columns={["Order", "Status", "Delivery Date", "POD", "Notes"]} rows={orders.map((order) => [order.id, <StatusBadge key="status" status={order.status} />, order.deliveryDate, order.proofOfDeliveryPlaceholder, order.deliveryNotes])} />
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "Reports" ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="dark:border-slate-800 dark:bg-slate-900">
            <CardHeader><CardTitle className="dark:text-white">Top supplied categories</CardTitle><CardDescription className="dark:text-slate-400">Catalogue depth by ECDLink procurement category.</CardDescription></CardHeader>
            <CardContent><BarChart data={report.topSuppliedCategories} /></CardContent>
          </Card>
          <Card className="dark:border-slate-800 dark:bg-slate-900">
            <CardHeader><CardTitle className="dark:text-white">Monthly supplier order value</CardTitle><CardDescription className="dark:text-slate-400">Consolidated order value by cycle.</CardDescription></CardHeader>
            <CardContent><BarChart data={report.monthlySupplierOrderValue} /></CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
