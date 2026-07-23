import { NextRequest } from "next/server";
import { ZodError } from "zod";
import {
  requireSupplierAdmin,
  requireSupplierModuleUser,
} from "@/lib/api/supplier-auth";
import {
  apiError,
  apiSuccess,
  statusFromError,
  validationError,
} from "@/lib/api/responses";
import { listSuppliersFromDb } from "@/lib/repositories/suppliers";
import { createSupplier } from "@/lib/services/suppliers";
import {
  createSupplierSchema,
  supplierFiltersSchema,
} from "@/lib/validators/suppliers";

type SupplierFilters = Parameters<
  typeof listSuppliersFromDb
>[0];

export async function GET(request: NextRequest) {
  const context = await requireSupplierModuleUser();

  if ("error" in context) {
    return context.error;
  }

  if (context.authContext.role === "supplier") {
    const supplierIds =
      context.internalUser.supplierUsers.map(
        (membership) => membership.supplierId
      );

    const suppliers = await listSuppliersFromDb();

    return apiSuccess(
      suppliers.filter((supplier) =>
        supplierIds.includes(supplier.id)
      )
    );
  }

  const filters = supplierFiltersSchema.parse({
    query:
      request.nextUrl.searchParams.get("query") ??
      undefined,
    status:
      request.nextUrl.searchParams.get("status") ??
      undefined,
    area:
      request.nextUrl.searchParams.get("area") ??
      undefined,
    category:
      request.nextUrl.searchParams.get("category") ??
      undefined,
    compliance:
      request.nextUrl.searchParams.get("compliance") ??
      undefined,
  }) as SupplierFilters;

  return apiSuccess(
    await listSuppliersFromDb(filters)
  );
}

export async function POST(request: Request) {
  const context = await requireSupplierAdmin();

  if ("error" in context) {
    return context.error;
  }

  try {
    const input = createSupplierSchema.parse(
      await request.json()
    );

    return apiSuccess(
      await createSupplier(
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
      "Supplier could not be created.",
      500
    );
  }
}