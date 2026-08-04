import { notFound } from "next/navigation";
import { RoleDashboardShell } from "@/components/app-shell/role-dashboard-shell";
import { FundingReviewWorkspace } from "@/components/funding/funding-review-workspace";
import { getFundingPartnerAccess } from "@/lib/funding/partner-access";
import { getFundingPartnerReviewWorkspaceByApplicationIdFromDb } from "@/lib/repositories/funding";

export default async function FundingPartnerApplicationPage({ params }: { params: Promise<{ applicationId: string }> }) {
  const [{ applicationId }, access] = await Promise.all([params, getFundingPartnerAccess()]);
  if (!access) notFound();
  const data = await getFundingPartnerReviewWorkspaceByApplicationIdFromDb(applicationId, access);
  if (!data) notFound();
  return <RoleDashboardShell role="funding_partner"><FundingReviewWorkspace data={data} backHref="/dashboard/funding-partner/applications" /></RoleDashboardShell>;
}
