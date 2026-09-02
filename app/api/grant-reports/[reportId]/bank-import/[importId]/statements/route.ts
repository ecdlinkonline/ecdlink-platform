import { ZodError } from "zod";
import { apiError, apiSuccess, validationError } from "@/lib/api/responses";
import { requireReportAdmin } from "@/lib/api/report-auth";
import { enforceRateLimit, requireTrustedOrigin } from "@/lib/api/security";
import { validateUploadRequest } from "@/lib/security/upload-request";
import { GrantBankImportError, uploadGrantBankStatement } from "@/lib/services/grant-bank-imports";
import { StorageError } from "@/lib/storage/errors";
import { uploadGrantBankStatementSchema } from "@/lib/validators/grant-bank-imports";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ reportId: string; importId: string }> }) {
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
    if (!(file instanceof File)) return apiError("Select a bank statement to upload.", 422);
    const metadata = uploadGrantBankStatementSchema.parse({
      replaceStatementId: formData.get("replaceStatementId") ?? "",
      statementMonth: formData.get("statementMonth") ?? "",
      periodStart: formData.get("periodStart") ?? "",
      periodEnd: formData.get("periodEnd") ?? "",
      statementDate: formData.get("statementDate") ?? "",
      bankName: formData.get("bankName") ?? "",
      accountHolderName: formData.get("accountHolderName") ?? "",
      maskedAccountReference: formData.get("maskedAccountReference") ?? "",
      openingBalance: formData.get("openingBalance") ?? "",
      closingBalance: formData.get("closingBalance") ?? "",
      currency: formData.get("currency") ?? "",
    });
    const { reportId, importId } = await params;
    return apiSuccess(await uploadGrantBankStatement({ reportId, importId, actorUserId: context.internalUser.id, file, metadata }), 201);
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    if (error instanceof GrantBankImportError || error instanceof StorageError) return apiError(error.message, error.status);
    return apiError("The bank statement could not be uploaded.", 500);
  }
}
