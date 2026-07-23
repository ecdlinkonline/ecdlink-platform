import { requirePartnerAdmin } from "@/lib/api/partner-auth";
import { apiError, apiSuccess, statusFromError } from "@/lib/api/responses";
import { approveProjectUpdate } from "@/lib/services/partners";

export async function POST(_: Request, { params }: { params: Promise<{ updateId: string }> }) {
  const context = await requirePartnerAdmin();
  if ("error" in context) return context.error;
  try { return apiSuccess(await approveProjectUpdate((await params).updateId, context.internalUser.id)); }
  catch (error) { if (error instanceof Error) return apiError(error.message, statusFromError(error)); return apiError("Project update could not be approved.", 500); }
}
