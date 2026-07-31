export const dynamic = "force-dynamic";

import { CentreEditForm } from "@/components/centres/centre-edit-form";
import { RoleDashboardShell } from "@/components/app-shell/role-dashboard-shell";
import { getCurrentUserCentre } from "@/lib/centres/api";

export default async function EditMyCentrePage() {
  const centre = await getCurrentUserCentre();

  return (
    <RoleDashboardShell role="ecd_centre">
      <CentreEditForm centre={centre} mode="centre" />
    </RoleDashboardShell>
  );
}

