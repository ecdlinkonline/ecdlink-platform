import { notFound } from "next/navigation";
import { RoleDashboardShell } from "@/components/app-shell/role-dashboard-shell";
import { FundingPartnerApprovals } from "@/components/funding/funding-partner-portal";
import { getFundingPartnerDashboard } from "@/lib/dashboard/funding-partner-dashboard";

export default async function FundingPartnerApprovalsPage() {
  const result = await getFundingPartnerDashboard();
  if (!result) notFound();
  return <RoleDashboardShell role="funding_partner"><FundingPartnerApprovals data={result.data} /></RoleDashboardShell>;
}
