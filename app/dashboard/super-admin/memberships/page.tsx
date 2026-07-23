import { RoleDashboardShell } from "@/components/app-shell/role-dashboard-shell";
import { AdminMembershipDashboard } from "@/components/membership/admin-membership-dashboard";
import { getMembershipReports, listMemberships } from "@/lib/membership/api";

export default async function AdminMembershipsPage() {
  const [memberships, reports] = await Promise.all([listMemberships(), getMembershipReports()]);

  return (
    <RoleDashboardShell role="super_admin">
      <AdminMembershipDashboard memberships={memberships} reports={reports} />
    </RoleDashboardShell>
  );
}
