import { requireFundingOrganisation } from "@/lib/api/funding-auth";
import { apiError, apiSuccess, statusFromError } from "@/lib/api/responses";
import { uploadFundingSupportingDocument } from "@/lib/services/funding-documents";
import { enforceRateLimit, requireTrustedOrigin } from "@/lib/api/security";
import { validateUploadRequest } from "@/lib/security/upload-request";

export async function POST(request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const context = await requireFundingOrganisation();
  if ("error" in context) return context.error;
  const originError = requireTrustedOrigin(request); if (originError) return originError;
  const rateError = await enforceRateLimit("funding_document_upload", context.internalUser.id); if (rateError) return rateError;
  const requestValidation = validateUploadRequest(request); if (!requestValidation.valid) return apiError(requestValidation.message, requestValidation.status);
  try {
    const { documentId } = await params;
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return apiError("A file is required.", 422);
    return apiSuccess(await uploadFundingSupportingDocument({ documentId, actorUserId: context.internalUser.id, file }), 201);
  } catch (error) {
    return apiError("The funding document could not be uploaded.", error instanceof Error ? statusFromError(error, 500) : 500);
  }
}
