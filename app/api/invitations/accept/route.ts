import { ZodError } from "zod";
import { getAuthContext } from "@/lib/auth/session";
import { apiError, apiSuccess, validationError } from "@/lib/api/responses";
import { acceptInvitation } from "@/lib/repositories/invitations";
import { invitationAcceptSchema } from "@/lib/validators/identity";

export async function POST(request: Request) {
  const authContext = await getAuthContext();
  if (!authContext) return apiError("Authentication required.", 401);

  try {
    const input = invitationAcceptSchema.parse(await request.json());
    return apiSuccess(await acceptInvitation(input.token, authContext.userId));
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    return apiError(error instanceof Error ? error.message : "Invitation could not be accepted.", 400);
  }
}
