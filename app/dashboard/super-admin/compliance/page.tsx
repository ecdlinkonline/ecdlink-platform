export const dynamic = "force-dynamic";

import { RoleDashboardShell } from "@/components/app-shell/role-dashboard-shell";
import { AdminComplianceDashboard } from "@/components/compliance/admin-compliance-dashboard";
import { getComplianceReports, listComplianceRecords } from "@/lib/compliance/api";

export default async function AdminCompliancePage() {
  const [records, reports] = await Promise.all([listComplianceRecords(), getComplianceReports()]);

  return (
    <RoleDashboardShell role="super_admin">
      <AdminComplianceDashboard records={records} reports={reports} />
    </RoleDashboardShell>
  );
}

