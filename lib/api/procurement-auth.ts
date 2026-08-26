import { apiError } from "@/lib/api/responses";
import { requireApiInternalUser } from "@/lib/api/internal-auth";

export async function requireProcurementUser() {
  return requireApiInternalUser();
}

export async function requireProcurementAdmin() {
  const context = await requireProcurementUser();
  if ("error" in context) return context;
  if (context.internalUser.role !== "SUPER_ADMIN") return { error: apiError("Only Super Admin users can manage procurement.", 403) };
  return context;
}

export async function requireProcurementCentre() {
  const context = await requireProcurementUser();
  if ("error" in context) return context;
  if (context.internalUser.role !== "ECD_CENTRE") return { error: apiError("Only ECD Centre users can submit centre orders.", 403) };
  const ownership = context.internalUser.centreUsers[0];
  if (!ownership) return { error: apiError("No centre ownership found for this user.", 403) };
  return { ...context, ownership };
}

export async function requireProcurementSupplier() {
  const context = await requireProcurementUser();
  if ("error" in context) return context;
  if (context.internalUser.role !== "SUPPLIER" && context.internalUser.role !== "SUPER_ADMIN") return { error: apiError("Only suppliers can access supplier procurement data.", 403) };
  return context;
}
