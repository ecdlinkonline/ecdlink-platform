import { ZodError } from "zod";
import { requireSupplierOwnership } from "@/lib/api/supplier-auth";
import {
  apiError,
  apiSuccess,
  statusFromError,
  validationError,
} from "@/lib/api/responses";
import { prisma } from "@/lib/db/prisma";
import { updateSupplierProduct } from "@/lib/services/suppliers";
import { updateSupplierProductSchema } from "@/lib/validators/suppliers";

export async function GET(
  _: Request,
  {
    params,
  }: {
    params: Promise<{ supplierProductId: string }>;
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

  const { supplierProductId } = await params;

  const product = await prisma.supplierProduct.findUnique({
    where: {
      id: supplierProductId,
    },
    include: {
      supplier: true,
      product: {
        include: {
          category: true,
        },
      },
      priceHistory: true,
    },
  });

  if (!product) {
    return apiError(
      "Supplier product was not found.",
      404
    );
  }

  if (
    context.authContext.role !== "super_admin" &&
    !supplierIds.includes(product.supplierId)
  ) {
    return apiError(
      "You can only access your linked supplier products.",
      403
    );
  }

  return apiSuccess(product);
}

export async function PATCH(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ supplierProductId: string }>;
  }
) {
  const context = await requireSupplierOwnership(
    "catalogue.manage"
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
    const { supplierProductId } = await params;

    const product = await prisma.supplierProduct.findUnique({
      where: {
        id: supplierProductId,
      },
    });

    if (!product) {
      return apiError(
        "Supplier product was not found.",
        404
      );
    }

    if (
      context.authContext.role !== "super_admin" &&
      !supplierIds.includes(product.supplierId)
    ) {
      return apiError(
        "You can only update your linked supplier products.",
        403
      );
    }

    const input = updateSupplierProductSchema.parse(
      await request.json()
    );

    return apiSuccess(
      await updateSupplierProduct(
        product.id,
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
      "Supplier product could not be updated.",
      500
    );
  }
}