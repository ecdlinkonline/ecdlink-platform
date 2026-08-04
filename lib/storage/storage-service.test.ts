import assert from "node:assert/strict";
import test from "node:test";
import { StorageUploadError } from "@/lib/storage/errors";
import { StorageService, type StoragePersistence } from "@/lib/storage/storage-service";
import type { StorageProviderAdapter } from "@/lib/storage/storage-provider";

function pdfFile() {
  const content = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
  return { name: "evidence.pdf", type: "application/pdf", size: content.byteLength, arrayBuffer: async () => content.buffer };
}

function mocks(options: { persistenceFails?: boolean } = {}) {
  const removed: string[] = [];
  const provider: StorageProviderAdapter = {
    upload: async (input) => ({ provider: "supabase", path: input.path, contentType: input.contentType, size: input.content.byteLength }),
    createSignedUrl: async ({ path }) => `https://signed.example/${path}`,
    exists: async () => true,
    removeForRollback: async (path) => { removed.push(path); },
  };
  const persistence: StoragePersistence = {
    createFileAsset: async (input) => {
      if (options.persistenceFails) throw new Error("database unavailable");
      return { id: input.id, originalFilename: input.originalFilename, mimeType: input.mimeType, fileSize: input.fileSize, checksum: input.checksum, createdAt: new Date(0) };
    },
    findFileAsset: async (id) => ({ id, storageProvider: "supabase", storageKey: "funding/owner/entity/asset/evidence.pdf", originalFilename: "evidence.pdf", mimeType: "application/pdf", fileSize: 6, checksum: "checksum", createdAt: new Date(0) }),
    recordAccess: async () => undefined,
  };
  return { provider, persistence, removed };
}

test("uploads content and persists a SHA-256 checksum", async () => {
  const { provider, persistence } = mocks();
  const service = new StorageService(provider, persistence, { signedUrlTtlSeconds: 300 });
  const asset = await service.uploadFileAsset({ file: pdfFile(), module: "funding", ownerId: "centre-1", entityId: "document-1", uploadedByUserId: "user-1" });
  assert.match(asset.checksum ?? "", /^[a-f0-9]{64}$/);
});

test("removes the uploaded object when FileAsset persistence fails", async () => {
  const { provider, persistence, removed } = mocks({ persistenceFails: true });
  const service = new StorageService(provider, persistence, { signedUrlTtlSeconds: 300 });
  await assert.rejects(
    () => service.uploadFileAsset({ file: pdfFile(), module: "funding", ownerId: "centre-1", entityId: "document-1", uploadedByUserId: "user-1" }),
    StorageUploadError
  );
  assert.equal(removed.length, 1);
});

test("signed preview access uses the configured five-minute default", async () => {
  const { provider, persistence } = mocks();
  let expiresInSeconds = 0;
  provider.createSignedUrl = async (input) => {
    expiresInSeconds = input.expiresInSeconds;
    return "https://signed.example/preview";
  };
  const service = new StorageService(provider, persistence, { signedUrlTtlSeconds: 300 });
  const access = await service.createPreviewAccess({ fileAssetId: "asset-1", context: { actorUserId: "user-1", module: "funding", entityId: "document-1" } });
  assert.equal(expiresInSeconds, 300);
  assert.equal(access.previewable, true);
});
