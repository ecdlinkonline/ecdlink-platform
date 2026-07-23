import { CentreProfile } from "@/components/centres/centre-profile";
import { RoleDashboardShell } from "@/components/app-shell/role-dashboard-shell";
import { getCurrentUserCentre } from "@/lib/centres/api";

export default async function MyCentrePage() {
  const centre = await getCurrentUserCentre();

  return (
    <RoleDashboardShell role="ecd_centre">
      <CentreProfile centre={centre} mode="centre" />
    </RoleDashboardShell>
  );
}
