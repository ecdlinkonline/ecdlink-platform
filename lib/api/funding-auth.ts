import { apiError } from "@/lib/api/responses";
import { getAuthContext } from "@/lib/auth/session";
import { hasDatabaseConfig } from "@/lib/db/env";
import { getInternalUserByClerkId } from "@/lib/repositories/users";

export async function requireFundingUser() {
  const authContext = await getAuthContext();
  if (!authContext) return { error: apiError("Authentication required.", 401) };
  if (!hasDatabaseConfig()) return { error: apiError("Database is not configured.", 503) };

  const internalUser = await getInternalUserByClerkId(authContext.userId);
  if (!internalUser || internalUser.status !== "ACTIVE") return { error: apiError("Internal user is not active.", 403) };

  return { authContext, internalUser };
}

export async function requireFundingAdmin() {
  const context = await requireFundingUser();
  if ("error" in context) return context;
  if (context.authContext.role !== "super_admin") return { error: apiError("Only Super Admin users can manage funding records.", 403) };
  return context;
}

export async function requireFundingCentre() {
  const context = await requireFundingUser();
  if ("error" in context) return context;
  if (context.authContext.role !== "ecd_centre") return { error: apiError("Only ECD Centre users can manage centre funding readiness.", 403) };
  const centreIds = context.internalUser.centreUsers.map((ownership) => ownership.centreId);
  if (!centreIds.length) return { error: apiError("No centre ownership found for this user.", 403) };
  return { ...context, centreIds };
}

export async function requireFundingOrganisation() {
  const context = await requireFundingUser();
  if ("error" in context) return context;
  if (!["funding_partner", "super_admin"].includes(context.authContext.role ?? "")) {
    return { error: apiError("Only funding partners can manage funding calls and assessments.", 403) };
  }
  const fundingOrganisationIds = context.internalUser.fundingUsers.map((membership) => membership.fundingOrganisationId);
  if (context.authContext.role === "funding_partner" && !fundingOrganisationIds.length) {
    return { error: apiError("No funding organisation membership found for this user.", 403) };
  }
  return { ...context, fundingOrganisationIds };
}
