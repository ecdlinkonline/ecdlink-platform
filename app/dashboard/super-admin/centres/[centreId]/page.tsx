export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { RoleDashboardShell } from "@/components/app-shell/role-dashboard-shell";
import { UnifiedCentreProfileView } from "@/components/centre-360/unified-centre-profile";
import { getUnifiedCentreProfile } from "@/lib/centre-360/api";

export default async function CentreProfilePage({
  params
}: {
  params: Promise<{ centreId: string }>;
}) {
  const { centreId } = await params;
  const profile = await getUnifiedCentreProfile(centreId);

  if (!profile) {
    notFound();
  }

  return (
    <RoleDashboardShell role="super_admin">
      <UnifiedCentreProfileView profile={profile} />
    </RoleDashboardShell>
  );
}

