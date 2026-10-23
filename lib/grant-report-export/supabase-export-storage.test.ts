import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import test from "node:test";
import { buildGrantReportExportStoragePath } from "@/lib/grant-report-export/export-lifecycle";
import type { GrantReportExportStorageConfig } from "@/lib/grant-report-export/storage-config";
import {
  grantReportExportStorageLimits,
  SupabaseGrantReportExportStorage,
  type GrantReportExportStorageTransport,
  uploadFileWithTus,
  verifyGrantReportExportStorageBucket,
} from "@/lib/grant-report-export/supabase-export-storage";
import { GrantReportExportStorageError } from "@/lib/grant-report-export/supabase-export-storage-errors";

const bytes = Buffer.from("synthetic immutable submission pack");
const sha256 = createHash("sha256").update(bytes).digest("hex");
const ownership = {
  reportId: "report-1",
  versionId: "version-1",
  artifactId: "artifact-1",
  attemptNumber: 1,
  generationToken: "a".repeat(64),
  fileAssetId: "file-1",
};
const path = buildGrantReportExportStoragePath(ownership);

class FakeTransport implements GrantReportExportStorageTransport {
  stored: Buffer | undefined;
  existsBefore = false;
  removed = 0;
  uploadCalls = 0;
  uploadedFromPath = false;
  reportedSize: number | undefined;
  reportedContentType: string | undefined = "application/zip";
  reportedVersion: string | undefined = "object-version-1";
  infoMissing = false;
  metadataMissing = false;
  uploadFailure: unknown;
  removeFailure: unknown;
  lastFilePath: string | undefined;

  async exists() { return this.existsBefore || Boolean(this.stored); }
  async uploadFile(input: { filePath: string; signal: AbortSignal }) {
    this.uploadCalls += 1;
    this.lastFilePath = input.filePath;
    if (this.uploadFailure) throw this.uploadFailure;
    this.uploadedFromPath = typeof input.filePath === "string";
    const chunks: Buffer[] = [];
    for await (const chunk of createReadStream(input.filePath)) chunks.push(Buffer.from(chunk));
    this.stored = Buffer.concat(chunks);
    return { storageObjectVersion: "upload-version" };
  }
  async info() {
    if (this.infoMissing || !this.stored) return null;
    if (this.metadataMissing) return {};
    return {
      size: this.reportedSize ?? this.stored.byteLength,
      contentType: this.reportedContentType,
      version: this.reportedVersion,
    };
  }
  async openRead() {
    if (!this.stored) throw new Error("missing");
    return Readable.from(this.stored);
  }
  async remove() {
    this.removed += 1;
    if (this.removeFailure) {
      const error = this.removeFailure;
      this.removeFailure = undefined;
      throw error;
    }
    this.stored = undefined;
    this.existsBefore = false;
  }
}

function input(overrides: Partial<Parameters<SupabaseGrantReportExportStorage["uploadAndVerify"]>[0]> = {}) {
  return {
    ownership,
    path,
    stream: Readable.from(bytes),
    contentType: "application/zip" as const,
    byteSize: bytes.byteLength,
    sha256,
    createOnly: true as const,
    signal: new AbortController().signal,
    ...overrides,
  };
}

test("uploads from a temporary file and verifies private bytes, size, checksum and version", async () => {
  const transport = new FakeTransport();
  const adapter = new SupabaseGrantReportExportStorage(transport);
  const result = await adapter.uploadAndVerify(input({ stream: Readable.from([bytes.subarray(0, 8), bytes.subarray(8)]) }));
  assert.equal(transport.uploadedFromPath, true);
  assert.equal(transport.uploadCalls, 1);
  assert.deepEqual(transport.stored, bytes);
  assert.deepEqual(result, { path, byteSize: bytes.byteLength, sha256, storageObjectVersion: "object-version-1" });
  await assert.rejects(() => access(transport.lastFilePath!), { code: "ENOENT" });
});

test("duplicate paths are rejected before upload and create-only semantics are mandatory", async () => {
  const transport = new FakeTransport();
  transport.existsBefore = true;
  const adapter = new SupabaseGrantReportExportStorage(transport);
  await assert.rejects(() => adapter.uploadAndVerify(input()), (error: unknown) => error instanceof GrantReportExportStorageError && error.code === "OBJECT_ALREADY_EXISTS");
  await assert.rejects(() => adapter.uploadAndVerify(input({ createOnly: false as never })), (error: unknown) => error instanceof GrantReportExportStorageError && error.code === "INVALID_UPLOAD_INPUT");
  assert.equal(transport.uploadCalls, 0);
});

test("concurrent create-only uploads allow one winner and reject the colliding attempt", async () => {
  class AtomicCreateTransport extends FakeTransport {
    waiting = 0;
    created = false;
    release!: () => void;
    barrier = new Promise<void>((resolve) => { this.release = resolve; });

    override async exists() { return false; }
    override async uploadFile(input: { filePath: string; signal: AbortSignal }) {
      this.uploadCalls += 1;
      this.lastFilePath = input.filePath;
      this.waiting += 1;
      if (this.waiting === 2) this.release();
      await this.barrier;
      if (this.created) throw { status: 409, body: "provider details must not escape" };
      this.created = true;
      this.stored = await import("node:fs/promises").then(({ readFile }) => readFile(input.filePath));
      return { storageObjectVersion: "winner-version" };
    }
  }

  const transport = new AtomicCreateTransport();
  const adapter = new SupabaseGrantReportExportStorage(transport);
  const results = await Promise.allSettled([adapter.uploadAndVerify(input()), adapter.uploadAndVerify(input())]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const rejected = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
  assert.ok(rejected?.reason instanceof GrantReportExportStorageError);
  assert.equal(rejected.reason.code, "OBJECT_ALREADY_EXISTS");
  assert.doesNotMatch(rejected.reason.message, /provider details/i);
});

async function exportUploadTemporaryDirectories() {
  return new Set((await readdir(tmpdir())).filter((name) => name.startsWith("ecdlink-export-upload-")));
}

test("caller abort closes work with a safe error", async () => {
  const aborted = new AbortController();
  aborted.abort();
  await assert.rejects(
    () => new SupabaseGrantReportExportStorage(new FakeTransport()).uploadAndVerify(input({ signal: aborted.signal })),
    (error: unknown) => error instanceof GrantReportExportStorageError && error.code === "UPLOAD_ABORTED",
  );
});

test("a pre-upload deadline cleans its temporary directory without entering the provider", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const before = await exportUploadTemporaryDirectories();
  const transport = new FakeTransport();
  const pending = new SupabaseGrantReportExportStorage(transport, 10).uploadAndVerify(input());
  context.mock.timers.tick(10);
  await assert.rejects(
    () => pending,
    (error: unknown) => error instanceof GrantReportExportStorageError && error.code === "UPLOAD_TIMEOUT",
  );
  assert.equal(transport.uploadCalls, 0);
  const after = await exportUploadTemporaryDirectories();
  assert.deepEqual([...after].filter((name) => !before.has(name)), []);
});

test("an in-upload deadline aborts provider work and removes the spooled file", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const transport = new FakeTransport();
  let markUploadEntered!: () => void;
  const uploadEntered = new Promise<void>((resolve) => { markUploadEntered = resolve; });
  transport.uploadFile = async ({ filePath, signal }) => new Promise((_, reject) => {
    transport.uploadCalls += 1;
    transport.lastFilePath = filePath;
    markUploadEntered();
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
  const pending = new SupabaseGrantReportExportStorage(transport, 10).uploadAndVerify(input());
  await uploadEntered;
  context.mock.timers.tick(10);
  await assert.rejects(
    () => pending,
    (error: unknown) => error instanceof GrantReportExportStorageError && error.code === "UPLOAD_TIMEOUT",
  );
  assert.equal(transport.uploadCalls, 1);
  assert.ok(transport.lastFilePath);
  await assert.rejects(() => access(transport.lastFilePath!), { code: "ENOENT" });
});

test("byte-size, checksum and missing-object verification failures never return success", async () => {
  const shortSource = new FakeTransport();
  await assert.rejects(
    () => new SupabaseGrantReportExportStorage(shortSource).uploadAndVerify(input({ byteSize: bytes.byteLength + 1 })),
    (error: unknown) => error instanceof GrantReportExportStorageError && error.code === "INVALID_UPLOAD_INPUT",
  );

  const wrongSize = new FakeTransport();
  wrongSize.reportedSize = bytes.byteLength + 1;
  await assert.rejects(
    () => new SupabaseGrantReportExportStorage(wrongSize).uploadAndVerify(input()),
    (error: unknown) => error instanceof GrantReportExportStorageError && error.code === "INTEGRITY_MISMATCH",
  );

  const wrongChecksum = new FakeTransport();
  wrongChecksum.openRead = async () => Readable.from(Buffer.alloc(bytes.byteLength, "x"));
  await assert.rejects(
    () => new SupabaseGrantReportExportStorage(wrongChecksum).uploadAndVerify(input()),
    (error: unknown) => error instanceof GrantReportExportStorageError && error.code === "INTEGRITY_MISMATCH",
  );

  const missing = new FakeTransport();
  missing.infoMissing = true;
  await assert.rejects(
    () => new SupabaseGrantReportExportStorage(missing).uploadAndVerify(input()),
    (error: unknown) => error instanceof GrantReportExportStorageError && error.code === "OBJECT_NOT_FOUND",
  );

  const missingMetadata = new FakeTransport();
  missingMetadata.metadataMissing = true;
  await assert.rejects(
    () => new SupabaseGrantReportExportStorage(missingMetadata).uploadAndVerify(input()),
    (error: unknown) => error instanceof GrantReportExportStorageError && error.code === "INTEGRITY_MISMATCH",
  );
});

test("removal is path-bound, idempotent for missing objects and verifies deletion", async () => {
  const transport = new FakeTransport();
  const adapter = new SupabaseGrantReportExportStorage(transport);
  await adapter.removeOwnedObject({ ownership, path, ignoreMissing: true });
  assert.equal(transport.removed, 0);
  transport.stored = bytes;
  await adapter.removeOwnedObject({ ownership, path, ignoreMissing: true });
  assert.equal(transport.removed, 1);
  await assert.rejects(
    () => adapter.removeOwnedObject({ ownership, path: "grant-report-exports/report-1/../../other.zip", ignoreMissing: true }),
    (error: unknown) => error instanceof GrantReportExportStorageError && error.code === "INVALID_STORAGE_PATH",
  );
  const otherOwnership = { ...ownership, attemptNumber: 2 };
  await assert.rejects(
    () => adapter.removeOwnedObject({ ownership, path: buildGrantReportExportStoragePath(otherOwnership), ignoreMissing: true }),
    (error: unknown) => error instanceof GrantReportExportStorageError && error.code === "INVALID_STORAGE_PATH",
  );
  await assert.rejects(
    () => adapter.uploadAndVerify(input({ path: buildGrantReportExportStoragePath({ ...ownership, attemptNumber: 2 }) })),
    (error: unknown) => error instanceof GrantReportExportStorageError && error.code === "INVALID_STORAGE_PATH",
  );

  transport.stored = bytes;
  transport.removeFailure = new Error("provider response with private details");
  await assert.rejects(
    () => adapter.removeOwnedObject({ ownership, path, ignoreMissing: true }),
    (error: unknown) => error instanceof GrantReportExportStorageError
      && error.code === "PROVIDER_UNAVAILABLE"
      && !error.message.includes("private details"),
  );
  await adapter.removeOwnedObject({ ownership, path, ignoreMissing: true });
  assert.equal(transport.stored, undefined);
});

test("provider failures are sanitized and never retain provider response details", async () => {
  const transport = new FakeTransport();
  transport.uploadFailure = new Error("private provider body with service credential");
  await assert.rejects(
    () => new SupabaseGrantReportExportStorage(transport).uploadAndVerify(input()),
    (error: unknown) => error instanceof GrantReportExportStorageError
      && error.code === "UPLOAD_FAILED"
      && !error.message.includes("credential"),
  );
  await assert.rejects(() => access(transport.lastFilePath!), { code: "ENOENT" });
});

test("TUS upload is file-backed, bounded, non-resumable across processes and never enables upsert", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ecdlink-tus-test-"));
  const filePath = join(directory, "pack.zip");
  await writeFile(filePath, bytes);
  let captured: ConstructorParameters<typeof import("tus-js-client").Upload>[1] | undefined;
  let usedFileBackedStream = false;
  try {
    const result = await uploadFileWithTus(
      { filePath, path, byteSize: bytes.byteLength, contentType: "application/zip", signal: new AbortController().signal },
      {
        supabaseUrl: "https://project-ref.supabase.co",
        serviceRoleKey: "server-only-service-role-key-for-tests",
        bucket: "ecdlink-report-exports",
        tusEndpoint: "https://project-ref.storage.supabase.co/storage/v1/upload/resumable",
      },
      (file, options) => {
        usedFileBackedStream = "path" in file && file.path === filePath;
        captured = options;
        queueMicrotask(() => options.onSuccess?.({ lastResponse: { getHeader: (name: string) => name === "etag" ? '"etag-1"' : undefined } as never }));
        return { start() {}, abort: async () => undefined };
      },
    );
    assert.equal(captured?.chunkSize, grantReportExportStorageLimits.chunkBytes);
    assert.equal(captured?.uploadSize, bytes.byteLength);
    assert.equal(captured?.storeFingerprintForResuming, false);
    assert.equal(captured?.headers?.["x-upsert"], undefined);
    assert.equal(result.storageObjectVersion, "etag-1");
    assert.equal(usedFileBackedStream, true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("TUS cancellation aborts the active request before releasing its file", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ecdlink-tus-abort-test-"));
  const filePath = join(directory, "pack.zip");
  await writeFile(filePath, bytes);
  const controller = new AbortController();
  let providerAbortFinished = false;
  try {
    const pending = uploadFileWithTus(
      { filePath, path, byteSize: bytes.byteLength, contentType: "application/zip", signal: controller.signal },
      {
        supabaseUrl: "https://project-ref.supabase.co",
        serviceRoleKey: "server-only-service-role-key-for-tests",
        bucket: "ecdlink-report-exports",
        tusEndpoint: "https://project-ref.storage.supabase.co/storage/v1/upload/resumable",
      },
      () => ({
        start() {},
        abort: async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          providerAbortFinished = true;
        },
      }),
    );
    controller.abort();
    await assert.rejects(
      () => pending,
      (error: unknown) => error instanceof GrantReportExportStorageError && error.code === "UPLOAD_ABORTED",
    );
    assert.equal(providerAbortFinished, true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("bucket readiness requires private ZIP storage with the full export size allowance", async () => {
  const client = {
    storage: {
      getBucket: async () => ({
        data: { public: false, file_size_limit: 128 * 1024 * 1024, allowed_mime_types: ["application/zip"] },
        error: null,
      }),
    },
  };
  const result = await verifyGrantReportExportStorageBucket({
    supabaseUrl: "https://project-ref.supabase.co",
    serviceRoleKey: "server-only-service-role-key-for-tests",
    bucket: "ecdlink-report-exports",
    tusEndpoint: "https://project-ref.storage.supabase.co/storage/v1/upload/resumable",
  }, client as never);
  assert.equal(result.private, true);

  for (const bucket of [
    { public: true, file_size_limit: 128 * 1024 * 1024, allowed_mime_types: ["application/zip"] },
    { public: false, file_size_limit: 128 * 1024 * 1024, allowed_mime_types: null },
    { public: false, file_size_limit: 128 * 1024 * 1024, allowed_mime_types: ["application/zip", "application/pdf"] },
    { public: false, file_size_limit: 10 * 1024 * 1024, allowed_mime_types: ["application/zip"] },
  ]) {
    await assert.rejects(
      () => verifyGrantReportExportStorageBucket({
        supabaseUrl: "https://project-ref.supabase.co",
        serviceRoleKey: "server-only-service-role-key-for-tests",
        bucket: "ecdlink-report-exports",
        tusEndpoint: "https://project-ref.storage.supabase.co/storage/v1/upload/resumable",
      }, { storage: { getBucket: async () => ({ data: bucket, error: null }) } } as never),
      (error: unknown) => error instanceof GrantReportExportStorageError && error.code === "INVALID_CONFIGURATION",
    );
  }
});
