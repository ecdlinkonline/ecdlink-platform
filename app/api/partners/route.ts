import { ZodError } from "zod";
import { requirePartnerAdmin, requirePartnerModuleUser } from "@/lib/api/partner-auth";
import { apiError, apiSuccess, statusFromError, validationError } from "@/lib/api/responses";
import { listPartnersFromDb } from "@/lib/repositories/donors";
import { createPartnerOrganisation } from "@/lib/services/partners";
import { partnerOrganisationSchema } from "@/lib/validators/partners";

export async function GET() {
  const context = await requirePartnerModuleUser();
  if ("error" in context) return context.error;
  return apiSuccess(await listPartnersFromDb());
}

export async function POST(request: Request) {
  const context = await requirePartnerAdmin();
  if ("error" in context) return context.error;
  try {
    return apiSuccess(await createPartnerOrganisation(partnerOrganisationSchema.parse(await request.json()), context.internalUser.id), 201);
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    if (error instanceof Error) return apiError(error.message, statusFromError(error));
    return apiError("Partner organisation could not be created.", 500);
  }
}
