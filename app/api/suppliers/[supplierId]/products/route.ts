import { ZodError } from "zod";
import {
  canAccessSupplier,
  requireSupplierOwnership,
} from "@/lib/api/supplier-auth";
import {
  apiError,
  apiSuccess,
  statusFromError,
  validationError,
} from "@/lib/api/responses";
import {
  getSupplierProductsFromDb,
  resolveSupplierDbId,
} from "@/lib/repositories/suppliers";
import { upsertSupplierProduct } from "@/lib/services/suppliers";
import { supplierProductSchema } from "@/lib/validators/suppliers";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ supplierId: string }> }
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

  const accessContext = {
    authContext: context.authContext,
    supplierIds,
  };

  const { supplierId } = await params;
  const dbId = await resolveSupplierDbId(supplierId);

  if (!dbId) {
    return apiError("Supplier was not found.", 404);
  }

  if (!canAccessSupplier(accessContext, dbId)) {
    return apiError(
      "You can only access your linked supplier.",
      403
    );
  }

  return apiSuccess(
    await getSupplierProductsFromDb(dbId)
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ supplierId: string }> }
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

  const accessContext = {
    authContext: context.authContext,
    supplierIds,
  };

  try {
    const { supplierId } = await params;
    const dbId = await resolveSupplierDbId(supplierId);

    if (!dbId) {
      return apiError("Supplier was not found.", 404);
    }

    if (!canAccessSupplier(accessContext, dbId)) {
      return apiError(
        "You can only update your linked supplier.",
        403
      );
    }

    const input = supplierProductSchema.parse(
      await request.json()
    );

    return apiSuccess(
      await upsertSupplierProduct(
        dbId,
        input,
        context.internalUser.id
      ),
      201
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
      "Supplier product could not be saved.",
      500
    );
  }
}