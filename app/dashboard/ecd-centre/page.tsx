import { DashboardLanding } from "@/components/app-shell/dashboard-landing";
import { RoleDashboardShell } from "@/components/app-shell/role-dashboard-shell";

export default function EcdCentreDashboardPage() {
  return (
    <RoleDashboardShell role="ecd_centre">
      <DashboardLanding role="ecd_centre" />
    </RoleDashboardShell>
  );
}
