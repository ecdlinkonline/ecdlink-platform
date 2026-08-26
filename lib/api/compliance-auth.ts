import { apiError } from "@/lib/api/responses";
import { requireApiInternalUser } from "@/lib/api/internal-auth";

export async function requireComplianceUser() {
  const context = await requireApiInternalUser();
  if ("error" in context) return context;
  if (!["SUPER_ADMIN", "ECD_CENTRE"].includes(context.internalUser.role)) {
    return { error: apiError("You do not have access to compliance records.", 403) };
  }
  return context;
}

export async function requireComplianceAdmin() {
  const context = await requireComplianceUser();
  if ("error" in context) return context;
  if (context.internalUser.role !== "SUPER_ADMIN") return { error: apiError("Only Super Admin users can manage compliance verification.", 403) };
  return context;
}

export async function resolveComplianceCentre() {
  const context = await requireComplianceUser();
  if ("error" in context) return context;
  if (context.internalUser.role === "SUPER_ADMIN") return { ...context, centreId: null };
  const ownership = context.internalUser.centreUsers[0];
  if (!ownership) return { error: apiError("No centre ownership found for this user.", 403) };
  return { ...context, centreId: ownership.centreId };
}
