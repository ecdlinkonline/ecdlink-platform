import { ZodError } from "zod";
import { apiError, apiSuccess, validationError } from "@/lib/api/responses";
import { requireReportAdmin } from "@/lib/api/report-auth";
import { requireTrustedOrigin } from "@/lib/api/security";
import { completeGrantBankTransactionCategorisation, confirmGrantBankTransactionCategory, GrantBankImportError, suggestGrantBankTransactionCategories } from "@/lib/services/grant-bank-imports";
import { grantBankCategorisationActionSchema } from "@/lib/validators/grant-bank-imports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ reportId: string; importId: string }> }) {
  const context = await requireReportAdmin();
  if ("error" in context) return context.error;
  const originError = requireTrustedOrigin(request);
  if (originError) return originError;
  try {
    const action = grantBankCategorisationActionSchema.parse(await request.json());
    const { reportId, importId } = await params;
    const common = { reportId, importId, actorUserId: context.internalUser.id };
    if (action.action === "suggest") return apiSuccess(await suggestGrantBankTransactionCategories(common));
    if (action.action === "complete") return apiSuccess(await completeGrantBankTransactionCategorisation(common));
    return apiSuccess(await confirmGrantBankTransactionCategory({ ...common, transactionId: action.transactionId, category: action.category }));
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    if (error instanceof GrantBankImportError) return apiError(error.message, error.status);
    return apiError("The transaction categorisation could not be updated.", 500);
  }
}
