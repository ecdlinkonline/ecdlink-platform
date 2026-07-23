import { requireComplianceAdmin } from "@/lib/api/compliance-auth";
import { apiError, apiSuccess, statusFromError } from "@/lib/api/responses";
import { archiveComplianceDocument } from "@/lib/services/compliance";

export async function POST(_request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const context = await requireComplianceAdmin();
  if ("error" in context) return context.error;
  try {
    const { documentId } = await params;
    return apiSuccess(await archiveComplianceDocument(documentId, context.internalUser.id));
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, statusFromError(error));
    return apiError("Document could not be archived.", 500);
  }
}
