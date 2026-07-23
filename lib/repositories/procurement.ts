import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { budgetSnapshot } from "@/lib/procurement/catalog";
import type { CentreOrder, ConsolidatedSupplierOrder, ProcurementProduct } from "@/lib/procurement/types";

const orderInclude = {
  centre: true,
  cycle: true,
  items: { include: { product: { include: { category: true, supplierProducts: { include: { supplier: true } } } } } },
  deliveries: true,
  invoices: true
};

type OrderWithRelations = Prisma.ProcurementOrderGetPayload<{ include: typeof orderInclude }>;
type ProductWithRelations = Prisma.ProductGetPayload<{ include: { category: true; supplierProducts: { include: { supplier: true } } } }>;

const orderStatusFromDb: Record<string, CentreOrder["status"]> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  AWAITING_APPROVAL: "Awaiting Approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PACKED: "Packed",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled"
};

const orderStatusToDb: Record<string, "DRAFT" | "SUBMITTED" | "AWAITING_APPROVAL" | "APPROVED" | "REJECTED" | "PACKED" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED"> = {
  Draft: "DRAFT",
  Submitted: "SUBMITTED",
  "Awaiting Approval": "AWAITING_APPROVAL",
  Approved: "APPROVED",
  Rejected: "REJECTED",
  Packed: "PACKED",
  "Out for Delivery": "OUT_FOR_DELIVERY",
  Delivered: "DELIVERED",
  Cancelled: "CANCELLED"
};

const deliveryStatusFromDb: Record<string, CentreOrder["deliveryStatus"]> = {
  PENDING: "Pending",
  PACKED: "Packed",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  FAILED: "Cancelled"
};

const availabilityFromDb: Record<string, ProcurementProduct["availability"]> = {
  AVAILABLE: "Available",
  LOW_STOCK: "Low Stock",
  OUT_OF_STOCK: "Out of Stock",
  DISCONTINUED: "Out of Stock"
};

function money(value: { toNumber?: () => number } | number | string | null | undefined) {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return value.toNumber?.() ?? 0;
}

function monthLabel(order: OrderWithRelations) {
  return `${order.cycle.month} ${order.cycle.year}`;
}

export function mapProduct(product: ProductWithRelations): ProcurementProduct {
  const primarySupplier = product.supplierProducts[0];
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    category: product.category.name as ProcurementProduct["category"],
    brand: product.brand ?? undefined,
    description: product.description ?? undefined,
    price: money(primarySupplier?.unitPrice ?? product.currentPrice),
    packSize: product.packSize ?? "Unit",
    unit: product.unit ?? undefined,
    vatApplicable: product.vatApplicable,
    supplierBrand: primarySupplier?.supplier.companyName ?? product.brand ?? "ECDLink Supplier",
    supplierId: primarySupplier?.supplierId,
    supplierProductCode: primarySupplier?.supplierProductCode ?? undefined,
    barcode: primarySupplier?.barcodePlaceholder ?? undefined,
    minimumOrderQuantity: primarySupplier?.minimumOrderQuantity ?? undefined,
    maximumOrderQuantity: primarySupplier?.maximumOrderQuantity ?? undefined,
    active: product.active,
    availability: availabilityFromDb[product.stockStatus] ?? "Available"
  };
}

export function mapOrder(order: OrderWithRelations): CentreOrder {
  const delivery = order.deliveries[0];
  const invoice = order.invoices[0];
  const budget = money(order.selectedBudget);
  const spend = money(order.total);
  const snapshot = budgetSnapshot(budget, spend);
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    centreId: order.centre.slug,
    centreName: order.centre.centreName,
    region: order.centre.region ?? "Unassigned",
    month: monthLabel(order),
    budget,
    ...snapshot,
    status: orderStatusFromDb[order.status] ?? "Submitted",
    items: order.items.map((item) => ({ productId: item.productId ?? item.id, quantity: item.quantity })),
    submittedAt: order.submittedAt.toISOString(),
    invoiceNumber: invoice?.invoiceNo ?? `INV-${order.orderNumber}`,
    deliveryStatus: deliveryStatusFromDb[delivery?.status ?? "PENDING"] ?? "Pending",
    deliveryNotes: delivery?.notes ?? delivery?.deliveryNote ?? "Delivery pending."
  };
}

export async function listProductCategoriesFromDb() {
  const categories = await prisma.productCategory.findMany({ orderBy: { name: "asc" } });
  return categories.map((category) => category.name);
}

export async function listProductsFromDb(category?: string) {
  const products = await prisma.product.findMany({
    where: { active: true, category: category && category !== "All" ? { name: category } : undefined },
    include: { category: true, supplierProducts: { include: { supplier: true }, orderBy: { priceUpdatedAt: "desc" } } },
    orderBy: [{ category: { name: "asc" } }, { name: "asc" }]
  });
  return products.map(mapProduct);
}

export async function getOpenProcurementCycle() {
  return prisma.procurementCycle.findFirst({ where: { status: "OPEN" }, orderBy: { opensAt: "desc" } });
}

export async function listCentreOrdersFromDb(filters: { status?: string; query?: string; region?: string; month?: string; supplier?: string } = {}) {
  const query = filters.query?.trim();
  const status = filters.status && filters.status !== "All" ? orderStatusToDb[filters.status] : undefined;
  const orders = await prisma.procurementOrder.findMany({
    where: {
      status,
      centre: {
        region: filters.region && filters.region !== "All" ? filters.region : undefined
      },
      OR: query ? [
        { orderNumber: { contains: query, mode: "insensitive" } },
        { centre: { centreName: { contains: query, mode: "insensitive" } } },
        { centre: { region: { contains: query, mode: "insensitive" } } },
        { items: { some: { supplierNameSnapshot: { contains: query, mode: "insensitive" } } } }
      ] : undefined
    },
    include: orderInclude,
    orderBy: { submittedAt: "desc" }
  });

  return orders.map(mapOrder).filter((order) =>
    (!filters.month || filters.month === "All" || order.month === filters.month) &&
    (!filters.supplier || filters.supplier === "All" || order.items.some((item) => {
      const source = orders.find((dbOrder) => dbOrder.id === order.id);
      return source?.items.some((dbItem) => dbItem.productId === item.productId && dbItem.supplierNameSnapshot?.toLowerCase().includes(filters.supplier!.toLowerCase()));
    }))
  );
}

export async function listOrdersForCentreFromDb(centreId: string) {
  const orders = await prisma.procurementOrder.findMany({
    where: { centreId },
    include: orderInclude,
    orderBy: { submittedAt: "desc" }
  });
  return orders.map(mapOrder);
}

export async function listOrdersForSupplierFromDb(supplierId: string) {
  const orders = await prisma.procurementOrder.findMany({
    where: { items: { some: { product: { supplierProducts: { some: { supplierId } } } } } },
    include: orderInclude,
    orderBy: { submittedAt: "desc" }
  });
  return orders.map(mapOrder);
}

export async function listConsolidatedSupplierOrdersFromDb(): Promise<ConsolidatedSupplierOrder[]> {
  const orders = await prisma.procurementOrder.findMany({
    where: { status: { in: ["APPROVED", "PACKED", "OUT_FOR_DELIVERY", "DELIVERED"] } },
    include: orderInclude
  });
  const supplierMap = new Map<string, ConsolidatedSupplierOrder>();

  for (const order of orders) {
    for (const item of order.items) {
      const supplier = item.supplierNameSnapshot ?? item.product?.supplierProducts[0]?.supplier.companyName ?? "Unassigned Supplier";
      const id = supplier.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const existing = supplierMap.get(id) ?? { id: `supplier-order-${id}`, supplier, month: monthLabel(order), status: "Confirmed", centreOrderIds: [] };
      if (!existing.centreOrderIds.includes(order.id)) existing.centreOrderIds.push(order.id);
      supplierMap.set(id, existing);
    }
  }

  return Array.from(supplierMap.values());
}

export async function getProcurementReportsFromDb() {
  const orders = await prisma.procurementOrder.findMany({ include: orderInclude });
  const mapped = orders.map(mapOrder);
  const monthlyValue = mapped.reduce((sum, order) => sum + (order.currentSpend ?? money(order.budget)), 0);
  const productTotals = new Map<string, number>();
  const categoryTotals = new Map<string, number>();
  const supplierTotals = new Map<string, number>();
  const deliveryTotals = new Map<string, number>();

  for (const order of orders) {
    deliveryTotals.set(order.deliveries[0]?.status ?? "PENDING", (deliveryTotals.get(order.deliveries[0]?.status ?? "PENDING") ?? 0) + 1);
    for (const item of order.items) {
      productTotals.set(item.productNameSnapshot, (productTotals.get(item.productNameSnapshot) ?? 0) + item.quantity);
      categoryTotals.set(item.product?.category.name ?? "Unassigned", (categoryTotals.get(item.product?.category.name ?? "Unassigned") ?? 0) + item.quantity);
      supplierTotals.set(item.supplierNameSnapshot ?? "Unassigned", (supplierTotals.get(item.supplierNameSnapshot ?? "Unassigned") ?? 0) + money(item.lineTotal));
    }
  }

  const chart = (map: Map<string, number>) => Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, value]) => ({ label, value: Math.round(value) }));

  return {
    monthlyValue,
    topProducts: chart(productTotals),
    topCategories: chart(categoryTotals),
    topCentres: mapped.slice(0, 8).map((order) => ({ label: order.centreName, value: order.currentSpend ?? 0 })),
    centreSpending: mapped.map((order) => ({ label: order.centreName, value: order.currentSpend ?? 0 })),
    supplierPerformance: chart(supplierTotals).map((item) => ({ label: item.label, value: Math.min(100, Math.max(60, Math.round(item.value / 100))) })),
    deliveryPerformance: chart(deliveryTotals),
    supplierSpend: chart(supplierTotals),
    averageBasketSize: mapped.length ? Math.round(monthlyValue / mapped.length) : 0,
    budgetUtilisation: mapped.map((order) => ({ label: order.centreName, value: order.percentageUsed ?? 0 }))
  };
}
