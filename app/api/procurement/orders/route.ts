import { NextRequest } from "next/server";
import { ZodError } from "zod";
import {
  requireProcurementCentre,
  requireProcurementUser,
} from "@/lib/api/procurement-auth";
import {
  apiError,
  apiSuccess,
  statusFromError,
  validationError,
} from "@/lib/api/responses";
import {
  listCentreOrdersFromDb,
  listOrdersForCentreFromDb,
  listOrdersForSupplierFromDb,
} from "@/lib/repositories/procurement";
import { createCentreProcurementOrder } from "@/lib/services/procurement";
import {
  createProcurementOrderSchema,
  procurementOrderFiltersSchema,
} from "@/lib/validators/procurement";

export async function GET(request: NextRequest) {
  const context = await requireProcurementUser();

  if ("error" in context) {
    return context.error;
  }

  if (context.authContext.role === "ecd_centre") {
    const centreId =
      context.internalUser.centreUsers[0]?.centreId;

    return apiSuccess(
      centreId
        ? await listOrdersForCentreFromDb(centreId)
        : []
    );
  }

  if (context.authContext.role === "supplier") {
    const supplierId =
      context.internalUser.supplierUsers[0]?.supplierId;

    return apiSuccess(
      supplierId
        ? await listOrdersForSupplierFromDb(supplierId)
        : []
    );
  }

  if (context.authContext.role !== "super_admin") {
    return apiError(
      "You do not have access to procurement orders.",
      403
    );
  }

  const filters = procurementOrderFiltersSchema.parse({
    query:
      request.nextUrl.searchParams.get("query") ??
      undefined,
    status:
      request.nextUrl.searchParams.get("status") ??
      undefined,
    region:
      request.nextUrl.searchParams.get("region") ??
      undefined,
    month:
      request.nextUrl.searchParams.get("month") ??
      undefined,
    supplier:
      request.nextUrl.searchParams.get("supplier") ??
      undefined,
  });

  return apiSuccess(
    await listCentreOrdersFromDb(filters)
  );
}

export async function POST(request: Request) {
  const context = await requireProcurementCentre();

  if ("error" in context) {
    return context.error;
  }

  const centreId =
    ("ownership" in context
      ? context.ownership?.centreId
      : undefined) ??
    context.internalUser.centreUsers[0]?.centreId;

  if (!centreId) {
    return apiError(
      "No centre ownership was found for this user.",
      403
    );
  }

  try {
    const input = createProcurementOrderSchema.parse(
      await request.json()
    );

    return apiSuccess(
      await createCentreProcurementOrder(
        centreId,
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
      "Procurement order could not be submitted.",
      500
    );
  }
}