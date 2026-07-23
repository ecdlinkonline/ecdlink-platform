import { getAuthContext } from "@/lib/auth/session";
import { hasDatabaseConfig } from "@/lib/db/env";
import { apiError } from "@/lib/api/responses";
import { getCentreIdForClerkUser, getDbUserIdForClerkUser } from "@/lib/repositories/memberships";

export async function requireMembershipApiUser() {
  const authContext = await getAuthContext();
  if (!authContext) return { error: apiError("Authentication required.", 401) };
  if (!hasDatabaseConfig()) return { error: apiError("Database is not configured for membership writes.", 503) };
  if (!authContext.role || !["super_admin", "ecd_centre"].includes(authContext.role)) {
    return { error: apiError("You do not have permission to access membership data.", 403) };
  }

  const centreId = authContext.role === "ecd_centre" ? await getCentreIdForClerkUser(authContext.userId) : null;
  const actorUserId = await getDbUserIdForClerkUser(authContext.userId);

  return {
    authContext,
    actorUserId: actorUserId ?? undefined,
    centreId
  };
}

export async function requireMembershipAdmin() {
  const context = await requireMembershipApiUser();
  if ("error" in context) return context;
  if (context.authContext.role !== "super_admin") {
    return { error: apiError("Only Super Admin users can manage memberships.", 403) };
  }
  return context;
}
