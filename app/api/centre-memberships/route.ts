import { ZodError } from "zod";
import { requireIdentityAdmin } from "@/lib/api/identity-auth";
import { apiError, apiSuccess, validationError } from "@/lib/api/responses";
import { prisma } from "@/lib/db/prisma";
import { assignUserToCentre } from "@/lib/repositories/users";
import { assignCentreUserSchema } from "@/lib/validators/identity";

export async function GET() {
  const context = await requireIdentityAdmin();
  if ("error" in context) return context.error;

  return apiSuccess(await prisma.centreUser.findMany({
    include: { centre: true, user: true },
    orderBy: { joinedAt: "desc" }
  }));
}

export async function POST(request: Request) {
  const context = await requireIdentityAdmin();
  if ("error" in context) return context.error;

  try {
    const input = assignCentreUserSchema.parse(await request.json());
    return apiSuccess(await assignUserToCentre({ ...input, actorUserId: context.internalUser.id }), 201);
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    return apiError("Centre membership could not be assigned.", 400);
  }
}
