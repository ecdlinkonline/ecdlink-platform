import { ZodError } from "zod";
import { requireComplianceAdmin } from "@/lib/api/compliance-auth";
import { apiError, apiSuccess, statusFromError, validationError } from "@/lib/api/responses";
import { verifyComplianceDocument } from "@/lib/services/compliance";
import { complianceVerifySchema } from "@/lib/validators/compliance";

export async function POST(request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const context = await requireComplianceAdmin();
  if ("error" in context) return context.error;
  try {
    const { documentId } = await params;
    const input = complianceVerifySchema.parse(await request.json().catch(() => ({})));
    return apiSuccess(await verifyComplianceDocument(documentId, input.notes, context.internalUser.id));
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    if (error instanceof Error) return apiError(error.message, statusFromError(error));
    return apiError("Document could not be verified.", 500);
  }
}
