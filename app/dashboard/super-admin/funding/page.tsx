export const dynamic = "force-dynamic";

import { RoleDashboardShell } from "@/components/app-shell/role-dashboard-shell";
import { AdminFundingDashboard } from "@/components/funding/admin-funding-dashboard";
import { getFundingDashboard } from "@/lib/dashboard/funding-dashboard";
import { getFundingReports, listFundingReadinessRecords } from "@/lib/funding/api";
import type { FundingFilters } from "@/lib/funding/types";

type AdminFundingPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminFundingPage({ searchParams }: AdminFundingPageProps) {
  const params = await searchParams;
  const filters: FundingFilters = {
    query: firstSearchParam(params.query),
    region: firstSearchParam(params.region),
    status: firstSearchParam(params.status) as FundingFilters["status"],
    funderType: firstSearchParam(params.funderType) as FundingFilters["funderType"],
    readinessBand: firstSearchParam(params.readinessBand) as FundingFilters["readinessBand"],
  };
  const [records, reports, dashboard] = await Promise.all([
    listFundingReadinessRecords(filters),
    getFundingReports(),
    getFundingDashboard(),
  ]);

  return (
    <RoleDashboardShell role="super_admin">
      <AdminFundingDashboard
        records={records}
        filters={filters}
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

