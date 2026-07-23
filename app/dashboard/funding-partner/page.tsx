import { DashboardLanding } from "@/components/app-shell/dashboard-landing";
import { RoleDashboardShell } from "@/components/app-shell/role-dashboard-shell";

export default function FundingPartnerDashboardPage() {
  return (
    <RoleDashboardShell role="funding_partner">
      <DashboardLanding role="funding_partner" />
    </RoleDashboardShell>
  );
}
