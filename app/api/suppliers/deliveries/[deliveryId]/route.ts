import { ZodError } from "zod";
import { requireSupplierOwnership } from "@/lib/api/supplier-auth";
import {
  apiError,
  apiSuccess,
  statusFromError,
  validationError,
} from "@/lib/api/responses";
import { prisma } from "@/lib/db/prisma";
import { updateSupplierDelivery } from "@/lib/services/suppliers";
import { deliveryUpdateSchema } from "@/lib/validators/suppliers";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ deliveryId: string }> }
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

  const { deliveryId } = await params;

  const delivery = await prisma.delivery.findUnique({
    where: {
      id: deliveryId,
    },
    include: {
      supplier: true,
      supplierOrder: true,
    },
  });

  if (!delivery) {
    return apiError("Delivery was not found.", 404);
  }

  if (
    context.authContext.role !== "super_admin" &&
    (
      !delivery.supplierId ||
      !supplierIds.includes(delivery.supplierId)
    )
  ) {
    return apiError(
      "You can only access your linked supplier deliveries.",
      403
    );
  }

  return apiSuccess(delivery);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ deliveryId: string }> }
) {
  const context = await requireSupplierOwnership(
    "deliveries.manage"
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
    const { deliveryId } = await params;

    const delivery = await prisma.delivery.findUnique({
      where: {
        id: deliveryId,
      },
    });

    if (!delivery) {
      return apiError("Delivery was not found.", 404);
    }

    if (
      context.authContext.role !== "super_admin" &&
      (
        !delivery.supplierId ||
        !supplierIds.includes(delivery.supplierId)
      )
    ) {
      return apiError(
        "You can only update your linked supplier deliveries.",
        403
      );
    }

    const input = deliveryUpdateSchema.parse(
      await request.json()
    );

    return apiSuccess(
      await updateSupplierDelivery(
        delivery.id,
        input,
        context.internalUser.id
      )
    );
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
      "Delivery could not be updated.",
      500
    );
  }
}