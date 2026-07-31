export const dynamic = "force-dynamic";

import { EcdlinkStaffShell } from "@/components/ecdlink-staff/ecdlink-staff-shell";
import { StaffDashboard } from "@/components/ecdlink-staff/staff-dashboard";
import { requireEcdlinkStaff } from "@/lib/auth/permissions";
import { getStaffDashboardData } from "@/lib/ecdlink-staff/dashboard";

export default async function EcdlinkStaffDashboardPage() {
  const { staffProfile } = await requireEcdlinkStaff();
  const data = await getStaffDashboardData(staffProfile.id);

  return (
    <EcdlinkStaffShell>
      <StaffDashboard data={data} />
    </EcdlinkStaffShell>
  );
}

