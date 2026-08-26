import { apiError } from "@/lib/api/responses";
import { getInternalAuthContext } from "@/lib/auth/internal-context";

export async function requireApiInternalUser() {
  const context = await getInternalAuthContext();
  if (context.reason === "unauthenticated") return { error: apiError("Authentication required.", 401) };
  if (context.reason === "database_unavailable") return { error: apiError("Database is not configured.", 503) };
  if (context.reason === "inactive") return { error: apiError("Internal user is not active.", 403) };
  return context;
}
