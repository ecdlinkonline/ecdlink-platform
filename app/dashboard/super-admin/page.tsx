import { DashboardLanding } from "@/components/app-shell/dashboard-landing";
import { RoleDashboardShell } from "@/components/app-shell/role-dashboard-shell";
import { getSuperAdminDashboard } from "@/lib/dashboard/super-admin-dashboard";

export default async function SuperAdminDashboardPage() {
  const dashboard = await getSuperAdminDashboard();

  return (
    <RoleDashboardShell role="super_admin">
      <DashboardLanding
        role="super_admin"
        dashboard={dashboard}
      />
    </RoleDashboardShell>
  );
}