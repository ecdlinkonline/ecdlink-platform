import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { CentreComplianceRecord, ComplianceDocumentRecord, ComplianceDocumentStatus, ComplianceReport, ComplianceScoreLight, ComplianceVerificationStatus } from "@/lib/compliance/types";
import { getScoreLight } from "@/lib/compliance/format";

export const complianceDocumentInclude = {
  requirement: true,
  file: true,
  centre: true
};

type ComplianceDocumentWithRelations = Prisma.ComplianceDocumentGetPayload<{ include: typeof complianceDocumentInclude }>;
type CentreWithDocuments = Prisma.EcdCentreGetPayload<{ include: { complianceDocuments: { include: typeof complianceDocumentInclude } } }>;

const statusFromDb: Record<string, ComplianceDocumentStatus> = {
  MISSING: "Missing",
  UPLOADED: "Uploaded",
  EXPIRING_SOON: "Expiring Soon",
  EXPIRED: "Expired",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
  ARCHIVED: "Archived"
};

const statusToDb: Record<string, "MISSING" | "UPLOADED" | "EXPIRING_SOON" | "EXPIRED" | "VERIFIED" | "REJECTED"> = {
  Missing: "MISSING",
  Uploaded: "UPLOADED",
  "Expiring Soon": "EXPIRING_SOON",
  Expired: "EXPIRED",
  Verified: "VERIFIED",
  Rejected: "REJECTED",
  Archived: "REJECTED"
};

const verificationFromDb: Record<string, ComplianceVerificationStatus> = {
  PENDING: "Pending Review",
  PENDING_REVIEW: "Pending Review",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
  REQUIRES_RESUBMISSION: "Requires Resubmission"
};

export function mapComplianceDocument(document: ComplianceDocumentWithRelations): ComplianceDocumentRecord {
  const status = document.archivedAt ? "Archived" : statusFromDb[document.status] ?? "Missing";
  return {
    id: document.id,
    requirementId: document.requirementId,
    type: (document.requirement?.name ?? document.documentType) as ComplianceDocumentRecord["type"],
    status,
    verificationStatus: verificationFromDb[document.verificationStatus] ?? "Pending Review",
    documentNumber: document.documentNumber,
    issueDate: document.issueDate?.toISOString() ?? null,
    expiryDate: document.expiryDate?.toISOString() ?? null,
    uploadedAt: document.createdAt?.toISOString() ?? null,
    submittedAt: document.submittedAt?.toISOString() ?? null,
    fileName: document.file?.originalFilename ?? null,
    fileAssetId: document.fileId ?? null,
    verificationNote: document.rejectionReason ?? document.adminNotes ?? (status === "Verified" ? "Verified by ECDLink compliance desk." : "Awaiting compliance review."),
    rejectionReason: document.rejectionReason,
    adminNotes: document.adminNotes,
    reminderDate: document.reminderDate?.toISOString() ?? null,
    replacementDocumentId: document.replacementDocumentId,
    archivedAt: document.archivedAt?.toISOString() ?? null
  };
}

export function scoreComplianceDocuments(documents: ComplianceDocumentRecord[], requiredCount: number) {
  const active = documents.filter((document) => document.status !== "Archived");
  const verified = active.filter((document) => document.status === "Verified").length;
  const pending = active.filter((document) => document.status === "Uploaded").length;
  const missing = active.filter((document) => document.status === "Missing").length;
  const rejected = active.filter((document) => document.status === "Rejected").length;
  const expired = active.filter((document) => document.status === "Expired").length;
  const expiringSoon = active.filter((document) => document.status === "Expiring Soon").length;
  const score = requiredCount > 0 ? Math.round((verified / requiredCount) * 100) : 0;
  let scoreLight: ComplianceScoreLight = getScoreLight(score);
  if (missing > 0 || expired > 0 || rejected > 0 || score < 50) scoreLight = "Red";
  else if (pending > 0 || expiringSoon > 0 || score < 85) scoreLight = "Amber";
  else scoreLight = "Green";

  return { verified, pending, missing, rejected, expired, expiringSoon, score, scoreLight };
}

export function mapCentreComplianceRecord(centre: CentreWithDocuments, requirementCount: number): CentreComplianceRecord {
  const documents = centre.complianceDocuments.map(mapComplianceDocument);
  const score = scoreComplianceDocuments(documents, requirementCount);
  return {
    id: `compliance-${centre.slug}`,
    centreId: centre.id,
    centreName: centre.centreName,
    region: centre.region ?? "Unassigned",
    area: centre.area ?? "Unassigned",
    contactPerson: centre.contactPerson ?? centre.principalName ?? "Not captured",
    score: score.score,
    scoreLight: score.scoreLight,
    totalRequirements: requirementCount,
    verifiedDocuments: score.verified,
    pendingDocuments: score.pending,
    missingDocuments: score.missing,
    rejectedDocuments: score.rejected,
    expiredDocuments: score.expired,
    expiringSoonDocuments: score.expiringSoon,
    nextRequiredAction: score.missing > 0 ? "Upload missing mandatory documents." : score.expired > 0 ? "Replace expired mandatory documents." : score.pending > 0 ? "Awaiting ECDLink review." : "Maintain renewal reminders.",
    documents,
    adminVerificationNotes: Array.from(new Set(documents.map((document) => document.adminNotes ?? document.rejectionReason).filter(Boolean) as string[])).slice(0, 4),
    lastUpdatedAt: centre.updatedAt.toISOString()
  };
}

export async function listComplianceRequirementsFromDb() {
  return prisma.complianceRequirement.findMany({ where: { active: true }, orderBy: [{ displayOrder: "asc" }, { type: "asc" }] });
}

export async function listComplianceRecordsFromDb(filters: { query?: string; region?: string; documentStatus?: string; scoreLight?: string } = {}) {
  const requirements = await listComplianceRequirementsFromDb();
  const query = filters.query?.trim();
  const centres = await prisma.ecdCentre.findMany({
    where: query ? {
      OR: [
        { centreName: { contains: query, mode: "insensitive" } },
        { npoNumber: { contains: query, mode: "insensitive" } },
        { region: { contains: query, mode: "insensitive" } },
        { principalName: { contains: query, mode: "insensitive" } }
      ]
    } : undefined,
    include: { complianceDocuments: { where: { archivedAt: null }, include: complianceDocumentInclude, orderBy: { updatedAt: "desc" } } },
    orderBy: { centreName: "asc" }
  });
  return centres
    .map((centre) => mapCentreComplianceRecord(centre, requirements.length))
    .filter((record) =>
      (!filters.region || filters.region === "All" || record.region === filters.region) &&
      (!filters.scoreLight || filters.scoreLight === "All" || record.scoreLight === filters.scoreLight) &&
      (!filters.documentStatus || filters.documentStatus === "All" || record.documents.some((document) => document.status === filters.documentStatus))
    );
}

export async function getComplianceRecordByCentreIdFromDb(centreId: string) {
  const requirements = await listComplianceRequirementsFromDb();
  const centre = await prisma.ecdCentre.findFirst({
    where: { OR: [{ id: centreId }, { slug: centreId }] },
    include: { complianceDocuments: { where: { archivedAt: null }, include: complianceDocumentInclude, orderBy: { updatedAt: "desc" } } }
  });
  return centre ? mapCentreComplianceRecord(centre, requirements.length) : null;
}

export async function getComplianceDocumentFromDb(documentId: string) {
  const document = await prisma.complianceDocument.findUnique({ where: { id: documentId }, include: complianceDocumentInclude });
  return document ? mapComplianceDocument(document) : null;
}

export async function getComplianceReportsFromDb(): Promise<ComplianceReport> {
  const records = await listComplianceRecordsFromDb();
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
    documentStatusBreakdown: ["Verified", "Uploaded", "Expiring Soon", "Missing", "Expired", "Rejected", "Archived"].map((status) => ({ label: status, value: countStatus(status as ComplianceDocumentStatus) })),
    regionalReadiness: regions.map((region) => {
      const regional = records.filter((record) => record.region === region);
      return { label: region, value: Math.round(regional.reduce((sum, record) => sum + record.score, 0) / Math.max(regional.length, 1)) };
    })
  };
}

export { statusToDb };
