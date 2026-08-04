import "server-only";
import type { UserRole, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { recordFundingDocumentWorkflowCommunication } from "@/lib/services/funding-communication";
import { StorageAccessError } from "@/lib/storage/errors";
import { storage, type UploadFileAssetInput } from "@/lib/storage/storage-service";
import type { SafeFileAsset, SignedFileAccess, StorageAccessContext } from "@/lib/storage/types";
import type { StorageUploadFile } from "@/lib/storage/validation";

export class FundingDocumentServiceError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

export type FundingDocumentAccessRecord = {
  actor: {
    id: string;
    role: UserRole;
    status: UserStatus;
    fundingOrganisationIds: string[];
  } | null;
  document: {
    id: string;
    label: string;
    fundingProfileId: string;
    status: string;
    fileId: string | null;
    note: string | null;
    uploadedAt: Date | null;
    verifiedAt: Date | null;
    profile: {
      centreId: string;
      fundingOrganisationIds: string[];
    };
  } | null;
};

export type AuthorizedFundingDocument = NonNullable<FundingDocumentAccessRecord["document"]>;

export interface FundingDocumentPersistence {
  loadAccessRecord(documentId: string, actorUserId: string): Promise<FundingDocumentAccessRecord>;
  linkUploadedFile(input: { document: AuthorizedFundingDocument; file: SafeFileAsset; actorUserId: string }): Promise<unknown>;
  verifyDocument(input: { document: AuthorizedFundingDocument; actorUserId: string; reviewerComment?: string }): Promise<unknown>;
  requestResubmission(input: { document: AuthorizedFundingDocument; actorUserId: string; rejectionReason: string; reviewerComment?: string }): Promise<unknown>;
}

export interface FundingDocumentStorage {
  uploadFileAsset(input: UploadFileAssetInput): Promise<SafeFileAsset>;
  createPreviewAccess(input: { fileAssetId: string; context: StorageAccessContext }): Promise<SignedFileAccess>;
  createDownloadAccess(input: { fileAssetId: string; context: StorageAccessContext }): Promise<SignedFileAccess>;
}

function appendNotes(existing: string | null, additions: Array<string | undefined>) {
  const lines = additions.map((line) => line?.trim()).filter((line): line is string => Boolean(line));
  if (!lines.length) return existing;
  return [existing?.trim(), ...lines].filter(Boolean).join("\n");
}

export function buildFundingDocumentUploadUpdate(fileId: string, uploadedAt = new Date()) {
  return { fileId, status: "COMPLETE" as const, uploadedAt, verifiedAt: null };
}

export function buildFundingDocumentVerificationUpdate(document: AuthorizedFundingDocument, reviewerComment?: string, verifiedAt = new Date()) {
  return {
    status: "COMPLETE" as const,
    verifiedAt,
    note: appendNotes(document.note, reviewerComment ? [`Reviewer comment: ${reviewerComment}`] : []),
  };
}

export function buildFundingDocumentResubmissionUpdate(document: AuthorizedFundingDocument, rejectionReason: string, reviewerComment?: string) {
  return {
    status: "IN_PROGRESS" as const,
    verifiedAt: null,
    note: appendNotes(document.note, [
      `Resubmission requested: ${rejectionReason}`,
      reviewerComment ? `Reviewer comment: ${reviewerComment}` : undefined,
    ]),
  };
}

export function buildFundingDocumentUploadAuditMetadata(document: AuthorizedFundingDocument, file: SafeFileAsset, actorUserId: string) {
  return {
    documentId: document.id,
    previousFileId: document.fileId,
    newFileId: file.id,
    actorUserId,
    mimeType: file.mimeType,
    fileSize: file.fileSize,
  };
}

export function assertFundingDocumentAccess(record: FundingDocumentAccessRecord): AuthorizedFundingDocument {
  const { actor, document } = record;
  const allowed = Boolean(
    actor &&
    document &&
    actor.status === "ACTIVE" &&
    (actor.role === "SUPER_ADMIN" ||
      (actor.role === "FUNDING_ORGANISATION" &&
        actor.fundingOrganisationIds.some((id) => document.profile.fundingOrganisationIds.includes(id))))
  );
  if (!allowed || !document) throw new FundingDocumentServiceError("Funding document was not found.", 404);
  return document;
}

const prismaFundingDocumentPersistence: FundingDocumentPersistence = {
  async loadAccessRecord(documentId, actorUserId) {
    const [actor, document] = await Promise.all([
      prisma.user.findUnique({
        where: { id: actorUserId },
        select: {
          id: true,
          role: true,
          status: true,
          fundingUsers: { select: { fundingOrganisationId: true } },
        },
      }),
      prisma.fundingSupportingDocument.findUnique({
        where: { id: documentId },
        select: {
          id: true,
          label: true,
          fundingProfileId: true,
          status: true,
          fileId: true,
          note: true,
          uploadedAt: true,
          verifiedAt: true,
          profile: {
            select: {
              centreId: true,
              projects: {
                select: { applications: { select: { fundingOrganisationId: true } } },
              },
            },
          },
        },
      }),
    ]);
    return {
      actor: actor ? {
        id: actor.id,
        role: actor.role,
        status: actor.status,
        fundingOrganisationIds: actor.fundingUsers.map((membership) => membership.fundingOrganisationId),
      } : null,
      document: document ? {
        ...document,
        status: String(document.status),
        profile: {
          centreId: document.profile.centreId,
          fundingOrganisationIds: Array.from(new Set(document.profile.projects.flatMap((project) =>
            project.applications.map((application) => application.fundingOrganisationId).filter((id): id is string => Boolean(id))
          ))),
        },
      } : null,
    };
  },

  async linkUploadedFile({ document, file, actorUserId }) {
    return prisma.$transaction(async (tx) => {
      const after = await tx.fundingSupportingDocument.update({
        where: { id: document.id },
        data: buildFundingDocumentUploadUpdate(file.id),
      });
      await tx.auditLog.create({
        data: {
          actorUserId,
          action: "funding.document.uploaded",
          entityType: "FundingSupportingDocument",
          entityId: document.id,
          before: JSON.parse(JSON.stringify(document)),
          after: JSON.parse(JSON.stringify(after)),
          metadata: buildFundingDocumentUploadAuditMetadata(document, file, actorUserId),
        },
      });
      return after;
    });
  },

  async verifyDocument({ document, actorUserId, reviewerComment }) {
    return prisma.$transaction(async (tx) => {
      const after = await tx.fundingSupportingDocument.update({
        where: { id: document.id },
        data: buildFundingDocumentVerificationUpdate(document, reviewerComment),
      });
      await tx.auditLog.create({
        data: {
          actorUserId,
          action: "funding.document.verified",
          entityType: "FundingSupportingDocument",
          entityId: document.id,
          before: JSON.parse(JSON.stringify(document)),
          after: JSON.parse(JSON.stringify(after)),
          metadata: { documentId: document.id, fileId: document.fileId, actorUserId, reviewerComment },
        },
      });
      return after;
    });
  },

  async requestResubmission({ document, actorUserId, rejectionReason, reviewerComment }) {
    return prisma.$transaction(async (tx) => {
      const after = await tx.fundingSupportingDocument.update({
        where: { id: document.id },
        data: buildFundingDocumentResubmissionUpdate(document, rejectionReason, reviewerComment),
      });
      await tx.auditLog.create({
        data: {
          actorUserId,
          action: "funding.document.resubmission.requested",
          entityType: "FundingSupportingDocument",
          entityId: document.id,
          before: JSON.parse(JSON.stringify(document)),
          after: JSON.parse(JSON.stringify(after)),
          metadata: { documentId: document.id, fileId: document.fileId, actorUserId, rejectionReason, reviewerComment },
        },
      });
      return after;
    });
  },
};

export class FundingDocumentService {
  constructor(private readonly persistence: FundingDocumentPersistence, private readonly storageService: FundingDocumentStorage) {}

  async requireFundingDocumentAccess(input: { documentId: string; actorUserId: string }) {
    return assertFundingDocumentAccess(await this.persistence.loadAccessRecord(input.documentId, input.actorUserId));
  }

  async uploadFundingSupportingDocument(input: { documentId: string; actorUserId: string; file: StorageUploadFile }) {
    const document = await this.requireFundingDocumentAccess(input);
    const file = await this.storageService.uploadFileAsset({
      file: input.file,
      module: "funding",
      ownerId: document.profile.centreId,
      entityId: document.id,
      uploadedByUserId: input.actorUserId,
    });
    await this.persistence.linkUploadedFile({ document, file, actorUserId: input.actorUserId });
    return file;
  }

  async verifyFundingSupportingDocument(input: { documentId: string; actorUserId: string; reviewerComment?: string }) {
    const document = await this.requireFundingDocumentAccess(input);
    if (!document.fileId) throw new FundingDocumentServiceError("A file must be uploaded before verification.", 409);
    return this.persistence.verifyDocument({ document, actorUserId: input.actorUserId, reviewerComment: input.reviewerComment });
  }

  async requestFundingDocumentResubmission(input: { documentId: string; actorUserId: string; rejectionReason: string; reviewerComment?: string }) {
    const document = await this.requireFundingDocumentAccess(input);
    if (!document.fileId) throw new FundingDocumentServiceError("A file must be uploaded before resubmission can be requested.", 409);
    return this.persistence.requestResubmission({ document, actorUserId: input.actorUserId, rejectionReason: input.rejectionReason, reviewerComment: input.reviewerComment });
  }

  async getFundingDocumentPreviewAccess(input: { documentId: string; actorUserId: string }) {
    const document = await this.requireFundingDocumentAccess(input);
    if (!document.fileId) throw new FundingDocumentServiceError("Funding document file was not found.", 404);
    return this.storageService.createPreviewAccess({ fileAssetId: document.fileId, context: this.storageContext(document, input.actorUserId) });
  }

  async getFundingDocumentDownloadAccess(input: { documentId: string; actorUserId: string }) {
    const document = await this.requireFundingDocumentAccess(input);
    if (!document.fileId) throw new FundingDocumentServiceError("Funding document file was not found.", 404);
    return this.storageService.createDownloadAccess({ fileAssetId: document.fileId, context: this.storageContext(document, input.actorUserId) });
  }

  private storageContext(document: AuthorizedFundingDocument, actorUserId: string): StorageAccessContext {
    return { actorUserId, module: "funding", entityId: document.id };
  }
}

const defaultService = new FundingDocumentService(prismaFundingDocumentPersistence, storage);

export const requireFundingDocumentAccess = (input: { documentId: string; actorUserId: string }) => defaultService.requireFundingDocumentAccess(input);
export const uploadFundingSupportingDocument = (input: { documentId: string; actorUserId: string; file: StorageUploadFile }) => defaultService.uploadFundingSupportingDocument(input);
export const verifyFundingSupportingDocument = async (input: { documentId: string; actorUserId: string; reviewerComment?: string }) => {
  const result = await defaultService.verifyFundingSupportingDocument(input);
  const audit = await prisma.auditLog.findFirst({ where: { entityType: "FundingSupportingDocument", entityId: input.documentId, action: "funding.document.verified" }, select: { id: true }, orderBy: { createdAt: "desc" } });
  await recordFundingDocumentWorkflowCommunication({ documentId: input.documentId, actorUserId: input.actorUserId, type: "DOCUMENT_VERIFIED", title: "Funding document verified", body: input.reviewerComment?.trim() || "A supporting document has been verified.", sourceEventKey: `funding.document.verified:${input.documentId}:${audit?.id ?? "latest"}` });
  return result;
};
export const requestFundingDocumentResubmission = async (input: { documentId: string; actorUserId: string; rejectionReason: string; reviewerComment?: string }) => {
  const result = await defaultService.requestFundingDocumentResubmission(input);
  const audit = await prisma.auditLog.findFirst({ where: { entityType: "FundingSupportingDocument", entityId: input.documentId, action: "funding.document.resubmission.requested" }, select: { id: true }, orderBy: { createdAt: "desc" } });
  await recordFundingDocumentWorkflowCommunication({ documentId: input.documentId, actorUserId: input.actorUserId, type: "DOCUMENT_RESUBMISSION", title: "Document resubmission requested", body: input.rejectionReason.trim(), sourceEventKey: `funding.document.resubmission.requested:${input.documentId}:${audit?.id ?? "latest"}`, metadata: input.reviewerComment ? { reviewerComment: input.reviewerComment } : undefined });
  return result;
};
export const getFundingDocumentPreviewAccess = (input: { documentId: string; actorUserId: string }) => defaultService.getFundingDocumentPreviewAccess(input);
export const getFundingDocumentDownloadAccess = (input: { documentId: string; actorUserId: string }) => defaultService.getFundingDocumentDownloadAccess(input);

export function isDownloadOnlyStorageError(error: unknown) {
  return error instanceof StorageAccessError && error.status === 422;
}
