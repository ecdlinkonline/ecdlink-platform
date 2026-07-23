import { ZodError } from "zod";
import { requireSupplierAdmin } from "@/lib/api/supplier-auth";
import { apiError, apiSuccess, statusFromError, validationError } from "@/lib/api/responses";
import { rejectSupplierDocument } from "@/lib/services/suppliers";
import { rejectSupplierDocumentSchema } from "@/lib/validators/suppliers";

export async function POST(request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const context = await requireSupplierAdmin();
  if ("error" in context) return context.error;
  try {
    return apiSuccess(await rejectSupplierDocument((await params).documentId, rejectSupplierDocumentSchema.parse(await request.json()), context.internalUser.id));
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    if (error instanceof Error) return apiError(error.message, statusFromError(error));
    return apiError("Supplier document could not be rejected.", 500);
  }
}
