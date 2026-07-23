import { ZodError } from "zod";
import { requireSupplierAdmin } from "@/lib/api/supplier-auth";
import { apiError, apiSuccess, statusFromError, validationError } from "@/lib/api/responses";
import { verifySupplierDocument } from "@/lib/services/suppliers";
import { verifySupplierDocumentSchema } from "@/lib/validators/suppliers";

export async function POST(request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const context = await requireSupplierAdmin();
  if ("error" in context) return context.error;
  try {
    return apiSuccess(await verifySupplierDocument((await params).documentId, verifySupplierDocumentSchema.parse(await request.json().catch(() => ({}))), context.internalUser.id));
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    if (error instanceof Error) return apiError(error.message, statusFromError(error));
    return apiError("Supplier document could not be verified.", 500);
  }
}
