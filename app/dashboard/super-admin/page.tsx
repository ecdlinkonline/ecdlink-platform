import { DashboardLanding } from "@/components/app-shell/dashboard-landing";
import { RoleDashboardShell } from "@/components/app-shell/role-dashboard-shell";

export default function SuperAdminDashboardPage() {
  return (
    <RoleDashboardShell role="super_admin">
      <DashboardLanding role="super_admin" />
    </RoleDashboardShell>
  );
}
