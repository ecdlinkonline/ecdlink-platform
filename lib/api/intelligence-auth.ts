import { apiError } from "@/lib/api/responses";
import { requireApiInternalUser } from "@/lib/api/internal-auth";
import type { UserRole } from "@/lib/auth/roles";

export type IntelligenceScope = {
  authRole: UserRole;
  databaseRole: "SUPER_ADMIN" | "ECDLINK_STAFF" | "ECD_CENTRE" | "SUPPLIER" | "DONOR" | "FUNDING_ORGANISATION" | "SYSTEM";
  userId: string;
  roleId?: string;
  centreIds: string[];
  supplierIds: string[];
  donorOrganisationIds: string[];
  fundingOrganisationIds: string[];
  isPlatformWide: boolean;
};

export async function requireIntelligenceAccess() {
  const context = await requireApiInternalUser();
  if ("error" in context) return context;
  const { authContext, internalUser } = context;
  if (!authContext.role) return { error: apiError("A platform role is required for Intelligence access.", 403) };

  const scope: IntelligenceScope = {
    authRole: authContext.role,
    databaseRole: internalUser.role,
    userId: internalUser.id,
    roleId: internalUser.roleId ?? undefined,
    centreIds: internalUser.centreUsers.map((item) => item.centreId),
    supplierIds: internalUser.supplierUsers.filter((item) => item.status === "ACTIVE").map((item) => item.supplierId),
    donorOrganisationIds: internalUser.donorUsers.filter((item) => item.status === "ACTIVE").map((item) => item.donorOrganisationId),
    fundingOrganisationIds: internalUser.fundingUsers.map((item) => item.fundingOrganisationId),
    isPlatformWide: internalUser.role === "SUPER_ADMIN"
  };

  if (!scope.isPlatformWide) {
    const hasTenant = scope.centreIds.length || scope.supplierIds.length || scope.donorOrganisationIds.length || scope.fundingOrganisationIds.length;
    if (!hasTenant) return { error: apiError("No linked organisation ownership found for this user.", 403) };
  }

  return { authContext, internalUser, scope };
}

export function organisationForScope(scope: IntelligenceScope) {
  if (scope.centreIds[0]) return { organisationType: "Centre", organisationId: scope.centreIds[0] };
  if (scope.supplierIds[0]) return { organisationType: "Supplier", organisationId: scope.supplierIds[0] };
  if (scope.donorOrganisationIds[0]) return { organisationType: "DonorOrganisation", organisationId: scope.donorOrganisationIds[0] };
  if (scope.fundingOrganisationIds[0]) return { organisationType: "FundingOrganisation", organisationId: scope.fundingOrganisationIds[0] };
  return { organisationType: "Platform", organisationId: undefined };
}

export function rateLimitPlaceholder() {
  return { allowed: true, remaining: 100 };
}
