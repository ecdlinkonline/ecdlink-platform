import { apiError } from "@/lib/api/responses";
import { requireApiInternalUser } from "@/lib/api/internal-auth";

export async function requireSupplierModuleUser() {
  const context = await requireApiInternalUser();
  if ("error" in context) return context;
  if (!["SUPER_ADMIN", "SUPPLIER"].includes(context.internalUser.role)) return { error: apiError("You do not have access to supplier operations.", 403) };
  return context;
}

export async function requireSupplierAdmin() {
  const context = await requireSupplierModuleUser();
  if ("error" in context) return context;
  if (context.internalUser.role !== "SUPER_ADMIN") return { error: apiError("Only Super Admin users can manage suppliers.", 403) };
  return context;
}

export async function requireSupplierOwnership(requiredPermission?: string) {
  const context = await requireSupplierModuleUser();
  if ("error" in context) return context;
  if (context.internalUser.role === "SUPER_ADMIN") {
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
