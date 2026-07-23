import { SupplierPortal, type SupplierTab } from "@/components/supplier/supplier-portal";
import type { SupplierInvoice, SupplierOrder, SupplierProduct, SupplierProfile, SupplierQuote, SupplierReport } from "@/lib/supplier/types";

export function SupplierTabPage({
  initialTab,
  supplier,
  products,
  orders,
  quotes,
  invoices,
  report
}: {
  initialTab: SupplierTab;
  supplier: SupplierProfile;
  products: SupplierProduct[];
  orders: SupplierOrder[];
  quotes: SupplierQuote[];
  invoices: SupplierInvoice[];
  report: SupplierReport;
}) {
  return <SupplierPortal supplier={supplier} products={products} orders={orders} quotes={quotes} invoices={invoices} report={report} initialTab={initialTab} />;
}
