import { ZodError } from "zod";
import { apiError, apiSuccess, statusFromError, validationError } from "@/lib/api/responses";
import { requireReportAdmin } from "@/lib/api/report-auth";
import { enforceRateLimit, requireTrustedOrigin } from "@/lib/api/security";
import { validateUploadRequest } from "@/lib/security/upload-request";
import { uploadGrantReportDocument } from "@/lib/services/grant-report-documents";
import { GrantReportingServiceError } from "@/lib/services/grant-reports";
import { StorageError } from "@/lib/storage/errors";
import { uploadGrantReportDocumentSchema } from "@/lib/validators/grant-reports";

export async function POST(request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  const context = await requireReportAdmin();
  if ("error" in context) return context.error;
  const originError = requireTrustedOrigin(request);
  if (originError) return originError;
  const rateError = await enforceRateLimit("funding_document_upload", context.internalUser.id);
  if (rateError) return rateError;
  const requestValidation = validateUploadRequest(request);
  if (!requestValidation.valid) return apiError(requestValidation.message, requestValidation.status);
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return apiError("Select a document to upload.", 422);
    const metadata = uploadGrantReportDocumentSchema.parse({
      documentType: formData.get("documentType"),
      title: formData.get("title"),
      description: formData.get("description") || undefined,
      indicatorId: formData.get("indicatorId") || undefined,
    });
    return apiSuccess(await uploadGrantReportDocument({ reportId: (await params).reportId, actorUserId: context.internalUser.id, file, metadata }), 201);
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    if (error instanceof GrantReportingServiceError || error instanceof StorageError) return apiError(error.message, statusFromError(error, 500));
    return apiError("The report document could not be uploaded.", 500);
  }
}
