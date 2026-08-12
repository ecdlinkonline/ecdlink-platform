import { notFound } from "next/navigation";
import { RoleDashboardShell } from "@/components/app-shell/role-dashboard-shell";
import { FundingPartnerCalls } from "@/components/funding/funding-partner-portal";
import { getFundingPartnerDashboard } from "@/lib/dashboard/funding-partner-dashboard";

export const dynamic = "force-dynamic";

export default async function FundingPartnerCallsPage() {
  const result = await getFundingPartnerDashboard();
  if (!result) notFound();
  return <RoleDashboardShell role="funding_partner"><FundingPartnerCalls data={result.data} /></RoleDashboardShell>;
}
