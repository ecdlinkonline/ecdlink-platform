import { getAuthContext } from "@/lib/auth/session";
import { hasDatabaseConfig } from "@/lib/db/env";
import { complianceDocumentTypes, complianceRecords } from "@/lib/compliance/data";
import type { CentreComplianceRecord, ComplianceDocumentStatus, ComplianceFilters, ComplianceReport } from "@/lib/compliance/types";
import { getInternalUserByClerkId } from "@/lib/repositories/users";
import {
  getComplianceRecordByCentreIdFromDb,
  getComplianceReportsFromDb,
  listComplianceRecordsFromDb,
  listComplianceRequirementsFromDb
} from "@/lib/repositories/compliance";

function filterFallback(filters: ComplianceFilters = {}) {
  const query = filters.query?.trim().toLowerCase() ?? "";

  return complianceRecords.filter((record) => {
    const searchable = [
      record.centreName,
      record.region,
      record.area,
      record.contactPerson,
      record.scoreLight,
      ...record.documents.map((document) => `${document.type} ${document.status}`)
    ].join(" ").toLowerCase();

    return (
      (!query || searchable.includes(query)) &&
      (!filters.region || filters.region === "All" || record.region === filters.region) &&
      (!filters.scoreLight || filters.scoreLight === "All" || record.scoreLight === filters.scoreLight) &&
      (!filters.documentStatus || filters.documentStatus === "All" || record.documents.some((document) => document.status === filters.documentStatus))
    );
  });
}

function fallbackReport(records: CentreComplianceRecord[]): ComplianceReport {
  const documents = records.flatMap((record) => record.documents);
  const countStatus = (status: ComplianceDocumentStatus) => documents.filter((document) => document.status === status).length;
  const regions = Array.from(new Set(records.map((record) => record.region)));

  return {
    totalCentres: records.length,
    greenCount: records.filter((record) => record.scoreLight === "Green").length,
    amberCount: records.filter((record) => record.scoreLight === "Amber").length,
    redCount: records.filter((record) => record.scoreLight === "Red").length,
    verifiedDocuments: countStatus("Verified"),
    missingDocuments: countStatus("Missing"),
    expiredDocuments: countStatus("Expired"),
    expiringSoonDocuments: countStatus("Expiring Soon"),
    scoreBreakdown: ["Green", "Amber", "Red"].map((light) => ({ label: light, value: records.filter((record) => record.scoreLight === light).length })),
    documentStatusBreakdown: ["Verified", "Uploaded", "Expiring Soon", "Missing", "Expired", "Rejected"].map((status) => ({ label: status, value: countStatus(status as ComplianceDocumentStatus) })),
    regionalReadiness: regions.map((region) => {
      const regional = records.filter((record) => record.region === region);
      return { label: region, value: Math.round(regional.reduce((sum, record) => sum + record.score, 0) / Math.max(regional.length, 1)) };
    })
  };
}

export async function listComplianceRecords(filters: ComplianceFilters = {}) {
  if (hasDatabaseConfig()) return listComplianceRecordsFromDb(filters);
  return filterFallback(filters);
}

export async function getComplianceByCentreId(centreId: string) {
  if (hasDatabaseConfig()) return getComplianceRecordByCentreIdFromDb(centreId);
  return complianceRecords.find((record) => record.centreId === centreId) ?? null;
}

export async function getCurrentCentreCompliance() {
  if (hasDatabaseConfig()) {
    const authContext = await getAuthContext();
    if (!authContext) return null;
    if (authContext.role === "super_admin") return getComplianceRecordByCentreIdFromDb("little-stars-ecd");
    const user = await getInternalUserByClerkId(authContext.userId);
    const centreId = user?.centreUsers[0]?.centreId;
    return centreId ? getComplianceRecordByCentreIdFromDb(centreId) : null;
  }
  return getComplianceByCentreId("little-stars-ecd");
}

export async function getComplianceReports(): Promise<ComplianceReport> {
  if (hasDatabaseConfig()) return getComplianceReportsFromDb();
  return fallbackReport(complianceRecords);
}

export async function getComplianceDocumentTypes() {
  if (hasDatabaseConfig()) {
    const requirements = await listComplianceRequirementsFromDb();
    return requirements.map((requirement) => requirement.name ?? requirement.type);
  }
  return complianceDocumentTypes;
}

export async function createDocumentUploadPlaceholder(record: CentreComplianceRecord, documentType: string) {
  return {
    centreId: record.centreId,
    documentType,
    status: "Upload placeholder created" as const,
    storage: "Future secure document storage integration"
  };
}
