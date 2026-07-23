import { ZodError } from "zod";
import { requireSupplierOwnership } from "@/lib/api/supplier-auth";
import {
  apiError,
  apiSuccess,
  statusFromError,
  validationError,
} from "@/lib/api/responses";
import { prisma } from "@/lib/db/prisma";
import { createAuditLog } from "@/lib/repositories/audit-logs";
import { deliveryUpdateSchema } from "@/lib/validators/suppliers";

export async function GET(
  _: Request,
  {
    params,
  }: {
    params: Promise<{ supplierOrderId: string }>;
  }
) {
  const context = await requireSupplierOwnership();

  if ("error" in context) {
    return context.error;
  }

  const supplierIds =
    ("supplierIds" in context ? context.supplierIds : null) ??
    context.internalUser.supplierUsers.map(
      (membership) => membership.supplierId
    );

  const { supplierOrderId } = await params;

  const order = await prisma.supplierOrder.findFirst({
    where: {
      OR: [
        { id: supplierOrderId },
        { orderReference: supplierOrderId },
      ],
    },
    include: {
      items: true,
      supplier: true,
      invoices: true,
      deliveries: true,
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
      "You can only access your linked supplier orders.",
      403
    );
  }

  return apiSuccess(order);
}

export async function PATCH(
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
    const body = deliveryUpdateSchema
      .partial()
      .extend({
        status: deliveryUpdateSchema.shape.status,
      })
      .parse(await request.json());

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

    const after = await prisma.supplierOrder.update({
      where: {
        id: order.id,
      },
      data: {
        status: body.status,
      },
    });

    await createAuditLog({
      actorUserId: context.internalUser.id,
      action: "supplier.order.update",
      entityType: "SupplierOrder",
      entityId: order.id,
      before: order,
      after,
    });

    return apiSuccess(after);
  } catch (error) {
    if (error instanceof ZodError) {
      return validationError(error);
    }

    if (error instanceof Error) {
      return apiError(
        error.message,
        statusFromError(error)
      );
    }

    return apiError(
      "Supplier order could not be updated.",
      500
    );
  }
}