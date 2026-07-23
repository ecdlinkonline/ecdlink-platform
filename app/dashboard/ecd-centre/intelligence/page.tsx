import { RoleDashboardShell } from "@/components/app-shell/role-dashboard-shell";
import { IntelligencePage } from "@/components/intelligence/intelligence-page";

export default function CentreIntelligencePage() {
  return (
    <RoleDashboardShell role="ecd_centre">
      <IntelligencePage
        role="ecd_centre"
        mode="ecd-centre"
        title="ECD Centre Assistant"
        description="Check missing documents, plan procurement, understand funding requirements and receive next-action recommendations."
      />
    </RoleDashboardShell>
  );
}
