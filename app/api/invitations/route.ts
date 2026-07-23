import { ZodError } from "zod";
import { requireIdentityAdmin } from "@/lib/api/identity-auth";
import { apiError, apiSuccess, validationError } from "@/lib/api/responses";
import { createInvitation, listInvitations } from "@/lib/repositories/invitations";
import { invitationCreateSchema } from "@/lib/validators/identity";

export async function GET() {
  const context = await requireIdentityAdmin();
  if ("error" in context) return context.error;
  return apiSuccess(await listInvitations());
}

export async function POST(request: Request) {
  const context = await requireIdentityAdmin();
  if ("error" in context) return context.error;

  try {
    const input = invitationCreateSchema.parse(await request.json());
    return apiSuccess(await createInvitation(input, context.internalUser.id), 201);
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    return apiError("Invitation could not be created.", 400);
  }
}
