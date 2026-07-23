import { impactCentres, impactProjects, partnerMessages, partnerOrganisations, partnershipRequests, projectCategories } from "@/lib/donor/data";
import { hasDatabaseConfig } from "@/lib/db/env";
import { getDonorReportsFromDb, getImpactProjectFromDb, listImpactCentresFromDb, listImpactProjectsFromDb, listPartnerMessagesFromDb, listPartnersFromDb, listPartnershipRequestsFromDb } from "@/lib/repositories/donors";
import type { DonorReport, PartnerType, ProjectCategory, ProjectStatus } from "@/lib/donor/types";

export async function listImpactCentres(filters: { query?: string; province?: string; need?: ProjectCategory | "All" } = {}) {
  if (hasDatabaseConfig()) return listImpactCentresFromDb(filters);

  const query = filters.query?.trim().toLowerCase() ?? "";
  return impactCentres.filter((centre) => {
    const search = [centre.name, centre.location, centre.registrationStatus, centre.membershipStatus, centre.currentNeeds.join(" ")].join(" ").toLowerCase();
    return (!query || search.includes(query)) && (!filters.province || filters.province === "All" || centre.province === filters.province) && (!filters.need || filters.need === "All" || centre.currentNeeds.includes(filters.need));
  });
}

export async function listImpactProjects(filters: { query?: string; category?: ProjectCategory | "All"; status?: ProjectStatus | "All"; province?: string } = {}) {
  if (hasDatabaseConfig()) return listImpactProjectsFromDb(filters);

  const query = filters.query?.trim().toLowerCase() ?? "";
  return impactProjects.filter((project) => {
    const search = [project.title, project.centreName, project.category, project.province, project.description].join(" ").toLowerCase();
    return (!query || search.includes(query)) && (!filters.category || filters.category === "All" || project.category === filters.category) && (!filters.status || filters.status === "All" || project.status === filters.status) && (!filters.province || filters.province === "All" || project.province === filters.province);
  });
}

export async function getImpactProject(projectId: string) {
  if (hasDatabaseConfig()) return getImpactProjectFromDb(projectId);

  return impactProjects.find((project) => project.id === projectId) ?? null;
}

export async function listPartners(filters: { type?: PartnerType | "All"; query?: string } = {}) {
  if (hasDatabaseConfig()) return listPartnersFromDb(filters);

  const query = filters.query?.trim().toLowerCase() ?? "";
  return partnerOrganisations.filter((partner) => (!query || [partner.name, partner.type, partner.contactPerson, partner.focusAreas.join(" ")].join(" ").toLowerCase().includes(query)) && (!filters.type || filters.type === "All" || partner.type === filters.type));
}

export async function listPartnershipRequests() {
  if (hasDatabaseConfig()) return listPartnershipRequestsFromDb();

  return partnershipRequests;
}

export async function listPartnerMessages() {
  if (hasDatabaseConfig()) return listPartnerMessagesFromDb();

  return partnerMessages;
}

export async function getDonorReports(): Promise<DonorReport> {
  if (hasDatabaseConfig()) return getDonorReportsFromDb();

  const categoryCounts = projectCategories.map((category) => ({ label: category, value: impactProjects.filter((project) => project.category === category).length }));
  const provinces = Array.from(new Set(impactCentres.map((centre) => centre.province)));
  return {
    totalVerifiedCentres: impactCentres.length,
    centresNeedingSupport: impactCentres.filter((centre) => centre.activeProjectCount > 0).length,
    activeProjects: impactProjects.filter((project) => project.status === "Active" || project.status === "Featured").length,
    totalImpact: impactProjects.reduce((sum, project) => sum + project.budget, 0),
    childrenReached: impactCentres.reduce((sum, centre) => sum + centre.children, 0),
    topViewedCentres: impactCentres.slice(0, 8).map((centre, index) => ({ label: centre.name, value: 240 - index * 17 })),
    mostFundedCategories: categoryCounts,
    projectsByProvince: provinces.map((province) => ({ label: province, value: impactProjects.filter((project) => project.province === province).length })),
    fundingPipeline: impactProjects.slice(0, 8).map((project) => ({ label: project.category, value: project.budget })),
    corporateEngagement: partnerOrganisations.filter((partner) => partner.type === "Corporate Social Investment (CSI)").map((partner) => ({ label: partner.name, value: partner.engagementScore }))
  };
}
