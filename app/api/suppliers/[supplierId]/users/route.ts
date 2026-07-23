import { ZodError } from "zod";
import { requireSupplierAdmin } from "@/lib/api/supplier-auth";
import { apiError, apiSuccess, statusFromError, validationError } from "@/lib/api/responses";
import { prisma } from "@/lib/db/prisma";
import { resolveSupplierDbId } from "@/lib/repositories/suppliers";
import { addSupplierUser } from "@/lib/services/suppliers";
import { createSupplierUserSchema } from "@/lib/validators/suppliers";

export async function GET(_: Request, { params }: { params: Promise<{ supplierId: string }> }) {
  const context = await requireSupplierAdmin();
  if ("error" in context) return context.error;
  const dbId = await resolveSupplierDbId((await params).supplierId);
  if (!dbId) return apiError("Supplier was not found.", 404);
  return apiSuccess(await prisma.supplierUser.findMany({ where: { supplierId: dbId }, include: { user: true }, orderBy: { joinedAt: "desc" } }));
}

export async function POST(request: Request, { params }: { params: Promise<{ supplierId: string }> }) {
  const context = await requireSupplierAdmin();
  if ("error" in context) return context.error;
  try {
    const dbId = await resolveSupplierDbId((await params).supplierId);
    if (!dbId) return apiError("Supplier was not found.", 404);
    return apiSuccess(await addSupplierUser(dbId, createSupplierUserSchema.parse(await request.json()), context.internalUser.id), 201);
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    if (error instanceof Error) return apiError(error.message, statusFromError(error));
    return apiError("Supplier user could not be added.", 500);
  }
}
