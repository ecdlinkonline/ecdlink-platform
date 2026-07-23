import { apiError } from "@/lib/api/responses";
import { getAuthContext } from "@/lib/auth/session";
import { hasDatabaseConfig } from "@/lib/db/env";
import { getInternalUserByClerkId } from "@/lib/repositories/users";

export async function requireSupplierModuleUser() {
  const authContext = await getAuthContext();
  if (!authContext) return { error: apiError("Authentication required.", 401) };
  if (!hasDatabaseConfig()) return { error: apiError("Database is not configured.", 503) };
  const internalUser = await getInternalUserByClerkId(authContext.userId);
  if (!internalUser || internalUser.status !== "ACTIVE") return { error: apiError("Internal user is not active.", 403) };
  if (!["super_admin", "supplier"].includes(authContext.role ?? "")) return { error: apiError("You do not have access to supplier operations.", 403) };
  return { authContext, internalUser };
}

export async function requireSupplierAdmin() {
  const context = await requireSupplierModuleUser();
  if ("error" in context) return context;
  if (context.authContext.role !== "super_admin") return { error: apiError("Only Super Admin users can manage suppliers.", 403) };
  return context;
}

export async function requireSupplierOwnership(requiredPermission?: string) {
  const context = await requireSupplierModuleUser();
  if ("error" in context) return context;
  if (context.authContext.role === "super_admin") {
    return { ...context, supplierIds: null as string[] | null, supplierMemberships: context.internalUser.supplierUsers };
  }
  const memberships = context.internalUser.supplierUsers.filter((membership) => membership.status === "ACTIVE");
  if (!memberships.length) return { error: apiError("No supplier ownership found for this user.", 403) };
  if (requiredPermission && !memberships.some((membership) => membership.permissions.includes(requiredPermission) || membership.role === "OWNER" || membership.role === "ADMINISTRATOR")) {
    return { error: apiError("Your supplier role does not have permission for this action.", 403) };
  }
  return { ...context, supplierIds: memberships.map((membership) => membership.supplierId), supplierMemberships: memberships };
}

export function canAccessSupplier(context: { authContext: { role: string | null }; supplierIds: string[] | null }, supplierId: string) {
  return context.authContext.role === "super_admin" || context.supplierIds?.includes(supplierId);
}
