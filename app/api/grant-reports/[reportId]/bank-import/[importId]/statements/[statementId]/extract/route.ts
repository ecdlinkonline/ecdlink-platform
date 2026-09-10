import { apiError, apiSuccess } from "@/lib/api/responses";
import { requireReportAdmin } from "@/lib/api/report-auth";
import { enforceRateLimit, requireTrustedOrigin } from "@/lib/api/security";
import { extractGrantBankStatement, GrantBankImportError } from "@/lib/services/grant-bank-imports";
import { StorageError } from "@/lib/storage/errors";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ reportId: string; importId: string; statementId: string }> }) {
  const context = await requireReportAdmin();
  if ("error" in context) return context.error;
  const originError = requireTrustedOrigin(request);
  if (originError) return originError;
  const rateError = await enforceRateLimit("funding_document_upload", context.internalUser.id);
  if (rateError) return rateError;
  try {
    const { reportId, importId, statementId } = await params;
    return apiSuccess(await extractGrantBankStatement({ reportId, importId, statementId, actorUserId: context.internalUser.id }));
  } catch (error) {
    if (error instanceof GrantBankImportError || error instanceof StorageError) return apiError(error.message, error.status);
    return apiError("The bank statement could not be extracted.", 500);
  }
}
