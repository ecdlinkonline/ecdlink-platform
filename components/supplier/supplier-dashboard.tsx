import { SupplierPortal } from "@/components/supplier/supplier-portal";
import type { SupplierInvoice, SupplierOrder, SupplierProduct, SupplierProfile, SupplierQuote, SupplierReport } from "@/lib/supplier/types";

export function SupplierDashboard({
  supplier,
  products,
  orders,
  quotes,
  invoices,
  report
}: {
  supplier: SupplierProfile;
  products: SupplierProduct[];
  orders: SupplierOrder[];
  quotes: SupplierQuote[];
  invoices: SupplierInvoice[];
  report: SupplierReport;
}) {
  return <SupplierPortal supplier={supplier} products={products} orders={orders} quotes={quotes} invoices={invoices} report={report} />;
}
