import { ZodError } from "zod";
import { requireFundingOrganisation } from "@/lib/api/funding-auth";
import { apiError, apiSuccess, statusFromError, validationError } from "@/lib/api/responses";
import { prisma } from "@/lib/db/prisma";
import { decideFundingApplication } from "@/lib/services/funding";
import { applicationDecisionSchema } from "@/lib/validators/funding";
import { enforceRateLimit, requireTrustedOrigin } from "@/lib/api/security";

export async function POST(request: Request, { params }: { params: Promise<{ applicationId: string }> }) {
  const context = await requireFundingOrganisation();
  if ("error" in context) return context.error;
  const originError = requireTrustedOrigin(request); if (originError) return originError;
  const rateError = await enforceRateLimit("funding_decision", context.internalUser.id); if (rateError) return rateError;

  try {
    const { applicationId } = await params;
    const application = await prisma.fundingApplication.findUnique({ where: { id: applicationId } });
    if (!application) return apiError("Funding application was not found.", 404);
   const fundingOrganisationIds =
  "fundingOrganisationIds" in context
    ? context.fundingOrganisationIds
    : [];

if (
  context.authContext.role === "funding_partner" &&
  (
    !application.fundingOrganisationId ||
    !fundingOrganisationIds.includes(application.fundingOrganisationId)
  )
) {
      return apiError("You can only decide applications assigned to your funding organisation.", 403);
    }
    const input = applicationDecisionSchema.parse(await request.json());
    return apiSuccess(await decideFundingApplication(applicationId, input, context.internalUser.id));
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    return apiError("Funding application decision could not be saved.", error instanceof Error ? statusFromError(error, 500) : 500);
  }
}
