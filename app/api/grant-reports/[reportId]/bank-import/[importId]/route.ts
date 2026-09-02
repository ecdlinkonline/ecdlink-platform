import { apiError, apiSuccess } from "@/lib/api/responses";
import { requireReportAdmin } from "@/lib/api/report-auth";
import { getGrantBankImportWorkspace, GrantBankImportError } from "@/lib/services/grant-bank-imports";

export async function GET(_request: Request, { params }: { params: Promise<{ reportId: string; importId: string }> }) {
  const context = await requireReportAdmin();
  if ("error" in context) return context.error;
  try {
    const { reportId, importId } = await params;
    return apiSuccess(await getGrantBankImportWorkspace({ reportId, importId, actorUserId: context.internalUser.id }));
  } catch (error) {
    if (error instanceof GrantBankImportError) return apiError(error.message, error.status);
    return apiError("The bank statement import could not be loaded.", 500);
  }
}
