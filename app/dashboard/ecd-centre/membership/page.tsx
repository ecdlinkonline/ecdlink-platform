export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { RoleDashboardShell } from "@/components/app-shell/role-dashboard-shell";
import { CentreMembershipView } from "@/components/membership/centre-membership-view";
import { getCurrentCentreMembership } from "@/lib/membership/api";

export default async function CentreMembershipPage() {
  const membership = await getCurrentCentreMembership();

  if (!membership) {
    notFound();
  }

  return (
    <RoleDashboardShell role="ecd_centre">
      <CentreMembershipView membership={membership} />
    </RoleDashboardShell>
  );
}

