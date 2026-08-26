import { apiError } from "@/lib/api/responses";
import { requireApiInternalUser } from "@/lib/api/internal-auth";

export async function requireFundingUser() {
  return requireApiInternalUser();
}

export async function requireFundingAdmin() {
  const context = await requireFundingUser();
  if ("error" in context) return context;
  if (context.internalUser.role !== "SUPER_ADMIN") return { error: apiError("Only Super Admin users can manage funding records.", 403) };
  return context;
}

export async function requireFundingCentre() {
  const context = await requireFundingUser();
  if ("error" in context) return context;
  if (context.internalUser.role !== "ECD_CENTRE") return { error: apiError("Only ECD Centre users can manage centre funding readiness.", 403) };
  const centreIds = context.internalUser.centreUsers.map((ownership) => ownership.centreId);
  if (!centreIds.length) return { error: apiError("No centre ownership found for this user.", 403) };
  return { ...context, centreIds };
}

export async function requireFundingOrganisation() {
  const context = await requireFundingUser();
  if ("error" in context) return context;
  if (!["FUNDING_ORGANISATION", "SUPER_ADMIN"].includes(context.internalUser.role)) {
    return { error: apiError("Only funding partners can manage funding calls and assessments.", 403) };
  }
  const fundingOrganisationIds = context.internalUser.fundingUsers.map((membership) => membership.fundingOrganisationId);
  if (context.internalUser.role === "FUNDING_ORGANISATION" && !fundingOrganisationIds.length) {
    return { error: apiError("No funding organisation membership found for this user.", 403) };
  }
  return { ...context, fundingOrganisationIds };
}
