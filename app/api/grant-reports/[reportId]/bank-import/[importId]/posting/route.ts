import { ZodError } from "zod";
import { apiError, apiSuccess, validationError } from "@/lib/api/responses";
import { requireReportAdmin } from "@/lib/api/report-auth";
import { requireTrustedOrigin } from "@/lib/api/security";
import { getGrantBankPostingPreview, GrantBankImportError, postGrantBankTransactionsToCashFlow, returnGrantBankImportToCategorisation } from "@/lib/services/grant-bank-imports";
import { grantBankPostingActionSchema } from "@/lib/validators/grant-bank-imports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ reportId: string; importId: string }> }) {
  const context = await requireReportAdmin();
  if ("error" in context) return context.error;
  try {
    const { reportId, importId } = await params;
    return apiSuccess(await getGrantBankPostingPreview({ reportId, importId, actorUserId: context.internalUser.id }));
  } catch (error) {
    if (error instanceof GrantBankImportError) return apiError(error.message, error.status);
    return apiError("The bank transaction posting preview could not be loaded.", 500);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ reportId: string; importId: string }> }) {
  const context = await requireReportAdmin();
  if ("error" in context) return context.error;
  const originError = requireTrustedOrigin(request);
  if (originError) return originError;
  try {
    const action = grantBankPostingActionSchema.parse(await request.json());
    const { reportId, importId } = await params;
    const input = { reportId, importId, actorUserId: context.internalUser.id };
    return apiSuccess(action.action === "post" ? await postGrantBankTransactionsToCashFlow(input) : await returnGrantBankImportToCategorisation(input));
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    if (error instanceof GrantBankImportError) return apiError(error.message, error.status);
    return apiError("The confirmed bank transactions could not be posted.", 500);
  }
}
