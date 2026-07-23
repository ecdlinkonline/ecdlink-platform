import { ZodError } from "zod";
import { requireComplianceAdmin } from "@/lib/api/compliance-auth";
import { apiError, apiSuccess, statusFromError, validationError } from "@/lib/api/responses";
import { rejectComplianceDocument } from "@/lib/services/compliance";
import { complianceRejectSchema } from "@/lib/validators/compliance";

export async function POST(request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const context = await requireComplianceAdmin();
  if ("error" in context) return context.error;
  try {
    const { documentId } = await params;
    const input = complianceRejectSchema.parse(await request.json());
    return apiSuccess(await rejectComplianceDocument(documentId, input.reason, context.internalUser.id));
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    if (error instanceof Error) return apiError(error.message, statusFromError(error));
    return apiError("Document could not be rejected.", 500);
  }
}
