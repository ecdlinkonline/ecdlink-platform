import { requireReportAdmin } from "@/lib/api/report-auth";
import { apiError, apiSuccess, statusFromError } from "@/lib/api/responses";
import { requireTrustedOrigin } from "@/lib/api/security";
import { rollbackStagedGrantAwardAgreement } from "@/lib/services/grant-award-agreements";

export async function DELETE(request: Request, { params }: { params: Promise<{ fileAssetId: string }> }) {
  const context = await requireReportAdmin();
  if ("error" in context) return context.error;
  const originError = requireTrustedOrigin(request); if (originError) return originError;
  try {
    const { fileAssetId } = await params;
    await rollbackStagedGrantAwardAgreement({ actorUserId: context.internalUser.id, fileAssetId });
    return apiSuccess({ rolledBack: true });
  } catch (error) {
    return apiError("The staged agreement could not be rolled back.", error instanceof Error ? statusFromError(error, 500) : 500);
  }
}
