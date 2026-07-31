export const dynamic = "force-dynamic";

import { RoleDashboardShell } from "@/components/app-shell/role-dashboard-shell";
import { DonorTabPage } from "@/components/donor/donor-tab-page";
import { getDonorReports, listImpactCentres, listImpactProjects, listPartnerMessages, listPartners } from "@/lib/donor/api";

export default async function DonorProjectsPage() {
  const [centres, projects, partners, messages, reports] = await Promise.all([listImpactCentres(), listImpactProjects(), listPartners(), listPartnerMessages(), getDonorReports()]);

  return (
    <RoleDashboardShell role="donor">
      <DonorTabPage initialTab="Projects" centres={centres} projects={projects} partners={partners} messages={messages} reports={reports} />
    </RoleDashboardShell>
  );
}

