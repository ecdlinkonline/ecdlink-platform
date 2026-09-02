import { apiError, apiSuccess } from "@/lib/api/responses";
import { requireReportAdmin } from "@/lib/api/report-auth";
import { requireTrustedOrigin } from "@/lib/api/security";
import { createOrResumeGrantBankImport, GrantBankImportError } from "@/lib/services/grant-bank-imports";

export async function POST(request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  const context = await requireReportAdmin();
  if ("error" in context) return context.error;
  const originError = requireTrustedOrigin(request);
  if (originError) return originError;
  try {
    return apiSuccess(await createOrResumeGrantBankImport((await params).reportId, context.internalUser.id), 201);
  } catch (error) {
    if (error instanceof GrantBankImportError) return apiError(error.message, error.status);
    return apiError("The bank statement import could not be started.", 500);
  }
}
