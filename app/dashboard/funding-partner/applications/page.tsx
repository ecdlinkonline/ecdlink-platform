import { notFound } from "next/navigation";
import { RoleDashboardShell } from "@/components/app-shell/role-dashboard-shell";
import { FundingPartnerApplications } from "@/components/funding/funding-partner-portal";
import { getFundingPartnerDashboard } from "@/lib/dashboard/funding-partner-dashboard";

export const dynamic = "force-dynamic";

export default async function FundingPartnerApplicationsPage({ searchParams }: { searchParams: Promise<{ queue?: string }> }) {
  const [result, filters] = await Promise.all([getFundingPartnerDashboard(), searchParams]);
  if (!result) notFound();
  return <RoleDashboardShell role="funding_partner"><FundingPartnerApplications data={result.data} queue={filters.queue} /></RoleDashboardShell>;
}
