import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { listGrantReportEvidence } from "@/lib/repositories/grant-report-documents";
import { storage } from "@/lib/storage/storage-service";
import type { SignedFileAccess } from "@/lib/storage/types";
import { defaultDocumentPolicy, type StorageUploadFile } from "@/lib/storage/validation";
import { GrantReportingServiceError, requireMutableGrantReport } from "@/lib/services/grant-reports";
import type { UploadGrantReportDocumentInput } from "@/lib/validators/grant-reports";

export const grantReportDocumentPolicy = defaultDocumentPolicy;

type GrantReportDocumentMutationClient = Pick<
  Prisma.TransactionClient,
  "grantReportVersion" | "grantReportDocument" | "auditLog"
>;

export async function requireDraftVersionMutationFence(
  tx: Pick<Prisma.TransactionClient, "grantReportVersion">,
  grantReportVersionId: string,
) {
  const result = await tx.grantReportVersion.updateMany({
    where: { id: grantReportVersionId, status: "DRAFT", submittedAt: null },
    data: { updatedAt: new Date() },
  });
  if (result.count !== 1) {
    throw new GrantReportingServiceError("This report version is immutable and cannot be edited.", 409);
  }
}

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
      await requireDraftVersionMutationFence(tx, current.version.id);
      if (input.metadata.indicatorId) {
        const indicator = await tx.grantReportIndicator.findFirst({ where: { id: input.metadata.indicatorId, grantReportVersionId: current.version.id }, select: { id: true } });
        if (!indicator) throw new GrantReportingServiceError("The selected indicator does not belong to this report version.", 422);
      }
      if (input.metadata.financialLineId) {
        const financialLine = await tx.grantReportFinancialLine.findFirst({ where: { id: input.metadata.financialLineId, grantReportVersionId: current.version.id }, select: { id: true } });
        if (!financialLine) throw new GrantReportingServiceError("The selected financial line does not belong to this report version.", 422);
      }
      if (input.metadata.documentType === "INDICATOR_EVIDENCE" && !input.metadata.indicatorId) throw new GrantReportingServiceError("Indicator evidence must be linked to an indicator.", 422);
      const document = await tx.grantReportDocument.create({
        data: {
          grantReportVersionId: current.version.id,
          indicatorId: input.metadata.indicatorId,
          financialLineId: input.metadata.financialLineId,
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
      await tx.auditLog.create({ data: { actorUserId: input.actorUserId, action: "grant.report.document.uploaded", entityType: "GrantReportDocument", entityId: document.id, metadata: { reportId: input.reportId, grantReportVersionId: current.version.id, fileAssetId: file.id, documentType: document.documentType, indicatorId: input.metadata.indicatorId ?? null, financialLineId: input.metadata.financialLineId ?? null } } });
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

export async function getGrantReportEvidenceList(input: { reportId: string; versionNumber: number; page: number; pageSize: number }) {
  const result = await listGrantReportEvidence(input);
  if (!result) throw new GrantReportingServiceError("Grant report version not found.", 404);
  return result;
}

export async function removeGrantReportDocument(input: { reportId: string; documentId: string; actorUserId: string }) {
  return prisma.$transaction(async (tx) => {
    const current = await requireMutableGrantReport(tx, input.reportId);
    return removeGrantReportDocumentFromMutableVersion(tx, { ...input, grantReportVersionId: current.version.id });
  });
}

export async function removeGrantReportDocumentFromMutableVersion(
  tx: GrantReportDocumentMutationClient,
  input: { reportId: string; documentId: string; actorUserId: string; grantReportVersionId: string },
) {
  await requireDraftVersionMutationFence(tx, input.grantReportVersionId);
  const document = await tx.grantReportDocument.findFirst({
    where: { id: input.documentId, grantReportVersionId: input.grantReportVersionId },
    select: {
      id: true,
      fileAssetId: true,
      documentType: true,
      title: true,
      indicatorId: true,
      financialLineId: true,
    },
  });
  if (!document) throw new GrantReportingServiceError("Grant report document not found.", 404);
  await tx.grantReportDocument.delete({ where: { id: document.id } });
  await tx.auditLog.create({
    data: {
      actorUserId: input.actorUserId,
      action: "grant.report.document.removed",
      entityType: "GrantReportDocument",
      entityId: document.id,
      before: document,
      metadata: {
        reportId: input.reportId,
        grantReportVersionId: input.grantReportVersionId,
        fileAssetId: document.fileAssetId,
        retainedPrivateFile: true,
      },
    },
  });
  return { id: document.id, removedFromReport: true, retainedPrivateFile: true };
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
