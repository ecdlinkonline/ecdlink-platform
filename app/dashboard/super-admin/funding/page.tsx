export const dynamic = "force-dynamic";

import { RoleDashboardShell } from "@/components/app-shell/role-dashboard-shell";
import { AdminFundingDashboard } from "@/components/funding/admin-funding-dashboard";
import { getFundingDashboard } from "@/lib/dashboard/funding-dashboard";
import { getFundingReports, listFundingReadinessRecords } from "@/lib/funding/api";

export default async function AdminFundingPage() {
  const [records, reports, dashboard] = await Promise.all([
    listFundingReadinessRecords(),
    getFundingReports(),
    getFundingDashboard(),
  ]);

  return (
    <RoleDashboardShell role="super_admin">
      <AdminFundingDashboard
        records={records}
        reports={{
          ...reports,
          totalCentres: dashboard.centresTracked,
          averageReadiness: dashboard.averageReadiness,
          submittedCount: dashboard.submittedApplications,
          approvedCount: dashboard.approvedApplications,
          totalRequested: dashboard.totalRequestedAmount,
        }}
      />
    </RoleDashboardShell>
  );
}

