import { RoleDashboardShell } from "@/components/app-shell/role-dashboard-shell";
import { AdminPartnerDashboard } from "@/components/donor/admin-partner-dashboard";
import { getDonorReports, listImpactProjects, listPartners, listPartnershipRequests } from "@/lib/donor/api";

export default async function AdminPartnersPage() {
  const [projects, partners, requests, reports] = await Promise.all([listImpactProjects(), listPartners(), listPartnershipRequests(), getDonorReports()]);

  return (
    <RoleDashboardShell role="super_admin">
      <AdminPartnerDashboard projects={projects} partners={partners} requests={requests} reports={reports} />
    </RoleDashboardShell>
  );
}
