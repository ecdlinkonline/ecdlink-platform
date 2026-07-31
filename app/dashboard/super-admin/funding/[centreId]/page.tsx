import { notFound } from "next/navigation";
import { RoleDashboardShell } from "@/components/app-shell/role-dashboard-shell";
import { FundingReviewWorkspace } from "@/components/funding/funding-review-workspace";
import { getFundingReviewWorkspaceFromDb } from "@/lib/repositories/funding";

type FundingReviewPageProps = {
  params: Promise<{ centreId: string }>;
};

export default async function FundingReviewPage({ params }: FundingReviewPageProps) {
  const { centreId } = await params;
  const data = await getFundingReviewWorkspaceFromDb(centreId);

  if (!data) notFound();

  return (
    <RoleDashboardShell role="super_admin">
      <FundingReviewWorkspace data={data} />
    </RoleDashboardShell>
  );
}
