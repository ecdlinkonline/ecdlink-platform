import { requireSupplierOwnership } from "@/lib/api/supplier-auth";
import {
  apiError,
  apiSuccess,
  statusFromError,
} from "@/lib/api/responses";
import { prisma } from "@/lib/db/prisma";
import { createAuditLog } from "@/lib/repositories/audit-logs";

export async function POST(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ supplierOrderId: string }>;
  }
) {
  const context = await requireSupplierOwnership(
    "orders.manage"
  );

  if ("error" in context) {
    return context.error;
  }

  const supplierIds =
    ("supplierIds" in context ? context.supplierIds : null) ??
    context.internalUser.supplierUsers.map(
      (membership) => membership.supplierId
    );

  try {
    const body = await request.json().catch(() => ({}));
    const { supplierOrderId } = await params;

    const order = await prisma.supplierOrder.findFirst({
      where: {
        OR: [
          { id: supplierOrderId },
          { orderReference: supplierOrderId },
        ],
      },
    });

    if (!order) {
      return apiError(
        "Supplier order was not found.",
        404
      );
    }

    if (
      context.authContext.role !== "super_admin" &&
      !supplierIds.includes(order.supplierId)
    ) {
      return apiError(
        "You can only update your linked supplier orders.",
        403
      );
    }

    const status =
      typeof body.status === "string"
        ? body.status
        : "Packed";

    const packingNotes =
      typeof body.notes === "string"
        ? body.notes
        : undefined;

    const after = await prisma.supplierOrder.update({
      where: {
        id: order.id,
      },
      data: {
        status,
        packedAt:
          status === "Packed"
            ? new Date()
            : undefined,
        packingNotes,
      },
    });

    await createAuditLog({
      actorUserId: context.internalUser.id,
      action: "supplier.order.packing",
      entityType: "SupplierOrder",
      entityId: order.id,
      before: order,
      after,
    });

    return apiSuccess(after);
  } catch (error) {
    if (error instanceof Error) {
      return apiError(
        error.message,
        statusFromError(error)
      );
    }

    return apiError(
      "Supplier order packing status could not be updated.",
      500
    );
  }
}