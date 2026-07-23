import { RoleDashboardShell } from "@/components/app-shell/role-dashboard-shell";
import { IntelligencePage } from "@/components/intelligence/intelligence-page";

export default function SuperAdminIntelligencePage() {
  return (
    <RoleDashboardShell role="super_admin">
      <IntelligencePage
        role="super_admin"
        mode="command-centre"
        title="AI Command Centre"
        description="Ask questions across centres, procurement, compliance, funding, membership, suppliers and donor engagement."
      />
    </RoleDashboardShell>
  );
}
