import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell/app-shell";
import { getDashboardPath } from "@/lib/auth/roles";
import { requireEcdlinkStaff, syncCurrentUserOnLogin } from "@/lib/auth/permissions";

export async function EcdlinkStaffShell({ children }: { children: React.ReactNode }) {
  await syncCurrentUserOnLogin();
  const context = await requireEcdlinkStaff();
  const { authContext } = context;
  if (!authContext.role) redirect("/auth/select-role");
  if (authContext.role !== "ecdlink_staff") redirect(getDashboardPath(authContext.role));

  return (
    <AppShell authContext={authContext} role="ecdlink_staff">
      {children}
    </AppShell>
  );
}
