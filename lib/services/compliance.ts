import { prisma } from "@/lib/db/prisma";
import { complianceDocumentInclude, mapComplianceDocument, statusToDb } from "@/lib/repositories/compliance";
import type { ComplianceDocumentUploadInput } from "@/lib/validators/compliance";

export class ComplianceServiceError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const reminderWindows = [90, 60, 30] as const;

function date(value?: string) {
  return value ? new Date(value) : undefined;
}

function documentStatusForExpiry(expiryDate?: Date | null) {
  if (!expiryDate) return "UPLOADED";
  const now = new Date();
  const days = Math.ceil((expiryDate.getTime() - now.getTime()) / 86_400_000);
  if (days < 0) return "EXPIRED";
  if (days <= 90) return "EXPIRING_SOON";
  return "UPLOADED";
}

async function assertRequirementAllowsFile(requirementId: string, file: ComplianceDocumentUploadInput["file"]) {
  const requirement = await prisma.complianceRequirement.findUnique({ where: { id: requirementId } });
  if (!requirement || !requirement.active) throw new ComplianceServiceError("Compliance requirement not found.", 404);
  if (requirement.acceptedFileTypes.length > 0 && !requirement.acceptedFileTypes.includes(file.mimeType)) {
    throw new ComplianceServiceError("File type is not accepted for this requirement.", 422);
  }
  if (requirement.maxFileSize && file.fileSize > requirement.maxFileSize) {
    throw new ComplianceServiceError("File size exceeds the allowed limit.", 422);
  }
  return requirement;
}

export async function uploadComplianceDocumentMetadata(centreId: string, input: ComplianceDocumentUploadInput, actorUserId?: string) {
  const requirement = await assertRequirementAllowsFile(input.requirementId, input.file);
  const expiryDate = date(input.expiryDate);
  const status = documentStatusForExpiry(expiryDate);

  const document = await prisma.$transaction(async (tx) => {
    const file = await tx.fileAsset.create({
      data: {
        storageProvider: input.file.storageProvider,
        storageKey: input.file.storageKey,
        originalFilename: input.file.originalFilename,
        mimeType: input.file.mimeType,
        fileSize: input.file.fileSize,
        checksum: input.file.checksum,
        uploadedByUserId: actorUserId
      }
    });

    const created = await tx.complianceDocument.create({
      data: {
        centreId,
        requirementId: requirement.id,
        fileId: file.id,
        documentType: requirement.name ?? requirement.type,
        documentNumber: input.documentNumber,
        issueDate: date(input.issueDate),
        expiryDate,
        status,
        verificationStatus: "PENDING_REVIEW",
        submittedByUserId: actorUserId,
        submittedAt: new Date(),
        adminNotes: input.adminNotes,
        reminderDate: expiryDate
      },
      include: complianceDocumentInclude
    });

    await tx.notification.create({ data: { centreId, title: "Document Uploaded", body: `${created.documentType} is awaiting ECDLink review.` } });
    await tx.auditLog.create({ data: { actorUserId, action: "compliance.document.upload", entityType: "ComplianceDocument", entityId: created.id, after: JSON.parse(JSON.stringify(created)), metadata: { centreId, requirementId: requirement.id } } });
    return created;
  });

  return mapComplianceDocument(document);
}

export async function updateComplianceDocument(documentId: string, input: { documentNumber?: string; issueDate?: string; expiryDate?: string; adminNotes?: string }, actorUserId?: string) {
  const before = await prisma.complianceDocument.findUnique({ where: { id: documentId } });
  if (!before) throw new ComplianceServiceError("Compliance document not found.", 404);
  const expiryDate = input.expiryDate ? new Date(input.expiryDate) : before.expiryDate;
  const after = await prisma.$transaction(async (tx) => {
    const document = await tx.complianceDocument.update({
      where: { id: documentId },
      data: {
        documentNumber: input.documentNumber,
        issueDate: input.issueDate ? new Date(input.issueDate) : undefined,
        expiryDate: input.expiryDate ? new Date(input.expiryDate) : undefined,
        status: before.status === "VERIFIED" ? "VERIFIED" : documentStatusForExpiry(expiryDate),
        adminNotes: input.adminNotes
      },
      include: complianceDocumentInclude
    });
    await tx.auditLog.create({ data: { actorUserId, action: "compliance.document.update", entityType: "ComplianceDocument", entityId: documentId, before, after: JSON.parse(JSON.stringify(document)) } });
    return document;
  });
  return mapComplianceDocument(after);
}

export async function verifyComplianceDocument(documentId: string, notes?: string, actorUserId?: string) {
  const before = await prisma.complianceDocument.findUnique({ where: { id: documentId } });
  if (!before) throw new ComplianceServiceError("Compliance document not found.", 404);
  const after = await prisma.$transaction(async (tx) => {
    const document = await tx.complianceDocument.update({
      where: { id: documentId },
      data: { status: "VERIFIED", verificationStatus: "VERIFIED", verifiedByUserId: actorUserId, verifiedAt: new Date(), adminNotes: notes ?? before.adminNotes, rejectionReason: null },
      include: complianceDocumentInclude
    });
    await tx.notification.create({ data: { centreId: document.centreId, title: "Document Verified", body: `${document.documentType} has been verified.` } });
    await tx.auditLog.create({ data: { actorUserId, action: "compliance.document.verify", entityType: "ComplianceDocument", entityId: documentId, before, after: JSON.parse(JSON.stringify(document)) } });
    return document;
  });
  return mapComplianceDocument(after);
}

export async function rejectComplianceDocument(documentId: string, reason: string, actorUserId?: string) {
  const before = await prisma.complianceDocument.findUnique({ where: { id: documentId } });
  if (!before) throw new ComplianceServiceError("Compliance document not found.", 404);
  const after = await prisma.$transaction(async (tx) => {
    const document = await tx.complianceDocument.update({
      where: { id: documentId },
      data: { status: "REJECTED", verificationStatus: "REJECTED", rejectedByUserId: actorUserId, rejectedAt: new Date(), rejectionReason: reason },
      include: complianceDocumentInclude
    });
    await tx.notification.create({ data: { centreId: document.centreId, title: "Document Rejected", body: `${document.documentType} was rejected: ${reason}` } });
    await tx.auditLog.create({ data: { actorUserId, action: "compliance.document.reject", entityType: "ComplianceDocument", entityId: documentId, before, after: JSON.parse(JSON.stringify(document)), metadata: { reason } } });
    return document;
  });
  return mapComplianceDocument(after);
}

export async function requestComplianceResubmission(documentId: string, reason: string, actorUserId?: string) {
  const before = await prisma.complianceDocument.findUnique({ where: { id: documentId } });
  if (!before) throw new ComplianceServiceError("Compliance document not found.", 404);
  const after = await prisma.$transaction(async (tx) => {
    const document = await tx.complianceDocument.update({
      where: { id: documentId },
      data: { verificationStatus: "REQUIRES_RESUBMISSION", rejectionReason: reason },
      include: complianceDocumentInclude
    });
    await tx.notification.create({ data: { centreId: document.centreId, title: "Resubmission Requested", body: `${document.documentType}: ${reason}` } });
    await tx.auditLog.create({ data: { actorUserId, action: "compliance.document.resubmission.request", entityType: "ComplianceDocument", entityId: documentId, before, after: JSON.parse(JSON.stringify(document)), metadata: { reason } } });
    return document;
  });
  return mapComplianceDocument(after);
}

export async function archiveComplianceDocument(documentId: string, actorUserId?: string) {
  const before = await prisma.complianceDocument.findUnique({ where: { id: documentId } });
  if (!before) throw new ComplianceServiceError("Compliance document not found.", 404);
  const after = await prisma.$transaction(async (tx) => {
    const document = await tx.complianceDocument.update({
      where: { id: documentId },
      data: { archivedAt: new Date(), status: "REJECTED" },
      include: complianceDocumentInclude
    });
    await tx.auditLog.create({ data: { actorUserId, action: "compliance.document.archive", entityType: "ComplianceDocument", entityId: documentId, before, after: JSON.parse(JSON.stringify(document)) } });
    return document;
  });
  return mapComplianceDocument(after);
}

export async function replaceComplianceDocument(documentId: string, input: ComplianceDocumentUploadInput, actorUserId?: string) {
  const before = await prisma.complianceDocument.findUnique({ where: { id: documentId } });
  if (!before) throw new ComplianceServiceError("Compliance document not found.", 404);
  const replacement = await uploadComplianceDocumentMetadata(before.centreId, input, actorUserId);
  await prisma.complianceDocument.update({ where: { id: documentId }, data: { replacementDocumentId: replacement.id, archivedAt: new Date() } });
  await prisma.auditLog.create({ data: { actorUserId, action: "compliance.document.replace", entityType: "ComplianceDocument", entityId: documentId, metadata: { replacementDocumentId: replacement.id } } });
  return replacement;
}

export async function runComplianceReminders(actorUserId?: string) {
  const now = new Date();
  const documents = await prisma.complianceDocument.findMany({ where: { archivedAt: null, expiryDate: { not: null } } });
  let created = 0;
  for (const document of documents) {
    const days = Math.ceil((document.expiryDate!.getTime() - now.getTime()) / 86_400_000);
    const window = reminderWindows.find((item) => days <= item && days > item - 7);
    if (!window && days >= 0) continue;
    const title = days < 0 ? "Document Expired" : `Document Expiring in ${window} Days`;
    const existing = await prisma.notification.findFirst({ where: { centreId: document.centreId, title, body: { contains: document.id } } });
    if (existing) continue;
    await prisma.notification.create({ data: { centreId: document.centreId, title, body: `${document.id}: ${document.documentType}` } });
    created += 1;
  }
  await prisma.auditLog.create({ data: { actorUserId, action: "compliance.reminders.run", entityType: "ComplianceDocument", metadata: { created } } });
  return { created };
}

export async function createOrUpdateComplianceRequirement(input: {
  name: string;
  code?: string;
  description?: string;
  category?: string;
  required?: boolean;
  requiresExpiryDate?: boolean;
  acceptedFileTypes?: string[];
  maxFileSize?: number;
  active?: boolean;
  displayOrder?: number;
}, actorUserId?: string) {
  const requirement = await prisma.complianceRequirement.upsert({
    where: { code: input.code ?? input.name.toUpperCase().replace(/[^A-Z0-9]+/g, "_") },
    update: { ...input, type: input.name },
    create: { ...input, type: input.name, code: input.code ?? input.name.toUpperCase().replace(/[^A-Z0-9]+/g, "_") }
  });
  await prisma.auditLog.create({ data: { actorUserId, action: "compliance.requirement.upsert", entityType: "ComplianceRequirement", entityId: requirement.id, after: JSON.parse(JSON.stringify(requirement)) } });
  return requirement;
}
