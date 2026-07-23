import { getAuthContext } from "@/lib/auth/session";
import { apiError } from "@/lib/api/responses";
import { hasDatabaseConfig } from "@/lib/db/env";
import { getInternalUserByClerkId } from "@/lib/repositories/users";

export async function requireIdentityAdmin() {
  const authContext = await getAuthContext();
  if (!authContext) return { error: apiError("Authentication required.", 401) };
  if (authContext.role !== "super_admin") return { error: apiError("Only Super Admin users can manage identity records.", 403) };
  if (!hasDatabaseConfig()) return { error: apiError("Database is not configured.", 503) };

  const internalUser = await getInternalUserByClerkId(authContext.userId);
  if (!internalUser || internalUser.status !== "ACTIVE") return { error: apiError("Internal user is not active.", 403) };

  return { authContext, internalUser };
}
