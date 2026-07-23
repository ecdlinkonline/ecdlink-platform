import type { DeliveryStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { createAuditLog } from "@/lib/repositories/audit-logs";
import { stockStatusToDb } from "@/lib/supplier/format";
import type {
  createSupplierSchema,
  createSupplierUserSchema,
  deliveryUpdateSchema,
  invoiceSchema,
  quotationSchema,
  rejectSupplierDocumentSchema,
  supplierDecisionSchema,
  supplierDocumentSchema,
  supplierPaymentSchema,
  supplierProductSchema,
  updateSupplierProductSchema,
  updateSupplierSchema,
  verifySupplierDocumentSchema
} from "@/lib/validators/suppliers";
import type { z } from "zod";

function money(value: number) {
  return value.toFixed(2);
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function supplierPermissionsForRole(role: string) {
  const base = ["supplier.read"];
  const permissions: Record<string, string[]> = {
    OWNER: ["supplier.manage", "catalogue.manage", "orders.manage", "deliveries.manage", "finance.manage", "quotations.manage"],
    ADMINISTRATOR: ["supplier.manage", "catalogue.manage", "orders.manage", "deliveries.manage", "quotations.manage"],
    SALES: ["quotations.manage", "orders.read"],
    FINANCE: ["finance.manage", "invoices.manage"],
    LOGISTICS: ["deliveries.manage", "orders.manage"],
    CATALOGUE_MANAGER: ["catalogue.manage", "prices.manage"],
    READ_ONLY: []
  };
  return Array.from(new Set([...base, ...(permissions[role] ?? [])]));
}

export async function createSupplier(input: z.infer<typeof createSupplierSchema>, actorUserId: string) {
  const supplier = await prisma.supplier.create({
    data: {
      companyName: input.companyName,
      slug: `${slugify(input.companyName)}-${Date.now()}`,
      registrationNumber: input.registrationNumber,
      contactPerson: input.contactPerson,
      phone: input.phone,
      email: input.email,
      physicalAddress: input.physicalAddress,
      areasServed: input.areasServed,
      status: "Pending"
    }
  });
  await createAuditLog({ actorUserId, action: "supplier.create", entityType: "Supplier", entityId: supplier.id, after: supplier });
  return supplier;
}

export async function updateSupplierProfile(supplierId: string, input: z.infer<typeof updateSupplierSchema>, actorUserId: string) {
  const before = await prisma.supplier.findUnique({ where: { id: supplierId } });
  const after = await prisma.supplier.update({ where: { id: supplierId }, data: { ...input, minimumOrderValue: input.minimumOrderValue === undefined ? undefined : money(input.minimumOrderValue) } });
  await createAuditLog({ actorUserId, action: "supplier.profile.update", entityType: "Supplier", entityId: supplierId, before, after });
  return after;
}

export async function setSupplierStatus(supplierId: string, status: "Approved" | "Rejected" | "Suspended" | "Pending" | "Archived", actorUserId: string, reason?: string) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.supplier.findUnique({ where: { id: supplierId } });
    const after = await tx.supplier.update({
      where: { id: supplierId },
      data: {
        status,
        approvedAt: status === "Approved" ? new Date() : undefined,
        approvedByUserId: status === "Approved" ? actorUserId : undefined,
        suspendedAt: status === "Suspended" ? new Date() : status === "Approved" ? null : undefined,
        suspensionReason: status === "Suspended" ? reason : status === "Approved" ? null : undefined,
        archivedAt: status === "Archived" ? new Date() : undefined
      }
    });
    await tx.notification.create({ data: { title: `Supplier ${status.toLowerCase()}`, body: `${after.companyName} supplier status is now ${status}.` } });
    await tx.auditLog.create({ data: { actorUserId, action: `supplier.${status.toLowerCase()}`, entityType: "Supplier", entityId: supplierId, before: before ? JSON.parse(JSON.stringify(before)) : undefined, after: JSON.parse(JSON.stringify(after)), metadata: reason ? { reason } : undefined } });
    return after;
  });
}

export async function addSupplierUser(supplierId: string, input: z.infer<typeof createSupplierUserSchema>, actorUserId: string) {
  const user = await prisma.supplierUser.upsert({
    where: { supplierId_userId: { supplierId, userId: input.userId } },
    update: { role: input.role, permissions: input.permissions.length ? input.permissions : supplierPermissionsForRole(input.role), status: "ACTIVE", isPrimary: input.isPrimary ?? false, removedAt: null },
    create: { supplierId, userId: input.userId, role: input.role, permissions: input.permissions.length ? input.permissions : supplierPermissionsForRole(input.role), isPrimary: input.isPrimary ?? false, status: "ACTIVE" }
  });
  await createAuditLog({ actorUserId, action: "supplier.user.add", entityType: "SupplierUser", entityId: user.id, after: user });
  return user;
}

export async function removeSupplierUser(supplierUserId: string, actorUserId: string) {
  const before = await prisma.supplierUser.findUnique({ where: { id: supplierUserId } });
  const after = await prisma.supplierUser.update({ where: { id: supplierUserId }, data: { status: "REMOVED", removedAt: new Date(), isPrimary: false } });
  await createAuditLog({ actorUserId, action: "supplier.user.remove", entityType: "SupplierUser", entityId: supplierUserId, before, after });
  return after;
}

export async function createSupplierDocument(supplierId: string, input: z.infer<typeof supplierDocumentSchema>, actorUserId: string) {
  const document = await prisma.supplierDocument.create({ data: { supplierId, ...input, status: "UPLOADED", submittedByUserId: actorUserId, submittedAt: new Date() } });
  await createAuditLog({ actorUserId, action: "supplier.document.upload", entityType: "SupplierDocument", entityId: document.id, after: document });
  return document;
}

export async function verifySupplierDocument(documentId: string, input: z.infer<typeof verifySupplierDocumentSchema>, actorUserId: string) {
  const before = await prisma.supplierDocument.findUnique({ where: { id: documentId } });
  const after = await prisma.supplierDocument.update({ where: { id: documentId }, data: { status: "VERIFIED", verificationStatus: "VERIFIED", verifiedByUserId: actorUserId, verifiedAt: new Date(), adminNotes: input.notes } });
  await createAuditLog({ actorUserId, action: "supplier.document.verify", entityType: "SupplierDocument", entityId: documentId, before, after });
  return after;
}

export async function rejectSupplierDocument(documentId: string, input: z.infer<typeof rejectSupplierDocumentSchema>, actorUserId: string) {
  const before = await prisma.supplierDocument.findUnique({ where: { id: documentId } });
  const after = await prisma.supplierDocument.update({ where: { id: documentId }, data: { status: "REJECTED", verificationStatus: "REJECTED", rejectedByUserId: actorUserId, rejectedAt: new Date(), rejectionReason: input.reason } });
  await createAuditLog({ actorUserId, action: "supplier.document.reject", entityType: "SupplierDocument", entityId: documentId, before, after });
  return after;
}

export async function upsertSupplierProduct(supplierId: string, input: z.infer<typeof supplierProductSchema>, actorUserId: string) {
  const product = await prisma.supplierProduct.upsert({
    where: { supplierId_productId: { supplierId, productId: input.productId } },
    update: {
      supplierProductCode: input.supplierProductCode,
      supplierProductName: input.supplierProductName,
      unitPrice: money(input.unitPrice),
      stockStatus: stockStatusToDb(input.stockStatus ?? "In Stock"),
      availableQuantity: input.availableQuantity,
      minimumOrderQuantity: input.minimumOrderQuantity,
      leadTimeDays: input.leadTimeDays,
      lastPriceUpdateAt: new Date(),
      priceUpdatedAt: new Date()
    },
    create: {
      supplierId,
      productId: input.productId,
      supplierProductCode: input.supplierProductCode,
      supplierProductName: input.supplierProductName,
      unitPrice: money(input.unitPrice),
      stockStatus: stockStatusToDb(input.stockStatus ?? "In Stock"),
      availableQuantity: input.availableQuantity,
      minimumOrderQuantity: input.minimumOrderQuantity ?? 1,
      leadTimeDays: input.leadTimeDays ?? 3,
      priceEffectiveFrom: new Date()
    }
  });
  await createAuditLog({ actorUserId, action: "supplier.product.upsert", entityType: "SupplierProduct", entityId: product.id, after: product });
  return product;
}

export async function updateSupplierProduct(supplierProductId: string, input: z.infer<typeof updateSupplierProductSchema>, actorUserId: string) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.supplierProduct.findUnique({ where: { id: supplierProductId } });
    if (!before) throw new Error("Supplier product was not found.");
    const after = await tx.supplierProduct.update({
      where: { id: supplierProductId },
      data: {
        supplierProductCode: input.supplierProductCode,
        supplierProductName: input.supplierProductName,
        unitPrice: input.unitPrice === undefined ? undefined : money(input.unitPrice),
        stockStatus: input.stockStatus ? stockStatusToDb(input.stockStatus) : undefined,
        availableQuantity: input.availableQuantity,
        minimumOrderQuantity: input.minimumOrderQuantity,
        leadTimeDays: input.leadTimeDays,
        active: input.active,
        lastPriceUpdateAt: input.unitPrice === undefined ? undefined : new Date(),
        priceUpdatedAt: input.unitPrice === undefined ? undefined : new Date()
      }
    });
    if (input.unitPrice !== undefined && money(input.unitPrice) !== before.unitPrice.toString()) {
      await tx.supplierPriceHistory.create({ data: { supplierProductId, oldPrice: before.unitPrice, newPrice: money(input.unitPrice), effectiveDate: new Date(), changedByUserId: actorUserId, reason: input.reason } });
    }
    await tx.auditLog.create({ data: { actorUserId, action: "supplier.product.update", entityType: "SupplierProduct", entityId: supplierProductId, before: JSON.parse(JSON.stringify(before)), after: JSON.parse(JSON.stringify(after)) } });
    return after;
  });
}

export async function createSupplierQuotation(supplierId: string, input: z.infer<typeof quotationSchema>, actorUserId: string) {
  const subtotal = input.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const vatAmount = subtotal * 0.15;
  const quotation = await prisma.supplierQuotation.create({
    data: {
      quotationNumber: `ECDL-QUO-${Date.now()}`,
      supplierId,
      procurementCycleId: input.procurementCycleId,
      requestedByUserId: actorUserId,
      notes: input.notes,
      terms: input.terms,
      status: "REQUESTED",
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      subtotal: money(subtotal),
      vatAmount: money(vatAmount),
      totalAmount: money(subtotal + vatAmount),
      items: { create: input.items.map((item) => ({ ...item, unitPrice: money(item.unitPrice), lineTotal: money(item.quantity * item.unitPrice) })) }
    },
    include: { items: true }
  });
  await createAuditLog({ actorUserId, action: "supplier.quotation.request", entityType: "SupplierQuotation", entityId: quotation.id, after: quotation });
  return quotation;
}

export async function setQuotationStatus(quotationId: string, status: "SUBMITTED" | "APPROVED" | "REJECTED" | "WITHDRAWN", actorUserId: string, reason?: string) {
  const before = await prisma.supplierQuotation.findUnique({ where: { id: quotationId } });
  const after = await prisma.supplierQuotation.update({
    where: { id: quotationId },
    data: {
      status,
      submittedAt: status === "SUBMITTED" ? new Date() : undefined,
      approvedAt: status === "APPROVED" ? new Date() : undefined,
      approvedByUserId: status === "APPROVED" ? actorUserId : undefined,
      rejectedAt: status === "REJECTED" ? new Date() : undefined,
      rejectionReason: status === "REJECTED" ? reason : undefined
    }
  });
  await createAuditLog({ actorUserId, action: `supplier.quotation.${status.toLowerCase()}`, entityType: "SupplierQuotation", entityId: quotationId, before, after, metadata: reason ? { reason } : undefined });
  return after;
}

export async function createSupplierInvoice(supplierId: string, input: z.infer<typeof invoiceSchema>, actorUserId: string) {
  const total = input.subtotal + input.vatAmount + input.deliveryFee;
  const invoice = await prisma.supplierInvoice.create({
    data: {
      invoiceNumber: `ECDL-SUP-${Date.now()}`,
      supplierId,
      supplierOrderId: input.supplierOrderId,
      externalInvoiceReference: input.externalInvoiceReference,
      invoiceDate: input.invoiceDate,
      dueDate: input.dueDate,
      subtotal: money(input.subtotal),
      vatAmount: money(input.vatAmount),
      deliveryFee: money(input.deliveryFee),
      totalAmount: money(total),
      outstandingAmount: money(total),
      notes: input.notes
    }
  });
  await createAuditLog({ actorUserId, action: "supplier.invoice.create", entityType: "SupplierInvoice", entityId: invoice.id, after: invoice });
  return invoice;
}

export async function recordSupplierPayment(invoiceId: string, input: z.infer<typeof supplierPaymentSchema>, actorUserId: string) {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.supplierInvoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new Error("Supplier invoice was not found.");
    const payment = await tx.supplierPayment.create({ data: { supplierInvoiceId: invoice.id, supplierId: invoice.supplierId, amount: money(input.amount), paymentDate: input.paymentDate, paymentMethod: input.paymentMethod, paymentReference: input.paymentReference, proofOfPaymentFileAssetId: input.proofOfPaymentFileAssetId, notes: input.notes, recordedByUserId: actorUserId } });
    const amountPaid = Number(invoice.amountPaid) + input.amount;
    const outstanding = Math.max(0, Number(invoice.totalAmount) - amountPaid);
    await tx.supplierInvoice.update({ where: { id: invoiceId }, data: { amountPaid: money(amountPaid), outstandingAmount: money(outstanding), paymentStatus: outstanding === 0 ? "Paid" : amountPaid > 0 ? "Partially Paid" : "Not Paid" } });
    await tx.auditLog.create({ data: { actorUserId, action: "supplier.payment.record", entityType: "SupplierPayment", entityId: payment.id, after: JSON.parse(JSON.stringify(payment)) } });
    return payment;
  });
}

export async function updateSupplierDelivery(
  deliveryId: string,
  input: z.infer<typeof deliveryUpdateSchema>,
  actorUserId: string
) {
  const before = await prisma.delivery.findUnique({
    where: { id: deliveryId }
  });

  const after = await prisma.delivery.update({
    where: { id: deliveryId },
    data: {
      ...input,
      status: input.status as DeliveryStatus | undefined
    }
  });

  await createAuditLog({
    actorUserId,
    action: "supplier.delivery.update",
    entityType: "Delivery",
    entityId: deliveryId,
    before,
    after
  });

  return after;
}

export async function generateSupplierReminders(actorUserId: string) {
  const documents = await prisma.supplierDocument.findMany({ where: { expiryDate: { lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }, status: { not: "REJECTED" } }, include: { supplier: true }, take: 50 });
  const notifications = [];
  for (const document of documents) {
    const id = `supplier-document-expiry-${document.id}`;
    notifications.push(await prisma.notification.upsert({
      where: { id },
      update: { title: "Supplier compliance document expiring", body: `${document.supplier.companyName}: ${document.documentType} needs review.` },
      create: { id, title: "Supplier compliance document expiring", body: `${document.supplier.companyName}: ${document.documentType} needs review.` }
    }));
  }
  await createAuditLog({ actorUserId, action: "supplier.reminders.run", entityType: "Notification", metadata: { count: notifications.length } });
  return notifications;
}