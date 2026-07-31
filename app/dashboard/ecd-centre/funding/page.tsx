export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { RoleDashboardShell } from "@/components/app-shell/role-dashboard-shell";
import { CentreFundingView } from "@/components/funding/centre-funding-view";
import { getCurrentCentreFundingReadiness } from "@/lib/funding/api";

export default async function CentreFundingPage() {
  const record = await getCurrentCentreFundingReadiness();
  if (!record) notFound();

  return (
    <RoleDashboardShell role="ecd_centre">
      <CentreFundingView record={record} />
    </RoleDashboardShell>
  );
}

