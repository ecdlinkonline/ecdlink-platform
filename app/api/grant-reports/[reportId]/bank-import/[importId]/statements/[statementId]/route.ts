import { ZodError } from "zod";
import { apiError, apiSuccess, validationError } from "@/lib/api/responses";
import { requireReportAdmin } from "@/lib/api/report-auth";
import { requireTrustedOrigin } from "@/lib/api/security";
import { GrantBankImportError, removeGrantBankStatement, updateGrantBankStatementMetadata } from "@/lib/services/grant-bank-imports";
import { StorageError } from "@/lib/storage/errors";
import { grantBankStatementMetadataSchema } from "@/lib/validators/grant-bank-imports";

type RouteContext = { params: Promise<{ reportId: string; importId: string; statementId: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const context = await requireReportAdmin();
  if ("error" in context) return context.error;
  const originError = requireTrustedOrigin(request);
  if (originError) return originError;
  try {
    const metadata = grantBankStatementMetadataSchema.parse(await request.json());
    const { reportId, importId, statementId } = await params;
    return apiSuccess(await updateGrantBankStatementMetadata({ reportId, importId, statementId, actorUserId: context.internalUser.id, metadata }));
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    if (error instanceof GrantBankImportError) return apiError(error.message, error.status);
    return apiError("The statement details could not be updated.", 500);
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const context = await requireReportAdmin();
  if ("error" in context) return context.error;
  const originError = requireTrustedOrigin(request);
  if (originError) return originError;
  try {
    const { reportId, importId, statementId } = await params;
    return apiSuccess(await removeGrantBankStatement({ reportId, importId, statementId, actorUserId: context.internalUser.id }));
  } catch (error) {
    if (error instanceof GrantBankImportError || error instanceof StorageError) return apiError(error.message, error.status);
    return apiError("The bank statement could not be removed.", 500);
  }
}
