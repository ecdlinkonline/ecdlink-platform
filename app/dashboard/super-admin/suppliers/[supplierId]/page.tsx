import { notFound } from "next/navigation";
import { RoleDashboardShell } from "@/components/app-shell/role-dashboard-shell";
import { SupplierPortal } from "@/components/supplier/supplier-portal";
import { getSupplierById, getSupplierInvoices, getSupplierOrders, getSupplierProducts, getSupplierQuotes, getSupplierReport } from "@/lib/supplier/api";

export default async function AdminSupplierProfilePage({ params }: { params: Promise<{ supplierId: string }> }) {
  const { supplierId } = await params;
  const supplier = await getSupplierById(supplierId);
  if (!supplier) notFound();
  const [products, orders, quotes, invoices, report] = await Promise.all([
    getSupplierProducts(supplier.id),
    getSupplierOrders(supplier.id),
    getSupplierQuotes(supplier.id),
    getSupplierInvoices(supplier.id),
    getSupplierReport(supplier.id)
  ]);

  return (
    <RoleDashboardShell role="super_admin">
      <SupplierPortal supplier={supplier} products={products} orders={orders} quotes={quotes} invoices={invoices} report={report} mode="admin" />
    </RoleDashboardShell>
  );
}
