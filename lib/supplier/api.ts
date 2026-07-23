import { supplierInvoices, supplierOrders, supplierProducts, supplierProfiles, supplierQuotes } from "@/lib/supplier/data";
import { getAuthContext } from "@/lib/auth/session";
import { hasDatabaseConfig } from "@/lib/db/env";
import { getSupplierByIdFromDb, getSupplierInvoicesFromDb, getSupplierOrdersFromDb, getSupplierProductsFromDb, getSupplierQuotesFromDb, getSupplierReportFromDb, listSuppliersFromDb } from "@/lib/repositories/suppliers";
import { getInternalUserByClerkId } from "@/lib/repositories/users";
import type { SupplierFilters, SupplierReport } from "@/lib/supplier/types";

export async function listSuppliers(filters: SupplierFilters = {}) {
  if (hasDatabaseConfig()) return listSuppliersFromDb(filters);

  const query = filters.query?.trim().toLowerCase() ?? "";
  return supplierProfiles.filter((supplier) => {
    const searchable = [supplier.companyName, supplier.registrationNumber, supplier.contactPerson, supplier.emailAddress, supplier.areasServed.join(" "), supplier.productCategories.join(" ")].join(" ").toLowerCase();
    return (
      (!query || searchable.includes(query)) &&
      (!filters.category || filters.category === "All" || supplier.productCategories.includes(filters.category)) &&
      (!filters.area || filters.area === "All" || supplier.areasServed.includes(filters.area)) &&
      (!filters.status || filters.status === "All" || supplier.status === filters.status) &&
      (!filters.compliance || filters.compliance === "All" || supplier.taxComplianceStatus === filters.compliance)
    );
  });
}

export async function getSupplierById(supplierId: string) {
  if (hasDatabaseConfig()) return getSupplierByIdFromDb(supplierId);

  return supplierProfiles.find((supplier) => supplier.id === supplierId) ?? null;
}

export async function getCurrentSupplier() {
  if (hasDatabaseConfig()) {
    const authContext = await getAuthContext();
    if (!authContext) return null;
    const user = await getInternalUserByClerkId(authContext.userId);
    const supplierId = user?.supplierUsers[0]?.supplierId;
    return supplierId ? getSupplierByIdFromDb(supplierId) : null;
  }

  return getSupplierById("freshstart-foods");
}

export async function getSupplierProducts(supplierId: string) {
  if (hasDatabaseConfig()) return getSupplierProductsFromDb(supplierId);

  return supplierProducts.filter((product) => product.supplierId === supplierId);
}

export async function getSupplierOrders(supplierId: string) {
  if (hasDatabaseConfig()) return getSupplierOrdersFromDb(supplierId);

  return supplierOrders.filter((order) => order.supplierId === supplierId);
}

export async function getSupplierQuotes(supplierId: string) {
  if (hasDatabaseConfig()) return getSupplierQuotesFromDb(supplierId);

  return supplierQuotes.filter((quote) => quote.supplierId === supplierId);
}

export async function getSupplierInvoices(supplierId: string) {
  if (hasDatabaseConfig()) return getSupplierInvoicesFromDb(supplierId);

  return supplierInvoices.filter((invoice) => invoice.supplierId === supplierId);
}

export async function getSupplierReport(supplierId?: string): Promise<SupplierReport> {
  if (hasDatabaseConfig()) return getSupplierReportFromDb(supplierId);

  const suppliers = supplierId ? supplierProfiles.filter((supplier) => supplier.id === supplierId) : supplierProfiles;
  const orders = supplierId ? supplierOrders.filter((order) => order.supplierId === supplierId) : supplierOrders;
  const products = supplierId ? supplierProducts.filter((product) => product.supplierId === supplierId) : supplierProducts;
  const quotes = supplierId ? supplierQuotes.filter((quote) => quote.supplierId === supplierId) : supplierQuotes;
  const average = (values: number[]) => Math.round(values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1));
  const categoryCounts = products.reduce<Record<string, number>>((acc, product) => {
    acc[product.category] = (acc[product.category] ?? 0) + 1;
    return acc;
  }, {});

  return {
    averagePerformanceScore: average(suppliers.map((supplier) => supplier.performanceScore)),
    onTimeDeliveryRate: average(suppliers.map((supplier) => supplier.onTimeDeliveryRate)),
    fulfilmentRate: average(suppliers.map((supplier) => supplier.fulfilmentRate)),
    averageQuoteResponseHours: average(quotes.map((quote) => quote.responseHours)),
    topSuppliedCategories: Object.entries(categoryCounts).slice(0, 8).map(([label, value]) => ({ label, value })),
    monthlySupplierOrderValue: orders.map((order) => ({ label: order.id.replace("SUP-ORD-", ""), value: order.totalValue }))
  };
}
