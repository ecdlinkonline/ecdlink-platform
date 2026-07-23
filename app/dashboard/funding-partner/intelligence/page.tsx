import { RoleDashboardShell } from "@/components/app-shell/role-dashboard-shell";
import { IntelligencePage } from "@/components/intelligence/intelligence-page";

export default function FundingPartnerIntelligencePage() {
  return (
    <RoleDashboardShell role="funding_partner">
      <IntelligencePage
        role="funding_partner"
        mode="funding-partner"
        title="Funding Partner Assistant"
        description="Review funding-ready centres, proposal gaps, assessment priorities and impact report placeholders."
      />
    </RoleDashboardShell>
  );
}
