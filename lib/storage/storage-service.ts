import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { getStorageConfig, type StorageConfig } from "@/lib/storage/config";
import { StorageAccessError, StorageNotFoundError, StorageUploadError } from "@/lib/storage/errors";
import { buildStorageObjectPath } from "@/lib/storage/path";
import type { StorageProviderAdapter } from "@/lib/storage/storage-provider";
import { SupabaseStorageProvider } from "@/lib/storage/supabase-storage-provider";
import type { FileValidationPolicy, SafeFileAsset, SignedFileAccess, StorageAccessContext, StorageModule } from "@/lib/storage/types";
import { defaultDocumentPolicy, isPreviewableMimeType, type StorageUploadFile, validateStorageFile } from "@/lib/storage/validation";

type StoredFileRecord = SafeFileAsset & {
  storageProvider: string;
  storageKey: string;
  uploadedByUserId: string | null;
};

export interface StoragePersistence {
  createFileAsset(input: {
    id: string;
    storageProvider: "supabase";
    storageKey: string;
    originalFilename: string;
    mimeType: string;
    fileSize: number;
    checksum: string;
    uploadedByUserId: string;
    module: StorageModule;
    entityId: string;
  }): Promise<SafeFileAsset>;
  findFileAsset(fileAssetId: string): Promise<StoredFileRecord | null>;
  deleteFileAssetForRollback(input: { fileAssetId: string; uploadedByUserId: string }): Promise<StoredFileRecord | null>;
  recordAccess(input: { action: "storage.file.access.previewed" | "storage.file.access.downloaded"; file: StoredFileRecord; context: StorageAccessContext }): Promise<void>;
}

const prismaStoragePersistence: StoragePersistence = {
  async createFileAsset(input) {
    return prisma.$transaction(async (tx) => {
      const file = await tx.fileAsset.create({
        data: {
          id: input.id,
          storageProvider: input.storageProvider,
          storageKey: input.storageKey,
          originalFilename: input.originalFilename,
          mimeType: input.mimeType,
          fileSize: input.fileSize,
          checksum: input.checksum,
          uploadedByUserId: input.uploadedByUserId,
        },
        select: { id: true, originalFilename: true, mimeType: true, fileSize: true, checksum: true, createdAt: true },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: input.uploadedByUserId,
          action: "storage.file.uploaded",
          entityType: "FileAsset",
          entityId: file.id,
          after: JSON.parse(JSON.stringify(file)),
          metadata: {
            fileAssetId: file.id,
            storageProvider: input.storageProvider,
            module: input.module,
            entityId: input.entityId,
            mimeType: input.mimeType,
            fileSize: input.fileSize,
            actorUserId: input.uploadedByUserId,
          },
        },
      });
      return file;
    });
  },

  findFileAsset(fileAssetId) {
    return prisma.fileAsset.findUnique({
      where: { id: fileAssetId },
      select: { id: true, storageProvider: true, storageKey: true, originalFilename: true, mimeType: true, fileSize: true, checksum: true, uploadedByUserId: true, createdAt: true },
    });
  },

  async deleteFileAssetForRollback(input) {
    return prisma.$transaction(async (tx) => {
      const file = await tx.fileAsset.findFirst({
        where: { id: input.fileAssetId, uploadedByUserId: input.uploadedByUserId },
        select: { id: true, storageProvider: true, storageKey: true, originalFilename: true, mimeType: true, fileSize: true, checksum: true, uploadedByUserId: true, createdAt: true },
      });
      if (!file) return null;
      await tx.fileAsset.delete({ where: { id: file.id } });
      await tx.auditLog.create({ data: { actorUserId: input.uploadedByUserId, action: "storage.file.upload.rolled_back", entityType: "FileAsset", entityId: file.id, metadata: { fileAssetId: file.id } } });
      return file;
    });
  },

  async recordAccess(input) {
    await prisma.auditLog.create({
      data: {
        actorUserId: input.context.actorUserId,
        action: input.action,
        entityType: "FileAsset",
        entityId: input.file.id,
        metadata: {
          fileAssetId: input.file.id,
          storageProvider: input.file.storageProvider,
          module: input.context.module,
          entityId: input.context.entityId,
          mimeType: input.file.mimeType,
          fileSize: input.file.fileSize,
          actorUserId: input.context.actorUserId,
        },
      },
    });
  },
};

export type UploadFileAssetInput = {
  file: StorageUploadFile;
  module: StorageModule;
  ownerId: string;
  entityId: string;
  uploadedByUserId: string;
  policy?: FileValidationPolicy;
};

export class StorageService {
  constructor(
    private readonly provider: StorageProviderAdapter,
    private readonly persistence: StoragePersistence,
    private readonly config: Pick<StorageConfig, "signedUrlTtlSeconds">
  ) {}

  async uploadFileAsset(input: UploadFileAssetInput) {
    const validated = await validateStorageFile(input.file, input.policy ?? defaultDocumentPolicy);
    const fileAssetId = randomUUID();
    const path = buildStorageObjectPath({
      module: input.module,
      ownerId: input.ownerId,
      entityId: input.entityId,
      fileAssetId,
      filename: validated.sanitizedFilename,
    });
    const checksum = createHash("sha256").update(validated.content).digest("hex");
    const stored = await this.provider.upload({ path, content: validated.content, contentType: validated.mimeType, upsert: false });

    try {
      return await this.persistence.createFileAsset({
        id: fileAssetId,
        storageProvider: stored.provider,
        storageKey: stored.path,
        originalFilename: validated.originalFilename,
        mimeType: validated.mimeType,
        fileSize: stored.size,
        checksum,
        uploadedByUserId: input.uploadedByUserId,
        module: input.module,
        entityId: input.entityId,
      });
    } catch (error) {
      try {
        await this.provider.removeForRollback(stored.path);
      } catch {
        console.error("Storage rollback failed after FileAsset persistence failure.", { fileAssetId });
      }
      throw new StorageUploadError({ cause: error });
    }
  }

  async createPreviewAccess(input: { fileAssetId: string; context: StorageAccessContext }): Promise<SignedFileAccess> {
    const file = await this.requireSupabaseFile(input.fileAssetId);
    if (!isPreviewableMimeType(file.mimeType)) {
      throw new StorageAccessError("This file type is download-only.", 422);
    }
    return this.createAccess(file, input.context, "storage.file.access.previewed");
  }

  async createDownloadAccess(input: { fileAssetId: string; context: StorageAccessContext }): Promise<SignedFileAccess> {
    const file = await this.requireSupabaseFile(input.fileAssetId);
    return this.createAccess(file, input.context, "storage.file.access.downloaded", file.originalFilename);
  }

  async exists(input: { fileAssetId: string; context: StorageAccessContext }) {
    const file = await this.persistence.findFileAsset(input.fileAssetId);
    if (!file || file.storageProvider !== "supabase") return false;
    return this.provider.exists(file.storageKey);
  }

  async rollbackStagedFileAsset(input: { fileAssetId: string; uploadedByUserId: string; module: StorageModule; ownerId: string; entityId: string }) {
    const file = await this.persistence.findFileAsset(input.fileAssetId);
    const expectedPrefix = `${input.module}/${input.ownerId}/${input.entityId}/${input.fileAssetId}/`;
    if (!file || file.uploadedByUserId !== input.uploadedByUserId || !file.storageKey.startsWith(expectedPrefix)) {
      throw new StorageAccessError("The staged file was not found.", 404);
    }
    const deleted = await this.persistence.deleteFileAssetForRollback({ fileAssetId: input.fileAssetId, uploadedByUserId: input.uploadedByUserId });
    if (!deleted) throw new StorageAccessError("The staged file was not found.", 404);
    await this.provider.removeForRollback(deleted.storageKey);
  }

  private async requireSupabaseFile(fileAssetId: string) {
    const file = await this.persistence.findFileAsset(fileAssetId);
    if (!file) throw new StorageNotFoundError();
    if (file.storageProvider !== "supabase") {
      throw new StorageAccessError("Stored file content is unavailable.", 404);
    }
    if (!(await this.provider.exists(file.storageKey))) throw new StorageNotFoundError();
    return file;
  }

  private async createAccess(
    file: StoredFileRecord,
    context: StorageAccessContext,
    action: "storage.file.access.previewed" | "storage.file.access.downloaded",
    downloadFilename?: string
  ) {
    const url = await this.provider.createSignedUrl({
      path: file.storageKey,
      expiresInSeconds: this.config.signedUrlTtlSeconds,
      downloadFilename,
    });
    await this.persistence.recordAccess({ action, file, context });
    return {
      url,
      expiresAt: new Date(Date.now() + this.config.signedUrlTtlSeconds * 1000),
      originalFilename: file.originalFilename,
      mimeType: file.mimeType,
      previewable: isPreviewableMimeType(file.mimeType),
    };
  }
}

let defaultStorageService: StorageService | undefined;

export function getStorageService() {
  if (!defaultStorageService) {
    const config = getStorageConfig();
    defaultStorageService = new StorageService(new SupabaseStorageProvider(config), prismaStoragePersistence, config);
  }
  return defaultStorageService;
}

export const storage = {
  uploadFileAsset: (input: UploadFileAssetInput) => getStorageService().uploadFileAsset(input),
  createPreviewAccess: (input: { fileAssetId: string; context: StorageAccessContext }) => getStorageService().createPreviewAccess(input),
  createDownloadAccess: (input: { fileAssetId: string; context: StorageAccessContext }) => getStorageService().createDownloadAccess(input),
  exists: (input: { fileAssetId: string; context: StorageAccessContext }) => getStorageService().exists(input),
  rollbackStagedFileAsset: (input: { fileAssetId: string; uploadedByUserId: string; module: StorageModule; ownerId: string; entityId: string }) => getStorageService().rollbackStagedFileAsset(input),
};
