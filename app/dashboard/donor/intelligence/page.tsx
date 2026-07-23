import { RoleDashboardShell } from "@/components/app-shell/role-dashboard-shell";
import { IntelligencePage } from "@/components/intelligence/intelligence-page";

export default function DonorIntelligencePage() {
  return (
    <RoleDashboardShell role="donor">
      <IntelligencePage
        role="donor"
        mode="donor"
        title="Donor / CSI Assistant"
        description="Find verified centres to support, summarise project impact and prepare partner-ready report placeholders."
      />
    </RoleDashboardShell>
  );
}
