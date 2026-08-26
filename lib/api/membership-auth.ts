import { apiError } from "@/lib/api/responses";
import { requireApiInternalUser } from "@/lib/api/internal-auth";

export async function requireMembershipApiUser() {
  const context = await requireApiInternalUser();
  if ("error" in context) return context;
  if (!["SUPER_ADMIN", "ECD_CENTRE"].includes(context.internalUser.role)) {
    return { error: apiError("You do not have permission to access membership data.", 403) };
  }

  const centreId = context.internalUser.role === "ECD_CENTRE" ? context.internalUser.centreUsers[0]?.centreId ?? null : null;

  return {
    ...context,
    actorUserId: context.internalUser.id,
    centreId
  };
}

export async function requireMembershipAdmin() {
  const context = await requireMembershipApiUser();
  if ("error" in context) return context;
  if (context.internalUser.role !== "SUPER_ADMIN") {
    return { error: apiError("Only Super Admin users can manage memberships.", 403) };
  }
  return context;
}
