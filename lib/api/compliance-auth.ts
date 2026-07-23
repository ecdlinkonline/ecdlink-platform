import { getAuthContext } from "@/lib/auth/session";
import { apiError } from "@/lib/api/responses";
import { hasDatabaseConfig } from "@/lib/db/env";
import { getInternalUserByClerkId } from "@/lib/repositories/users";

export async function requireComplianceUser() {
  const authContext = await getAuthContext();
  if (!authContext) return { error: apiError("Authentication required.", 401) };
  if (!hasDatabaseConfig()) return { error: apiError("Database is not configured.", 503) };
  if (!["super_admin", "ecd_centre"].includes(authContext.role ?? "")) {
    return { error: apiError("You do not have access to compliance records.", 403) };
  }
  const internalUser = await getInternalUserByClerkId(authContext.userId);
  if (!internalUser || internalUser.status !== "ACTIVE") return { error: apiError("Internal user is not active.", 403) };
  return { authContext, internalUser };
}

export async function requireComplianceAdmin() {
  const context = await requireComplianceUser();
  if ("error" in context) return context;
  if (context.authContext.role !== "super_admin") return { error: apiError("Only Super Admin users can manage compliance verification.", 403) };
  return context;
}

export async function resolveComplianceCentre() {
  const context = await requireComplianceUser();
  if ("error" in context) return context;
  if (context.authContext.role === "super_admin") return { ...context, centreId: null };
  const ownership = context.internalUser.centreUsers[0];
  if (!ownership) return { error: apiError("No centre ownership found for this user.", 403) };
  return { ...context, centreId: ownership.centreId };
}
