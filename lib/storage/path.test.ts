import assert from "node:assert/strict";
import test from "node:test";
import { StorageValidationError } from "@/lib/storage/errors";
import { buildStorageObjectPath, sanitizeFilename } from "@/lib/storage/path";

test("sanitizeFilename creates a storage-safe filename", () => {
  assert.equal(sanitizeFilename("Bank Letter (Final) 2026.pdf"), "Bank-Letter-Final-2026.pdf");
});

test("sanitizeFilename rejects path traversal", () => {
  assert.throws(() => sanitizeFilename("../secret.pdf"), StorageValidationError);
  assert.throws(() => sanitizeFilename("folder\\secret.pdf"), StorageValidationError);
});

test("buildStorageObjectPath uses typed, isolated path segments", () => {
  assert.equal(
    buildStorageObjectPath({ module: "funding", ownerId: "centre_1", entityId: "document-1", fileAssetId: "asset-1", filename: "Bank Letter.pdf" }),
    "funding/centre_1/document-1/asset-1/Bank-Letter.pdf"
  );
});

test("buildStorageObjectPath rejects unsafe identifiers", () => {
  assert.throws(
    () => buildStorageObjectPath({ module: "funding", ownerId: "../centre", entityId: "document-1", fileAssetId: "asset-1", filename: "file.pdf" }),
    StorageValidationError
  );
});
