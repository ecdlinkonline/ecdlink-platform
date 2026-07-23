import { prisma } from "@/lib/db/prisma";
import { deliveryCapabilityForDisplay, performanceBand, stockStatusForDisplay, supplierStatusForDisplay, supplierTaxStatusForDisplay } from "@/lib/supplier/format";
import type { SupplierFilters, SupplierInvoice, SupplierOrder, SupplierProduct, SupplierProfile, SupplierQuote, SupplierReport } from "@/lib/supplier/types";

function numberValue(value: unknown) {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") return value.toNumber();
  return Number(value ?? 0);
}

function dateValue(value: Date | string | null | undefined) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

function quoteStatusForDisplay(status: string): SupplierQuote["status"] {
  if (status === "REQUESTED" || status === "UNDER_REVIEW") return "Comparison";
  if (status === "SUBMITTED") return "Submitted";
  if (status === "APPROVED") return "Approved";
  if (status === "REJECTED" || status === "EXPIRED" || status === "WITHDRAWN") return "Rejected";
  return "Draft";
}

function paymentStatusForDisplay(status: string): SupplierInvoice["paymentStatus"] {
  if (status === "Paid") return "Paid";
  if (status === "Overdue" || status === "Disputed") return "Overdue";
  if (status === "Partially Paid") return "Scheduled";
  return "Pending";
}

function mapSupplier(supplier: any): SupplierProfile {
  const performance = supplier.performanceRecords?.[0];
  const productCategories = Array.from(new Set((supplier.products ?? []).map((item: any) => item.product?.category?.name).filter(Boolean)));
  const score = performance?.averagePerformanceScore ?? supplier.performanceScore ?? 72;
  return {
    id: supplier.slug,
    companyName: supplier.companyName,
    registrationNumber: supplier.registrationNumber ?? "Registration pending",
    contactPerson: supplier.contactPerson ?? "Supplier contact",
    phoneNumber: supplier.phone ?? "",
    emailAddress: supplier.email ?? "",
    physicalAddress: supplier.physicalAddress ?? [supplier.suburb, supplier.city, supplier.province].filter(Boolean).join(", "),
    areasServed: supplier.areasServed ?? [],
    productCategories: productCategories as SupplierProfile["productCategories"],
    deliveryCapability: deliveryCapabilityForDisplay(supplier.deliveryCapability) as SupplierProfile["deliveryCapability"],
    bulkPricing: Boolean(supplier.bulkPricingCapability),
    taxComplianceStatus: supplierTaxStatusForDisplay(supplier.taxComplianceStatus) as SupplierProfile["taxComplianceStatus"],
    status: supplierStatusForDisplay(supplier.status) as SupplierProfile["status"],
    performanceScore: score,
    onTimeDeliveryRate: performance?.onTimeDeliveryRate ?? 76,
    fulfilmentRate: performance?.orderFulfilmentRate ?? 78,
    averageQuoteResponseHours: performance?.quotationResponseHours ?? 24
  };
}

function mapSupplierProduct(item: any): SupplierProduct {
  return {
    id: item.id,
    supplierId: item.supplier?.slug ?? item.supplierId,
    productName: item.supplierProductName ?? item.product?.name ?? "Supplier product",
    category: item.product?.category?.name ?? "Maize Meal",
    brand: item.product?.brand ?? item.supplier?.companyName ?? "Supplier brand",
    packSize: item.product?.packSize ?? "Pack",
    unitPrice: numberValue(item.unitPrice),
    stockAvailability: stockStatusForDisplay(item.stockStatus ?? item.availability) as SupplierProduct["stockAvailability"],
    minimumOrderQuantity: item.minimumOrderQuantity ?? 1,
    imagePlaceholder: "Product image placeholder",
    priceUpdatedAt: dateValue(item.lastPriceUpdateAt ?? item.priceUpdatedAt)
  };
}

function mapSupplierOrder(order: any): SupplierOrder {
  return {
    id: order.orderReference,
    supplierId: order.supplier?.slug ?? order.supplierId,
    month: order.cycle ? `${order.cycle.month} ${order.cycle.year}` : "Current cycle",
    status: order.status === "Ready for Dispatch" ? "Packed" : order.status === "Awaiting Confirmation" ? "Pending" : order.status as SupplierOrder["status"],
    deliveryDate: dateValue(order.deliverySchedule ?? order.deliveredAt),
    totalValue: numberValue(order.totalValue),
    items: (order.items ?? []).map((item: any) => ({
      productName: item.productNameSnapshot,
      category: item.product?.category?.name ?? "Catalogue",
      totalQuantity: item.totalQuantity,
      centres: Array.isArray(item.centreAllocations) ? item.centreAllocations : [],
    })),
    deliveryNotes: order.packingNotes ?? "Centre-specific packing instructions are attached.",
    proofOfDeliveryPlaceholder: "Proof of delivery placeholder"
  };
}

function mapSupplierQuote(quote: any): SupplierQuote {
  const firstItem = quote.items?.[0];
  return {
    id: quote.quotationNumber,
    supplierId: quote.supplier?.slug ?? quote.supplierId,
    category: firstItem?.product?.category?.name ?? "Catalogue",
    value: numberValue(quote.totalAmount),
    status: quoteStatusForDisplay(quote.status),
    submittedAt: dateValue(quote.submittedAt ?? quote.createdAt),
    validUntil: dateValue(quote.validUntil),
    responseHours: quote.submittedAt ? Math.max(1, Math.round((new Date(quote.submittedAt).getTime() - new Date(quote.createdAt).getTime()) / 36e5)) : 48
  };
}

function mapSupplierInvoice(invoice: any): SupplierInvoice {
  return {
    id: invoice.invoiceNumber,
    supplierId: invoice.supplier?.slug ?? invoice.supplierId,
    orderId: invoice.supplierOrder?.orderReference ?? invoice.supplierOrderId ?? "Supplier order",
    amount: numberValue(invoice.totalAmount),
    status: invoice.paymentStatus === "Paid" ? "Paid" : invoice.paymentStatus === "Not Paid" ? "Sent" : "Approved",
    paymentStatus: paymentStatusForDisplay(invoice.paymentStatus),
    dueDate: dateValue(invoice.dueDate),
    paymentConfirmationPlaceholder: invoice.paymentStatus === "Paid" ? "Payment confirmation recorded" : "Payment gateway placeholder"
  };
}

export async function listSuppliersFromDb(filters: SupplierFilters = {}) {
  const suppliers = await prisma.supplier.findMany({
    include: {
      products: { include: { product: { include: { category: true } } } },
      performanceRecords: { orderBy: { calculatedAt: "desc" }, take: 1 }
    },
    orderBy: { companyName: "asc" }
  });
  const query = filters.query?.trim().toLowerCase() ?? "";
  return suppliers.map(mapSupplier).filter((supplier) => {
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

export async function getSupplierByIdFromDb(supplierId: string) {
  const supplier = await prisma.supplier.findFirst({
    where: { OR: [{ id: supplierId }, { slug: supplierId }] },
    include: {
      products: { include: { product: { include: { category: true } } } },
      performanceRecords: { orderBy: { calculatedAt: "desc" }, take: 1 }
    }
  });
  return supplier ? mapSupplier(supplier) : null;
}

export async function resolveSupplierDbId(supplierIdOrSlug: string) {
  const supplier = await prisma.supplier.findFirst({ where: { OR: [{ id: supplierIdOrSlug }, { slug: supplierIdOrSlug }] }, select: { id: true } });
  return supplier?.id ?? null;
}

export async function getSupplierProductsFromDb(supplierIdOrSlug: string) {
  const supplierId = supplierIdOrSlug ? await resolveSupplierDbId(supplierIdOrSlug) : null;
  if (supplierIdOrSlug && !supplierId) return [];
  return (await prisma.supplierProduct.findMany({
    where: supplierId ? { supplierId } : undefined,
    include: { supplier: true, product: { include: { category: true } } },
    orderBy: { lastPriceUpdateAt: "desc" }
  })).map(mapSupplierProduct);
}

export async function getSupplierOrdersFromDb(supplierIdOrSlug: string) {
  const supplierId = supplierIdOrSlug ? await resolveSupplierDbId(supplierIdOrSlug) : null;
  if (supplierIdOrSlug && !supplierId) return [];
  return (await prisma.supplierOrder.findMany({
    where: supplierId ? { supplierId } : undefined,
    include: { supplier: true, cycle: true, items: { include: { product: { include: { category: true } } } } },
    orderBy: { updatedAt: "desc" }
  })).map(mapSupplierOrder);
}

export async function getSupplierQuotesFromDb(supplierIdOrSlug: string) {
  const supplierId = supplierIdOrSlug ? await resolveSupplierDbId(supplierIdOrSlug) : null;
  if (supplierIdOrSlug && !supplierId) return [];
  return (await prisma.supplierQuotation.findMany({
    where: supplierId ? { supplierId } : undefined,
    include: { supplier: true, items: { include: { product: { include: { category: true } } } } },
    orderBy: { updatedAt: "desc" }
  })).map(mapSupplierQuote);
}

export async function getSupplierInvoicesFromDb(supplierIdOrSlug: string) {
  const supplierId = supplierIdOrSlug ? await resolveSupplierDbId(supplierIdOrSlug) : null;
  if (supplierIdOrSlug && !supplierId) return [];
  return (await prisma.supplierInvoice.findMany({
    where: supplierId ? { supplierId } : undefined,
    include: { supplier: true, supplierOrder: true },
    orderBy: { invoiceDate: "desc" }
  })).map(mapSupplierInvoice);
}

export async function getSupplierReportFromDb(supplierIdOrSlug?: string): Promise<SupplierReport> {
  const supplierId = supplierIdOrSlug ? await resolveSupplierDbId(supplierIdOrSlug) : null;
  const [suppliers, products, orders, quotes, invoices] = await Promise.all([
    prisma.supplier.findMany({ where: supplierId ? { id: supplierId } : undefined, include: { performanceRecords: { orderBy: { calculatedAt: "desc" }, take: 1 }, products: { include: { product: { include: { category: true } } } } } }),
    prisma.supplierProduct.findMany({ where: supplierId ? { supplierId } : undefined, include: { product: { include: { category: true } } } }),
    prisma.supplierOrder.findMany({ where: supplierId ? { supplierId } : undefined }),
    prisma.supplierQuotation.findMany({ where: supplierId ? { supplierId } : undefined }),
    prisma.supplierInvoice.findMany({ where: supplierId ? { supplierId } : undefined })
  ]);
  const average = (values: number[]) => Math.round(values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1));
  const categoryCounts = products.reduce<Record<string, number>>((acc, product) => {
    const label = product.product?.category?.name ?? "Uncategorised";
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {});
  const performance = suppliers.map((supplier: any) => supplier.performanceRecords?.[0]).filter(Boolean);

  return {
    averagePerformanceScore: average(performance.map((item: any) => item.averagePerformanceScore)),
    onTimeDeliveryRate: average(performance.map((item: any) => item.onTimeDeliveryRate)),
    fulfilmentRate: average(performance.map((item: any) => item.orderFulfilmentRate)),
    averageQuoteResponseHours: average(quotes.map((quote) => quote.submittedAt ? Math.max(1, Math.round((new Date(quote.submittedAt).getTime() - new Date(quote.createdAt).getTime()) / 36e5)) : 48)),
    topSuppliedCategories: Object.entries(categoryCounts).slice(0, 8).map(([label, value]) => ({ label, value })),
    monthlySupplierOrderValue: orders.map((order) => ({ label: order.orderReference.replace("ECDL-SO-", ""), value: numberValue(order.totalValue) }))
  };
}

export async function listSupplierDocumentsFromDb(supplierIdOrSlug: string) {
  const supplierId = await resolveSupplierDbId(supplierIdOrSlug);
  if (!supplierId) return [];
  return prisma.supplierDocument.findMany({ where: { supplierId }, include: { file: true }, orderBy: { createdAt: "desc" } });
}

export async function listSupplierPerformanceRecordsFromDb(supplierIdOrSlug?: string) {
  const supplierId = supplierIdOrSlug ? await resolveSupplierDbId(supplierIdOrSlug) : null;
  return prisma.supplierPerformance.findMany({ where: supplierId ? { supplierId } : undefined, include: { supplier: true }, orderBy: { calculatedAt: "desc" } });
}

export { performanceBand };
