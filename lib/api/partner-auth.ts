import { apiError } from "@/lib/api/responses";
import { getAuthContext } from "@/lib/auth/session";
import { hasDatabaseConfig } from "@/lib/db/env";
import { getInternalUserByClerkId } from "@/lib/repositories/users";

export async function requirePartnerModuleUser() {
  const authContext = await getAuthContext();
  if (!authContext) return { error: apiError("Authentication required.", 401) };
  if (!hasDatabaseConfig()) return { error: apiError("Database is not configured.", 503) };
  const internalUser = await getInternalUserByClerkId(authContext.userId);
  if (!internalUser || internalUser.status !== "ACTIVE") return { error: apiError("Internal user is not active.", 403) };
  if (!["super_admin", "donor", "ecd_centre"].includes(authContext.role ?? "")) return { error: apiError("You do not have access to partnership records.", 403) };
  return { authContext, internalUser };
}

export async function requirePartnerAdmin() {
  const context = await requirePartnerModuleUser();
  if ("error" in context) return context;
  if (context.authContext.role !== "super_admin") return { error: apiError("Only Super Admin users can manage partner moderation.", 403) };
  return context;
}

export async function requirePartnerOwnership(requiredPermission?: string) {
  const context = await requirePartnerModuleUser();
  if ("error" in context) return context;
  if (context.authContext.role === "super_admin") return { ...context, partnerIds: null as string[] | null, centreIds: null as string[] | null };
  if (context.authContext.role === "ecd_centre") {
    const centreIds = context.internalUser.centreUsers.map((membership) => membership.centreId);
    if (!centreIds.length) return { error: apiError("No centre ownership found for this user.", 403) };
    return { ...context, partnerIds: [] as string[] | null, centreIds };
  }
  const memberships = context.internalUser.donorUsers.filter((membership) => membership.status === "ACTIVE");
  if (!memberships.length) return { error: apiError("No partner organisation ownership found for this user.", 403) };
  if (requiredPermission && !memberships.some((membership) => membership.permissions.includes(requiredPermission) || membership.role === "OWNER" || membership.role === "ADMINISTRATOR")) {
    return { error: apiError("Your partner role does not have permission for this action.", 403) };
  }
  return { ...context, partnerIds: memberships.map((membership) => membership.donorOrganisationId), centreIds: [] as string[] | null };
}

export function canAccessPartner(context: { authContext: { role: string | null }; partnerIds: string[] | null }, partnerId: string) {
  return context.authContext.role === "super_admin" || context.partnerIds?.includes(partnerId);
}
