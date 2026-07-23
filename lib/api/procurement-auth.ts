import { getAuthContext } from "@/lib/auth/session";
import { apiError } from "@/lib/api/responses";
import { hasDatabaseConfig } from "@/lib/db/env";
import { getInternalUserByClerkId } from "@/lib/repositories/users";

export async function requireProcurementUser() {
  const authContext = await getAuthContext();
  if (!authContext) return { error: apiError("Authentication required.", 401) };
  if (!hasDatabaseConfig()) return { error: apiError("Database is not configured.", 503) };

  const internalUser = await getInternalUserByClerkId(authContext.userId);
  if (!internalUser || internalUser.status !== "ACTIVE") return { error: apiError("Internal user is not active.", 403) };

  return { authContext, internalUser };
}

export async function requireProcurementAdmin() {
  const context = await requireProcurementUser();
  if ("error" in context) return context;
  if (context.authContext.role !== "super_admin") return { error: apiError("Only Super Admin users can manage procurement.", 403) };
  return context;
}

export async function requireProcurementCentre() {
  const context = await requireProcurementUser();
  if ("error" in context) return context;
  if (context.authContext.role !== "ecd_centre") return { error: apiError("Only ECD Centre users can submit centre orders.", 403) };
  const ownership = context.internalUser.centreUsers[0];
  if (!ownership) return { error: apiError("No centre ownership found for this user.", 403) };
  return { ...context, ownership };
}

export async function requireProcurementSupplier() {
  const context = await requireProcurementUser();
  if ("error" in context) return context;
  if (context.authContext.role !== "supplier" && context.authContext.role !== "super_admin") return { error: apiError("Only suppliers can access supplier procurement data.", 403) };
  return context;
}
