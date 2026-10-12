import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import { buildGrantReportExportFixture } from "@/lib/grant-report-export/fixtures";
import { buildGrantReportExportStoragePath, GrantReportExportLifecycleError } from "@/lib/grant-report-export/export-lifecycle";
import { cleanupGrantReportExportAttemptForAdmin, generateGrantReportExportForAdmin, type GrantReportExportStorage } from "@/lib/grant-report-export/lifecycle-service";

const claimed = {
  kind: "claimed" as const,
  artifactId: "artifact-1",
  attemptId: "attempt-1",
  attemptNumber: 1,
  generationToken: "a".repeat(64),
  leaseExpiresAt: new Date("2027-01-01T10:05:00.000Z"),
  reportId: "report-1",
  versionId: "version-1",
};

function source() {
  return { data: buildGrantReportExportFixture({ status: "SUBMITTED" }), evidenceFiles: [] };
}

function pack(cleaned: { value: number }) {
  const bytes = Buffer.from("synthetic zip");
  return {
    stream: Readable.from(bytes),
    byteSize: bytes.byteLength,
    sha256: "b".repeat(64),
    manifest: { manifestSchemaVersion: 2 },
    cleanup: async () => { cleaned.value += 1; },
  };
}

function storage(overrides: Partial<GrantReportExportStorage> = {}): GrantReportExportStorage {
  return {
    uploadAndVerify: async (input) => {
      for await (const _chunk of input.stream) { /* consume the synthetic stream */ }
      return { path: input.path, byteSize: input.byteSize, sha256: input.sha256, storageObjectVersion: "object-v1" };
    },
    removeOwnedObject: async () => undefined,
    ...overrides,
  };
}

test("storage writes are create-only and unknown provider failures are safely normalized", async () => {
  let createOnly: boolean | undefined;
  await assert.rejects(
    () => generateGrantReportExportForAdmin(
      { reportId: "report-1", versionId: "version-1" },
      {
        storage: storage({
          uploadAndVerify: async (input) => {
            createOnly = input.createOnly;
            throw new Error("provider response contained private diagnostics");
          },
        }),
        authorize: async () => ({ internalUser: { id: "admin-1" } }),
        repository: {
          claim: async () => claimed,
          renew: async () => new Date(),
          stage: async () => ({ fileAssetId: "file-1" }),
          complete: async () => { throw new Error("unused"); },
          fail: async () => ({ kind: "failed" as const }),
          claimCleanup: async () => { throw new Error("unused"); },
          completeCleanup: async () => undefined,
          releaseCleanup: async () => true,
        } as never,
        load: async () => source(),
        assemble: async () => pack({ value: 0 }) as never,
        fileAssetId: () => "file-1",
      },
    ),
    (error: unknown) => error instanceof GrantReportExportLifecycleError
      && error.code === "GENERATION_FAILED"
      && !error.message.includes("private diagnostics"),
  );
  assert.equal(createOnly, true);
});

test("database authorization precedes claim, generation, staging, upload and completion", async () => {
  const order: string[] = [];
  const cleaned = { value: 0 };
  const result = await generateGrantReportExportForAdmin(
    { reportId: "report-1", versionId: "version-1" },
    {
      storage: storage({ uploadAndVerify: async (input) => { order.push("upload"); for await (const _chunk of input.stream) { /* consume */ } return { path: input.path, byteSize: input.byteSize, sha256: input.sha256 }; } }),
      authorize: async () => { order.push("authorize"); return { internalUser: { id: "admin-1" } }; },
      repository: {
        claim: async () => { order.push("claim"); return claimed; },
        renew: async () => new Date(),
        stage: async () => { order.push("stage"); return { fileAssetId: "file-1" }; },
        complete: async (input: { artifactId: string; fileAssetId: string }) => { order.push("complete"); return { artifactId: input.artifactId, fileAssetId: input.fileAssetId, completedAt: new Date() }; },
        fail: async () => ({ kind: "failed" as const }),
        claimCleanup: async () => { throw new Error("unused"); },
        completeCleanup: async () => undefined,
        releaseCleanup: async () => true,
      } as never,
      load: async () => { order.push("load"); return source(); },
      assemble: async () => { order.push("assemble"); return pack(cleaned) as never; },
      fileAssetId: () => "file-1",
      heartbeatMilliseconds: 60_000,
    },
  );
  assert.deepEqual(order, ["authorize", "claim", "load", "assemble", "stage", "upload", "complete"]);
  if ("error" in result) assert.fail("authorization unexpectedly failed");
  assert.equal(result.kind, "completed");
  assert.equal(cleaned.value, 1);
});

test("concurrent requests reuse the active attempt and generate only one pack", async () => {
  let claimCount = 0;
  let assembled = 0;
  let uploaded = 0;
  const cleaned = { value: 0 };
  const repository = {
    claim: async () => {
      claimCount += 1;
      return claimCount === 1
        ? claimed
        : { kind: "in_progress" as const, artifactId: "artifact-1", attemptId: "attempt-1", attemptNumber: 1, leaseExpiresAt: claimed.leaseExpiresAt };
    },
    renew: async () => new Date(),
    stage: async () => ({ fileAssetId: "file-1" }),
    complete: async (input: { artifactId: string; fileAssetId: string }) => ({ artifactId: input.artifactId, fileAssetId: input.fileAssetId, completedAt: new Date() }),
    fail: async () => ({ kind: "failed" as const }),
    claimCleanup: async () => { throw new Error("unused"); },
    completeCleanup: async () => undefined,
    releaseCleanup: async () => true,
  };
  const dependencies = {
    storage: storage({ uploadAndVerify: async (input) => { uploaded += 1; for await (const _chunk of input.stream) { /* consume */ } return { path: input.path, byteSize: input.byteSize, sha256: input.sha256 }; } }),
    authorize: async () => ({ internalUser: { id: "admin-1" } }),
    repository: repository as never,
    load: async () => source(),
    assemble: async () => { assembled += 1; return pack(cleaned) as never; },
    fileAssetId: () => "file-1",
    heartbeatMilliseconds: 60_000,
  };
  const [first, second] = await Promise.all([
    generateGrantReportExportForAdmin({ reportId: "report-1", versionId: "version-1" }, dependencies),
    generateGrantReportExportForAdmin({ reportId: "report-1", versionId: "version-1" }, dependencies),
  ]);
  if ("error" in first || "error" in second) assert.fail("authorization unexpectedly failed");
  assert.equal(first.kind, "completed");
  assert.equal(second.kind, "in_progress");
  assert.equal(assembled, 1);
  assert.equal(uploaded, 1);
  assert.equal(cleaned.value, 1);
});

test("completion waits for an in-flight lease heartbeat before changing immutable state", async () => {
  const order: string[] = [];
  let startRenewal!: () => void;
  const renewalStarted = new Promise<void>((resolve) => { startRenewal = resolve; });
  let finishRenewal!: () => void;
  const renewalFinished = new Promise<void>((resolve) => { finishRenewal = resolve; });
  const cleaned = { value: 0 };

  const result = await generateGrantReportExportForAdmin(
    { reportId: "report-1", versionId: "version-1" },
    {
      storage: storage({
        uploadAndVerify: async (input) => {
          for await (const _chunk of input.stream) { /* consume */ }
          await renewalStarted;
          order.push("upload-returned");
          setTimeout(() => {
            order.push("renew-finished");
            finishRenewal();
          }, 5);
          return { path: input.path, byteSize: input.byteSize, sha256: input.sha256 };
        },
      }),
      authorize: async () => ({ internalUser: { id: "admin-1" } }),
      repository: {
        claim: async () => claimed,
        renew: async () => {
          order.push("renew-started");
          startRenewal();
          await renewalFinished;
          return new Date();
        },
        stage: async () => ({ fileAssetId: "file-1" }),
        complete: async (input: { artifactId: string; fileAssetId: string }) => {
          order.push("complete");
          return { artifactId: input.artifactId, fileAssetId: input.fileAssetId, completedAt: new Date() };
        },
        fail: async () => ({ kind: "failed" as const }),
        claimCleanup: async () => { throw new Error("unused"); },
        completeCleanup: async () => undefined,
        releaseCleanup: async () => true,
      } as never,
      load: async () => source(),
      assemble: async () => pack(cleaned) as never,
      fileAssetId: () => "file-1",
      heartbeatMilliseconds: 10,
    },
  );

  if ("error" in result) assert.fail("authorization unexpectedly failed");
  assert.equal(result.kind, "completed");
  assert.deepEqual(order, ["renew-started", "upload-returned", "renew-finished", "complete"]);
  assert.equal(cleaned.value, 1);
});

test("a stale worker cannot complete or delete its uploaded attempt object", async () => {
  let failed = 0;
  let removed = 0;
  const cleaned = { value: 0 };
  await assert.rejects(
    () => generateGrantReportExportForAdmin(
      { reportId: "report-1", versionId: "version-1" },
      {
        storage: storage({ removeOwnedObject: async () => { removed += 1; } }),
        authorize: async () => ({ internalUser: { id: "admin-1" } }),
        repository: {
          claim: async () => claimed,
          renew: async () => new Date(),
          stage: async () => ({ fileAssetId: "file-1" }),
          complete: async () => { throw new GrantReportExportLifecycleError("STALE_ATTEMPT", "stale"); },
          fail: async () => { failed += 1; return { kind: "stale" as const }; },
          claimCleanup: async () => { throw new Error("unused"); },
          completeCleanup: async () => undefined,
          releaseCleanup: async () => true,
        } as never,
        load: async () => source(),
        assemble: async () => pack(cleaned) as never,
        fileAssetId: () => "file-1",
      },
    ),
    (error: unknown) => error instanceof GrantReportExportLifecycleError && error.code === "STALE_ATTEMPT",
  );
  assert.equal(failed, 1);
  assert.equal(removed, 0);
  assert.equal(cleaned.value, 1);
});

test("cleanup removes only the exact attempt-owned path and finalizes metadata afterward", async () => {
  const fileAssetId = "file-1";
  const storageKey = buildGrantReportExportStoragePath({ reportId: "report-1", versionId: "version-1", artifactId: "artifact-1", attemptNumber: 1, generationToken: claimed.generationToken, fileAssetId });
  const removed: string[] = [];
  let ignoredMissing = false;
  let finalized = 0;
  const result = await cleanupGrantReportExportAttemptForAdmin(
    { attemptId: "attempt-1" },
    {
      authorize: async () => ({ internalUser: { id: "admin-1" } }),
      storage: storage({ removeOwnedObject: async ({ path, ignoreMissing }) => { removed.push(path); ignoredMissing = ignoreMissing; } }),
      repository: {
        claimCleanup: async () => ({ ...claimed, cleanupToken: "cleanup-token", fileAssetId, storageKey }),
        completeCleanup: async () => { finalized += 1; },
        releaseCleanup: async () => true,
      } as never,
    },
  );
  if ("error" in result) assert.fail("authorization unexpectedly failed");
  assert.equal(result.kind, "cleaned");
  assert.deepEqual(removed, [storageKey]);
  assert.equal(ignoredMissing, true);
  assert.equal(finalized, 1);
});

test("cross-attempt cleanup paths are rejected, never removed, and the cleanup lease is released", async () => {
  let removed = 0;
  let released = 0;
  const correct = buildGrantReportExportStoragePath({ reportId: "report-1", versionId: "version-1", artifactId: "artifact-1", attemptNumber: 2, generationToken: claimed.generationToken, fileAssetId: "file-1" });
  await assert.rejects(
    () => cleanupGrantReportExportAttemptForAdmin(
      { attemptId: "attempt-1" },
      {
        authorize: async () => ({ internalUser: { id: "admin-1" } }),
        storage: storage({ removeOwnedObject: async () => { removed += 1; } }),
        repository: {
          claimCleanup: async () => ({ ...claimed, cleanupToken: "cleanup-token", fileAssetId: "file-1", storageKey: correct }),
          completeCleanup: async () => undefined,
          releaseCleanup: async () => { released += 1; return true; },
        } as never,
      },
    ),
    (error: unknown) => error instanceof GrantReportExportLifecycleError && error.code === "INVALID_STORAGE_PATH",
  );
  assert.equal(removed, 0);
  assert.equal(released, 1);
});

test("authorization denial prevents claims, report reads, generation and storage", async () => {
  let work = 0;
  const response = new Response(null, { status: 403 });
  const result = await generateGrantReportExportForAdmin(
    { reportId: "report-1", versionId: "version-1" },
    {
      authorize: async () => ({ error: response }),
      storage: storage({ uploadAndVerify: async () => { work += 1; throw new Error("unused"); } }),
      repository: { claim: async () => { work += 1; return claimed; } } as never,
      load: async () => { work += 1; return source(); },
      assemble: async () => { work += 1; return pack({ value: 0 }) as never; },
    },
  );
  assert.equal("error" in result, true);
  assert.equal(work, 0);
});
