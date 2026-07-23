import { notFound } from "next/navigation";
import { RoleDashboardShell } from "@/components/app-shell/role-dashboard-shell";
import { CentreComplianceView } from "@/components/compliance/centre-compliance-view";
import { getCurrentCentreCompliance } from "@/lib/compliance/api";

export default async function CentreCompliancePage() {
  const record = await getCurrentCentreCompliance();
  if (!record) notFound();

  return (
    <RoleDashboardShell role="ecd_centre">
      <CentreComplianceView record={record} />
    </RoleDashboardShell>
  );
}
