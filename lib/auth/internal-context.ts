import "server-only";

import { getAuthContext } from "@/lib/auth/session";
import { authoritativeApplicationRole } from "@/lib/auth/authorization";
import { hasDatabaseConfig } from "@/lib/db/env";
import { getInternalUserByClerkId, getInternalUserByEmail } from "@/lib/repositories/users";

export async function getInternalAuthContext() {
  const providerContext = await getAuthContext();
  if (!providerContext) return { reason: "unauthenticated" as const };
  if (!hasDatabaseConfig()) return { reason: "database_unavailable" as const, providerContext };

  const internalUser = providerContext.provider === "clerk"
    ? await getInternalUserByClerkId(providerContext.userId)
    : providerContext.email
      ? await getInternalUserByEmail(providerContext.email)
      : null;
  if (!internalUser || internalUser.status !== "ACTIVE") {
    return { reason: "inactive" as const, providerContext, internalUser };
  }

  const authContext = {
    ...providerContext,
    role: authoritativeApplicationRole(internalUser)
  };
  const permissions = internalUser.roleRecord?.permissions.map((item) => item.permission.key) ?? [];

  return { reason: null, authContext, internalUser, permissions };
}
