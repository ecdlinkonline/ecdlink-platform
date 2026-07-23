import { RoleDashboardShell } from "@/components/app-shell/role-dashboard-shell";
import { AdminFundingDashboard } from "@/components/funding/admin-funding-dashboard";
import { getFundingReports, listFundingReadinessRecords } from "@/lib/funding/api";

export default async function AdminFundingPage() {
  const [records, reports] = await Promise.all([listFundingReadinessRecords(), getFundingReports()]);

  return (
    <RoleDashboardShell role="super_admin">
      <AdminFundingDashboard records={records} reports={reports} />
    </RoleDashboardShell>
  );
}
