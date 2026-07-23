import { ZodError } from "zod";
import { requirePartnerOwnership } from "@/lib/api/partner-auth";
import { apiError, apiSuccess, statusFromError, validationError } from "@/lib/api/responses";
import { updateCommitmentFulfilment } from "@/lib/services/partners";
import { fulfilmentSchema } from "@/lib/validators/partners";

export async function POST(request: Request, { params }: { params: Promise<{ commitmentId: string }> }) {
  const context = await requirePartnerOwnership("commitments.manage");
  if ("error" in context) return context.error;
  try { return apiSuccess(await updateCommitmentFulfilment((await params).commitmentId, fulfilmentSchema.parse(await request.json()), context.internalUser.id)); }
  catch (error) { if (error instanceof ZodError) return validationError(error); if (error instanceof Error) return apiError(error.message, statusFromError(error)); return apiError("Commitment fulfilment could not be updated.", 500); }
}
