import { prisma } from "@/lib/db/prisma";
import { getOpenProcurementCycle, mapOrder } from "@/lib/repositories/procurement";
import type { CreateProcurementOrderInput, OpenProcurementCycleInput } from "@/lib/validators/procurement";

export class ProcurementServiceError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

function money(value: { toNumber?: () => number } | number | string | null | undefined) {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return value.toNumber?.() ?? 0;
}

function orderNumber(year: number, month: string, count: number) {
  const monthCode = month.slice(0, 3).toUpperCase();
  return `ECD-${year}-${monthCode}-${String(count + 1).padStart(4, "0")}`;
}

export async function openProcurementCycle(input: OpenProcurementCycleInput, actorUserId?: string) {
  const existing = await prisma.procurementCycle.findFirst({ where: { status: "OPEN" } });
  if (existing) throw new ProcurementServiceError("Only one procurement cycle may be open at a time.", 409);

  const cycle = await prisma.procurementCycle.create({
    data: {
      month: input.month,
      year: input.year,
      opensAt: new Date(input.opensAt),
      closesAt: new Date(input.closesAt),
      deliveryWindowStart: input.deliveryWindowStart ? new Date(input.deliveryWindowStart) : undefined,
      deliveryWindowEnd: input.deliveryWindowEnd ? new Date(input.deliveryWindowEnd) : undefined,
      status: "OPEN"
    }
  });

  await prisma.auditLog.create({ data: { actorUserId, action: "procurement.cycle.open", entityType: "ProcurementCycle", entityId: cycle.id, after: cycle } });
  return cycle;
}

export async function closeProcurementCycle(cycleId: string, actorUserId?: string) {
  const cycle = await prisma.procurementCycle.update({ where: { id: cycleId }, data: { status: "CLOSED" } });
  await prisma.auditLog.create({ data: { actorUserId, action: "procurement.cycle.close", entityType: "ProcurementCycle", entityId: cycle.id, after: cycle } });
  return cycle;
}

export async function createCentreProcurementOrder(centreId: string, input: CreateProcurementOrderInput, actorUserId?: string) {
  const cycle = await getOpenProcurementCycle();
  if (!cycle) throw new ProcurementServiceError("There is no open procurement cycle.", 409);

  const existing = await prisma.procurementOrder.findUnique({ where: { centreId_cycleId: { centreId, cycleId: cycle.id } } });
  if (existing) throw new ProcurementServiceError("This centre already has an order for the current procurement cycle.", 409);

  const products = await prisma.product.findMany({
    where: { id: { in: input.items.map((item) => item.productId) }, active: true },
    include: { category: true, supplierProducts: { include: { supplier: true }, orderBy: { priceUpdatedAt: "desc" } } }
  });

  if (products.length !== input.items.length) throw new ProcurementServiceError("One or more products are unavailable.", 422);

  const productMap = new Map(products.map((product) => [product.id, product]));
  const subtotal = input.items.reduce((sum, item) => {
    const product = productMap.get(item.productId);
    return sum + money(product?.supplierProducts[0]?.unitPrice ?? product?.currentPrice) * item.quantity;
  }, 0);
  const serviceFee = Math.round(subtotal * 0.035);
  const total = subtotal + serviceFee;
  if (total > input.budget && !input.overrideBudget) throw new ProcurementServiceError("Order exceeds the selected budget.", 409);

  const count = await prisma.procurementOrder.count({ where: { cycleId: cycle.id } });
  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.procurementOrder.create({
      data: {
        orderNumber: orderNumber(cycle.year, cycle.month, count),
        centreId,
        cycleId: cycle.id,
        selectedBudget: input.budget,
        currentSpend: total,
        remainingBudget: input.budget - total,
        percentageUsed: Math.round((total / input.budget) * 100),
        subtotal,
        total,
        status: "AWAITING_APPROVAL",
        budgetOverride: input.overrideBudget,
        items: {
          create: input.items.map((item) => {
            const product = productMap.get(item.productId)!;
            const supplierProduct = product.supplierProducts[0];
            const unitPrice = money(supplierProduct?.unitPrice ?? product.currentPrice);
            return {
              productId: product.id,
              unitPrice,
              quantity: item.quantity,
              lineTotal: unitPrice * item.quantity,
              productNameSnapshot: product.name,
              packSizeSnapshot: product.packSize,
              brandSnapshot: product.brand,
              supplierNameSnapshot: supplierProduct?.supplier.companyName
            };
          })
        },
        invoices: {
          create: {
            invoiceNo: `INV-${cycle.year}-${String(count + 1).padStart(4, "0")}`,
            amount: total,
            status: "GENERATED"
          }
        },
        deliveries: {
          create: {
            status: "PENDING",
            notes: "Awaiting ECDLink approval.",
            deliveryNote: "Delivery note placeholder",
            driverPlaceholder: "Driver placeholder",
            vehiclePlaceholder: "Vehicle placeholder"
          }
        }
      },
      include: { centre: true, cycle: true, items: { include: { product: { include: { category: true, supplierProducts: { include: { supplier: true } } } } } }, deliveries: true, invoices: true }
    });

    await tx.notification.create({ data: { centreId, title: "Order Submitted", body: `${created.orderNumber} has been submitted for approval.` } });
    await tx.auditLog.create({ data: { actorUserId, action: "procurement.order.submit", entityType: "ProcurementOrder", entityId: created.id, after: JSON.parse(JSON.stringify(created)) } });
    return created;
  });

  return mapOrder(order);
}

export async function reviewProcurementOrder(orderId: string, decision: "approve" | "reject", notes?: string, actorUserId?: string) {
  const before = await prisma.procurementOrder.findUnique({ where: { id: orderId } });
  if (!before) throw new ProcurementServiceError("Order not found.", 404);

  const status = decision === "approve" ? "APPROVED" : "REJECTED";
  const order = await prisma.$transaction(async (tx) => {
    const updated = await tx.procurementOrder.update({
      where: { id: orderId },
      data: {
        status,
        approvalNotes: decision === "approve" ? notes : undefined,
        rejectionNotes: decision === "reject" ? notes : undefined,
        approvedAt: decision === "approve" ? new Date() : undefined,
        rejectedAt: decision === "reject" ? new Date() : undefined
      },
      include: { centre: true, cycle: true, items: { include: { product: { include: { category: true, supplierProducts: { include: { supplier: true } } } } } }, deliveries: true, invoices: true }
    });
    await tx.notification.create({ data: { centreId: updated.centreId, title: decision === "approve" ? "Order Approved" : "Order Rejected", body: `${updated.orderNumber} has been ${decision === "approve" ? "approved" : "rejected"}.` } });
    await tx.auditLog.create({ data: { actorUserId, action: `procurement.order.${decision}`, entityType: "ProcurementOrder", entityId: orderId, before, after: JSON.parse(JSON.stringify(updated)) } });
    return updated;
  });

  return mapOrder(order);
}
