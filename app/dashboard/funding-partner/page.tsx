import { notFound } from "next/navigation";
import { RoleDashboardShell } from "@/components/app-shell/role-dashboard-shell";
import { FundingPartnerDashboard } from "@/components/funding/funding-partner-portal";
import { getFundingPartnerDashboard } from "@/lib/dashboard/funding-partner-dashboard";

export const dynamic = "force-dynamic";

export default async function FundingPartnerDashboardPage() {
  const result = await getFundingPartnerDashboard();
  if (!result) notFound();
  return (
    <RoleDashboardShell role="funding_partner">
      <FundingPartnerDashboard data={result.data} />
    </RoleDashboardShell>
  );
}
