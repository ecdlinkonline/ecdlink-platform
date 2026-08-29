import "server-only";
import { prisma } from "@/lib/db/prisma";
import { storage } from "@/lib/storage/storage-service";
import { storageConfigDiagnostic } from "@/lib/storage/config";
import { StorageError } from "@/lib/storage/errors";
import type { SignedFileAccess } from "@/lib/storage/types";
import { defaultDocumentPolicy, type StorageUploadFile } from "@/lib/storage/validation";

export const GRANT_AWARD_STAGING_ENTITY = "grant-award-staging";

export const grantAwardAgreementPolicy = {
  allowedMimeTypes: ["application/pdf"],
  allowedExtensions: [".pdf"],
  maxBytes: defaultDocumentPolicy.maxBytes,
} as const;

export class GrantAwardAgreementError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

export async function stageGrantAwardAgreement(input: { actorUserId: string; file: StorageUploadFile }) {
  try {
    return await storage.uploadFileAsset({
      file: input.file,
      module: "funding",
      ownerId: input.actorUserId,
      entityId: GRANT_AWARD_STAGING_ENTITY,
      uploadedByUserId: input.actorUserId,
      policy: grantAwardAgreementPolicy,
    });
  } catch (error) {
    if (error instanceof StorageError) {
      console.error("[grant-award-storage-diagnostic]", {
        provider: "supabase",
        operation: "agreement_stage_upload",
        ...storageConfigDiagnostic(),
        failureCode: error.diagnostic?.failureCode ?? "unclassified_storage_failure",
        httpStatus: error.diagnostic?.httpStatus,
      });
    }
    throw error;
  }
}

export async function rollbackStagedGrantAwardAgreement(input: { actorUserId: string; fileAssetId: string }) {
  return storage.rollbackStagedFileAsset({
    fileAssetId: input.fileAssetId,
    uploadedByUserId: input.actorUserId,
    module: "funding",
    ownerId: input.actorUserId,
    entityId: GRANT_AWARD_STAGING_ENTITY,
  });
}

async function loadAwardAgreement(awardId: string) {
  return prisma.grantAward.findUnique({
    where: { id: awardId },
    select: {
      id: true,
      signedAgreementFileAssetId: true,
      signedAgreementFile: { select: { originalFilename: true, mimeType: true } },
    },
  });
}

export async function getGrantAwardAgreementPreview(input: { awardId: string; actorUserId: string }): Promise<SignedFileAccess> {
  const award = await loadAwardAgreement(input.awardId);
  if (!award?.signedAgreementFileAssetId) throw new GrantAwardAgreementError("Signed agreement not found.", 404);
  return storage.createPreviewAccess({ fileAssetId: award.signedAgreementFileAssetId, context: { actorUserId: input.actorUserId, module: "funding", entityId: award.id } });
}

export async function getGrantAwardAgreementDownload(input: { awardId: string; actorUserId: string }): Promise<SignedFileAccess> {
  const award = await loadAwardAgreement(input.awardId);
  if (!award?.signedAgreementFileAssetId) throw new GrantAwardAgreementError("Signed agreement not found.", 404);
  return storage.createDownloadAccess({ fileAssetId: award.signedAgreementFileAssetId, context: { actorUserId: input.actorUserId, module: "funding", entityId: award.id } });
}
