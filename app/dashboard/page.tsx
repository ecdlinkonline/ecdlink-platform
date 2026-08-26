import { redirect } from "next/navigation";
import { requireInternalUser, syncCurrentUserOnLogin } from "@/lib/auth/permissions";
import { isAwaitingSelfServiceOnboarding } from "@/lib/auth/onboarding";
import { getDashboardPath } from "@/lib/auth/roles";

export default async function DashboardRouterPage() {
  const syncedUser = await syncCurrentUserOnLogin();
  if (isAwaitingSelfServiceOnboarding(syncedUser)) redirect("/auth/select-role");
  const { authContext } = await requireInternalUser();

  if (!authContext.role) {
    redirect("/auth/select-role");
  }

  redirect(getDashboardPath(authContext.role));
}
