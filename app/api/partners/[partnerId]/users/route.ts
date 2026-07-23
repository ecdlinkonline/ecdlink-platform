import { ZodError } from "zod";
import { requirePartnerAdmin } from "@/lib/api/partner-auth";
import { apiError, apiSuccess, statusFromError, validationError } from "@/lib/api/responses";
import { prisma } from "@/lib/db/prisma";
import { resolvePartnerDbId } from "@/lib/repositories/donors";
import { addPartnerUser } from "@/lib/services/partners";
import { partnerUserSchema } from "@/lib/validators/partners";

export async function GET(_: Request, { params }: { params: Promise<{ partnerId: string }> }) {
  const context = await requirePartnerAdmin();
  if ("error" in context) return context.error;
  const dbId = await resolvePartnerDbId((await params).partnerId);
  if (!dbId) return apiError("Partner organisation was not found.", 404);
  return apiSuccess(await prisma.donorUser.findMany({ where: { donorOrganisationId: dbId }, include: { user: true } }));
}

export async function POST(request: Request, { params }: { params: Promise<{ partnerId: string }> }) {
  const context = await requirePartnerAdmin();
  if ("error" in context) return context.error;
  try {
    const dbId = await resolvePartnerDbId((await params).partnerId);
    if (!dbId) return apiError("Partner organisation was not found.", 404);
    return apiSuccess(await addPartnerUser(dbId, partnerUserSchema.parse(await request.json()), context.internalUser.id), 201);
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    if (error instanceof Error) return apiError(error.message, statusFromError(error));
    return apiError("Partner user could not be added.", 500);
  }
}
