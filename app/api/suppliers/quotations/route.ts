import { ZodError } from "zod";
import { requireSupplierOwnership } from "@/lib/api/supplier-auth";
import {
  apiError,
  apiSuccess,
  statusFromError,
  validationError,
} from "@/lib/api/responses";
import { getSupplierQuotesFromDb } from "@/lib/repositories/suppliers";
import { createSupplierQuotation } from "@/lib/services/suppliers";
import { quotationSchema } from "@/lib/validators/suppliers";

export async function GET() {
  const context = await requireSupplierOwnership();

  if ("error" in context) {
    return context.error;
  }

  const supplierIds =
    ("supplierIds" in context ? context.supplierIds : null) ??
    context.internalUser.supplierUsers.map(
      (membership) => membership.supplierId
    );

  if (context.authContext.role === "super_admin") {
    return apiSuccess(await getSupplierQuotesFromDb(""));
  }

  const quotes = await Promise.all(
    supplierIds.map((supplierId) =>
      getSupplierQuotesFromDb(supplierId)
    )
  );

  return apiSuccess(quotes.flat());
}

export async function POST(request: Request) {
  const context = await requireSupplierOwnership("quotations.manage");

  if ("error" in context) {
    return context.error;
  }

  const supplierIds =
    ("supplierIds" in context ? context.supplierIds : null) ??
    context.internalUser.supplierUsers.map(
      (membership) => membership.supplierId
    );

  try {
    const input = quotationSchema.parse(await request.json());

    const supplierId =
      context.authContext.role === "super_admin"
        ? input.supplierId
        : supplierIds[0];

    if (!supplierId) {
      return apiError(
        "Supplier is required for quotation creation.",
        422
      );
    }

    return apiSuccess(
      await createSupplierQuotation(
        supplierId,
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
      return apiError(error.message, statusFromError(error));
    }

    return apiError(
      "Supplier quotation could not be created.",
      500
    );
  }
}