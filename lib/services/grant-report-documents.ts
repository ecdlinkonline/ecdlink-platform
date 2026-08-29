import "server-only";
import { prisma } from "@/lib/db/prisma";
import { storage } from "@/lib/storage/storage-service";
import type { SignedFileAccess } from "@/lib/storage/types";
import { defaultDocumentPolicy, type StorageUploadFile } from "@/lib/storage/validation";
import { GrantReportingServiceError, requireMutableGrantReport } from "@/lib/services/grant-reports";
import type { UploadGrantReportDocumentInput } from "@/lib/validators/grant-reports";

export const grantReportDocumentPolicy = defaultDocumentPolicy;

export async function uploadGrantReportDocument(input: {
  reportId: string;
  actorUserId: string;
  file: StorageUploadFile;
  metadata: UploadGrantReportDocumentInput;
}) {
  const initial = await prisma.$transaction((tx) => requireMutableGrantReport(tx, input.reportId));
  if (input.metadata.documentType === "AUDITED_FINANCIAL_STATEMENTS" && initial.version.reportType !== "FINAL") {
    throw new GrantReportingServiceError("Audited financial statements are only available for Final reports.", 422);
  }
  const file = await storage.uploadFileAsset({
    file: input.file,
    module: "funding",
    ownerId: input.actorUserId,
    entityId: initial.version.id,
    uploadedByUserId: input.actorUserId,
    policy: grantReportDocumentPolicy,
  });
  try {
    return await prisma.$transaction(async (tx) => {
      const current = await requireMutableGrantReport(tx, input.reportId);
      if (current.version.id !== initial.version.id) throw new GrantReportingServiceError("The current report version changed before the upload completed.", 409);
      if (input.metadata.indicatorId) {
        const indicator = await tx.grantReportIndicator.findFirst({ where: { id: input.metadata.indicatorId, grantReportVersionId: current.version.id }, select: { id: true } });
        if (!indicator) throw new GrantReportingServiceError("The selected indicator does not belong to this report version.", 422);
      }
      if (input.metadata.documentType === "INDICATOR_EVIDENCE" && !input.metadata.indicatorId) throw new GrantReportingServiceError("Indicator evidence must be linked to an indicator.", 422);
      const document = await tx.grantReportDocument.create({
        data: {
          grantReportVersionId: current.version.id,
          indicatorId: input.metadata.indicatorId,
          fileAssetId: file.id,
          documentType: input.metadata.documentType,
          title: input.metadata.title,
          description: input.metadata.description,
          originalFilenameSnapshot: file.originalFilename,
          mimeTypeSnapshot: file.mimeType,
          fileSizeSnapshot: file.fileSize,
          checksumSnapshot: file.checksum,
          uploadedByUserId: input.actorUserId,
        },
        select: { id: true, documentType: true, title: true, fileAssetId: true, uploadedAt: true },
      });
      await tx.auditLog.create({ data: { actorUserId: input.actorUserId, action: "grant.report.document.uploaded", entityType: "GrantReportDocument", entityId: document.id, metadata: { reportId: input.reportId, grantReportVersionId: current.version.id, fileAssetId: file.id, documentType: document.documentType } } });
      return document;
    });
  } catch (error) {
    try {
      await storage.rollbackStagedFileAsset({ fileAssetId: file.id, uploadedByUserId: input.actorUserId, module: "funding", ownerId: input.actorUserId, entityId: initial.version.id });
    } catch {
      console.error("Grant report document rollback failed after report persistence failure.", { fileAssetId: file.id });
    }
    throw error;
  }
}

async function loadGrantReportDocument(reportId: string, documentId: string) {
  const document = await prisma.grantReportDocument.findFirst({
    where: { id: documentId, version: { report: { id: reportId } } },
    select: { id: true, fileAssetId: true },
  });
  if (!document) throw new GrantReportingServiceError("Grant report document not found.", 404);
  return document;
}

export async function getGrantReportDocumentPreview(input: { reportId: string; documentId: string; actorUserId: string }): Promise<SignedFileAccess> {
  const document = await loadGrantReportDocument(input.reportId, input.documentId);
  return storage.createPreviewAccess({ fileAssetId: document.fileAssetId, context: { actorUserId: input.actorUserId, module: "funding", entityId: input.reportId } });
}

export async function getGrantReportDocumentDownload(input: { reportId: string; documentId: string; actorUserId: string }): Promise<SignedFileAccess> {
  const document = await loadGrantReportDocument(input.reportId, input.documentId);
  return storage.createDownloadAccess({ fileAssetId: document.fileAssetId, context: { actorUserId: input.actorUserId, module: "funding", entityId: input.reportId } });
}
