import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell/app-shell";
import { getDashboardPath, type UserRole } from "@/lib/auth/roles";
import { getAuthContext } from "@/lib/auth/session";
import { syncCurrentUserOnLogin } from "@/lib/auth/permissions";

export async function RoleDashboardShell({
  role,
  children
}: {
  role: UserRole;
  children: React.ReactNode;
}) {
  const authContext = await getAuthContext();

  if (!authContext) {
    redirect("/auth/sign-in");
  }

  if (!authContext.role) {
    redirect("/auth/select-role");
  }

  if (authContext.role !== role) {
    redirect(getDashboardPath(authContext.role));
  }

  await syncCurrentUserOnLogin();

  return (
    <AppShell authContext={authContext} role={role}>
      {children}
    </AppShell>
  );
}
