import { z, ZodError } from "zod";
import { requireTrustedOrigin } from "@/lib/api/security";
import { apiError, apiSuccess, validationError } from "@/lib/api/responses";
import { syncCurrentUserOnLogin } from "@/lib/auth/permissions";
import { selfServiceRoles } from "@/lib/auth/role-mapping";
import { setSelfServiceOnboardingRole } from "@/lib/repositories/users";

const onboardingSchema = z.object({ role: z.enum(selfServiceRoles) });

export async function POST(request: Request) {
  const originError = requireTrustedOrigin(request);
  if (originError) return originError;
  try {
    const input = onboardingSchema.parse(await request.json());
    const user = await syncCurrentUserOnLogin();
    if (!user) return apiError("Authenticated onboarding could not be completed.", 401);
    const updated = await setSelfServiceOnboardingRole(user.id, input.role);
    return apiSuccess({ role: input.role, databaseRole: updated.role });
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    return apiError(error instanceof Error ? error.message : "Onboarding could not be completed.", 403);
  }
}
