import { RoleDashboardShell } from "@/components/app-shell/role-dashboard-shell";
import { IntelligencePage } from "@/components/intelligence/intelligence-page";

export default function SupplierIntelligencePage() {
  return (
    <RoleDashboardShell role="supplier">
      <IntelligencePage
        role="supplier"
        mode="supplier"
        title="Supplier Assistant"
        description="Summarise consolidated orders, identify top requested products, review pending deliveries and support stock planning."
      />
    </RoleDashboardShell>
  );
}
