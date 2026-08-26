import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell/app-shell";
import { getDashboardPath, type UserRole } from "@/lib/auth/roles";
import { requireInternalUser, syncCurrentUserOnLogin } from "@/lib/auth/permissions";

export async function RoleDashboardShell({
  role,
  children
}: {
  role: UserRole;
  children: React.ReactNode;
}) {
  await syncCurrentUserOnLogin();
  const { authContext } = await requireInternalUser();

  if (!authContext.role) {
    redirect("/auth/select-role");
  }

  if (authContext.role !== role) {
    redirect(getDashboardPath(authContext.role));
  }

  return (
    <AppShell authContext={authContext} role={role}>
      {children}
    </AppShell>
  );
}
