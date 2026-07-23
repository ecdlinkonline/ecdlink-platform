import { fundingReadinessRecords } from "@/lib/funding/data";
import { getAuthContext } from "@/lib/auth/session";
import { hasDatabaseConfig } from "@/lib/db/env";
import { fundingOpportunityTypes } from "@/lib/funding/format";
import { getFundingReadinessByCentreIdFromDb, getFundingReportsFromDb, listFundingReadinessFromDb } from "@/lib/repositories/funding";
import { getInternalUserByClerkId } from "@/lib/repositories/users";
import type { FundingApplicationStatus, FundingFilters, FundingOpportunityType, FundingReport } from "@/lib/funding/types";

export async function listFundingReadinessRecords(filters: FundingFilters = {}) {
  if (hasDatabaseConfig()) return listFundingReadinessFromDb(filters);

  const query = filters.query?.trim().toLowerCase() ?? "";

  return fundingReadinessRecords.filter((record) => {
    const searchable = [
      record.centreName,
      record.region,
      record.area,
      record.contactPerson,
      record.status,
      record.funderType,
      ...record.projectProfiles.map((project) => `${project.title} ${project.funderType}`)
    ].join(" ").toLowerCase();
    const readinessMatch =
      !filters.readinessBand ||
      filters.readinessBand === "All" ||
      (filters.readinessBand === "80+" && record.readinessScore >= 80) ||
      (filters.readinessBand === "50-79" && record.readinessScore >= 50 && record.readinessScore < 80) ||
      (filters.readinessBand === "Below 50" && record.readinessScore < 50);

    return (
      (!query || searchable.includes(query)) &&
      (!filters.region || filters.region === "All" || record.region === filters.region) &&
      (!filters.status || filters.status === "All" || record.status === filters.status) &&
      (!filters.funderType || filters.funderType === "All" || record.funderType === filters.funderType) &&
      readinessMatch
    );
  });
}

export async function getFundingReadinessByCentreId(centreId: string) {
  if (hasDatabaseConfig()) return getFundingReadinessByCentreIdFromDb(centreId);

  return fundingReadinessRecords.find((record) => record.centreId === centreId) ?? null;
}

export async function getCurrentCentreFundingReadiness() {
  if (hasDatabaseConfig()) {
    const authContext = await getAuthContext();
    if (!authContext) return null;
    const user = await getInternalUserByClerkId(authContext.userId);
    const centreId = user?.centreUsers[0]?.centreId;
    return centreId ? getFundingReadinessByCentreIdFromDb(centreId) : null;
  }

  return getFundingReadinessByCentreId("little-stars-ecd");
}

export async function getFundingReports(): Promise<FundingReport> {
  if (hasDatabaseConfig()) return getFundingReportsFromDb();

  const totalRequested = fundingReadinessRecords.reduce((sum, record) => sum + record.projectProfiles.reduce((inner, project) => inner + project.requestedAmount, 0), 0);
  const averageReadiness = Math.round(fundingReadinessRecords.reduce((sum, record) => sum + record.readinessScore, 0) / fundingReadinessRecords.length);
  const statuses: FundingApplicationStatus[] = ["Draft", "In Progress", "Ready", "Submitted", "Approved", "Rejected"];
  const regions = Array.from(new Set(fundingReadinessRecords.map((record) => record.region)));

  return {
    totalCentres: fundingReadinessRecords.length,
    readyCount: fundingReadinessRecords.filter((record) => record.status === "Ready").length,
    submittedCount: fundingReadinessRecords.filter((record) => record.status === "Submitted").length,
    approvedCount: fundingReadinessRecords.filter((record) => record.status === "Approved").length,
    rejectedCount: fundingReadinessRecords.filter((record) => record.status === "Rejected").length,
    totalRequested,
    averageReadiness,
    statusBreakdown: statuses.map((status) => ({ label: status, value: fundingReadinessRecords.filter((record) => record.status === status).length })),
    funderTypeBreakdown: fundingOpportunityTypes.map((type) => ({ label: type, value: fundingReadinessRecords.filter((record) => record.funderType === type).length })),
    regionalReadiness: regions.map((region) => {
      const records = fundingReadinessRecords.filter((record) => record.region === region);
      return { label: region, value: Math.round(records.reduce((sum, record) => sum + record.readinessScore, 0) / records.length) };
    })
  };
}

export async function getFundingOpportunityTypes() {
  return fundingOpportunityTypes;
}

export async function createProposalBuilderPlaceholder(centreId: string) {
  return {
    centreId,
    status: "Proposal builder placeholder created" as const,
    next: "Future guided proposal editor"
  };
}
