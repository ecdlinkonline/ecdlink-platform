import { RoleDashboardShell } from "@/components/app-shell/role-dashboard-shell";
import { SupplierDashboard } from "@/components/supplier/supplier-dashboard";
import { getCurrentSupplier, getSupplierInvoices, getSupplierOrders, getSupplierProducts, getSupplierQuotes, getSupplierReport } from "@/lib/supplier/api";

export default async function SupplierDashboardPage() {
  const supplier = await getCurrentSupplier();
  if (!supplier) return null;
  const [products, orders, quotes, invoices, report] = await Promise.all([
    getSupplierProducts(supplier.id),
    getSupplierOrders(supplier.id),
    getSupplierQuotes(supplier.id),
    getSupplierInvoices(supplier.id),
    getSupplierReport(supplier.id)
  ]);

  return (
    <RoleDashboardShell role="supplier">
      <SupplierDashboard supplier={supplier} products={products} orders={orders} quotes={quotes} invoices={invoices} report={report} />
    </RoleDashboardShell>
  );
}
