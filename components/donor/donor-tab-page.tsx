import { DonorPortal, type DonorTab } from "@/components/donor/donor-portal";
import type { DonorReport, ImpactCentre, ImpactProject, PartnerMessage, PartnerOrganisation } from "@/lib/donor/types";

export function DonorTabPage({
  initialTab,
  centres,
  projects,
  partners,
  messages,
  reports
}: {
  initialTab: DonorTab;
  centres: ImpactCentre[];
  projects: ImpactProject[];
  partners: PartnerOrganisation[];
  messages: PartnerMessage[];
  reports: DonorReport;
}) {
  return <DonorPortal centres={centres} projects={projects} partners={partners} messages={messages} reports={reports} initialTab={initialTab} />;
}
