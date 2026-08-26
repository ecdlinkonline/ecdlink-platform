import { notFound, redirect } from "next/navigation";
import { RoleDashboardShell } from "@/components/app-shell/role-dashboard-shell";
import { FundingReviewWorkspace } from "@/components/funding/funding-review-workspace";
import { getFundingReviewWorkspaceFromDb } from "@/lib/repositories/funding";
import { requireInternalUser } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

type FundingReviewPageProps = {
  params: Promise<{ centreId: string }>;
};

export default async function FundingReviewPage({ params }: FundingReviewPageProps) {
  const { centreId } = await params;
  const { authContext, internalUser } = await requireInternalUser();
  if (!authContext.role || !["super_admin", "funding_partner"].includes(authContext.role)) redirect("/dashboard");
  const data = await getFundingReviewWorkspaceFromDb(centreId, { actorUserId: internalUser.id, superAdmin: authContext.role === "super_admin", fundingOrganisationIds: internalUser.fundingUsers.map((membership) => membership.fundingOrganisationId) });

  if (!data) notFound();

  return (
    <RoleDashboardShell role={authContext.role}>
      <FundingReviewWorkspace data={data} backHref={authContext.role === "funding_partner" ? "/dashboard/funding-partner" : "/dashboard/super-admin/funding"} />
    </RoleDashboardShell>
  );
}
