import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell/app-shell";
import { getDashboardPath } from "@/lib/auth/roles";
import { requireEcdlinkStaff, syncCurrentUserOnLogin } from "@/lib/auth/permissions";
import { getAuthContext } from "@/lib/auth/session";

export async function EcdlinkStaffShell({ children }: { children: React.ReactNode }) {
  const authContext = await getAuthContext();

  if (!authContext) redirect("/auth/sign-in");
  if (!authContext.role) redirect("/auth/select-role");
  if (authContext.role !== "ecdlink_staff") redirect(getDashboardPath(authContext.role));

  await syncCurrentUserOnLogin();
  await requireEcdlinkStaff();

  return (
    <AppShell authContext={authContext} role="ecdlink_staff">
      {children}
    </AppShell>
  );
}
