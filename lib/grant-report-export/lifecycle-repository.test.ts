import assert from "node:assert/strict";
import test from "node:test";
import {
  claimGrantReportExportAttempt,
  completeGrantReportExportCleanup,
  completeGrantReportExportAttempt,
  renewGrantReportExportAttemptLease,
  stageGrantReportExportFile,
} from "@/lib/grant-report-export/lifecycle-repository";
import { GrantReportExportLifecycleError } from "@/lib/grant-report-export/export-lifecycle";

function database(transaction: Record<string, unknown>, isolation: string[] = []) {
  return {
    $transaction: async (operation: (tx: unknown) => Promise<unknown>, options: { isolationLevel: string }) => {
      isolation.push(options.isolationLevel);
      return operation(transaction);
    },
  };
}

test("expired current leases are abandoned atomically before a retry receives the next attempt number", async () => {
  const now = new Date("2027-01-01T10:00:00.000Z");
  const attemptUpdates: Array<Record<string, unknown>> = [];
  const artifactUpdates: Array<Record<string, unknown>> = [];
  const attemptsCreated: Array<Record<string, unknown>> = [];
  const audits: Array<Record<string, unknown>> = [];
  const isolation: string[] = [];
  const tx = {
    grantReportVersion: { findFirst: async () => ({ status: "SUBMITTED", report: { status: "SUBMITTED" } }) },
    grantReportExportArtifact: {
      findUnique: async () => ({ id: "artifact-1", status: "GENERATING", latestAttemptNumber: 1, completedFileAssetId: null, sha256: null, byteSize: null, completedAt: null }),
      updateMany: async (args: Record<string, unknown>) => { artifactUpdates.push(args); return { count: 1 }; },
    },
    grantReportExportAttempt: {
      findUnique: async () => ({ id: "attempt-1", attemptNumber: 1, generationToken: "old-token", status: "GENERATING", leaseExpiresAt: new Date("2027-01-01T09:59:00.000Z"), stagedFileAssetId: "file-old" }),
      updateMany: async (args: Record<string, unknown>) => { attemptUpdates.push(args); return { count: 1 }; },
      create: async (args: Record<string, unknown>) => { attemptsCreated.push(args); return { id: "attempt-2" }; },
    },
    auditLog: { create: async (args: Record<string, unknown>) => { audits.push(args); return {}; } },
  };

  const result = await claimGrantReportExportAttempt(
    { reportId: "report-1", versionId: "version-1", actorUserId: "admin-1" },
    { database: database(tx, isolation) as never, now: () => now, token: () => "new-token", cleanupQuarantineMilliseconds: 600_000 },
  );

  assert.equal(result.kind, "claimed");
  assert.equal(result.kind === "claimed" ? result.attemptNumber : null, 2);
  assert.deepEqual(isolation, ["Serializable"]);
  assert.equal((attemptUpdates[0].data as { status: string }).status, "ABANDONED");
  assert.equal((attemptUpdates[0].data as { failureCode: string }).failureCode, "LEASE_EXPIRED");
  assert.equal((attemptUpdates[0].data as { cleanupEligibleAt: Date }).cleanupEligibleAt.toISOString(), "2027-01-01T10:10:00.000Z");
  assert.deepEqual((artifactUpdates[0].where as { latestAttemptNumber: number }).latestAttemptNumber, 1);
  assert.equal((attemptsCreated[0].data as { attemptNumber: number }).attemptNumber, 2);
  assert.equal(audits.length, 1);
});

test("an active attempt is reused and does not create concurrent generation work", async () => {
  let writes = 0;
  const tx = {
    grantReportVersion: { findFirst: async () => ({ status: "SUBMITTED", report: { status: "SUBMITTED" } }) },
    grantReportExportArtifact: { findUnique: async () => ({ id: "artifact-1", status: "GENERATING", latestAttemptNumber: 1, completedFileAssetId: null, sha256: null, byteSize: null, completedAt: null }) },
    grantReportExportAttempt: { findUnique: async () => ({ id: "attempt-1", attemptNumber: 1, generationToken: "token", status: "GENERATING", leaseExpiresAt: new Date("2027-01-01T10:05:00.000Z"), stagedFileAssetId: null }), create: async () => { writes += 1; } },
    auditLog: { create: async () => { writes += 1; } },
  };
  const result = await claimGrantReportExportAttempt(
    { reportId: "report-1", versionId: "version-1", actorUserId: "admin-1" },
    { database: database(tx) as never, now: () => new Date("2027-01-01T10:00:00.000Z") },
  );
  assert.equal(result.kind, "in_progress");
  assert.equal(writes, 0);
});

test("completion rejects stale attempts and mismatched staged files before any write", async () => {
  let writes = 0;
  const tx = {
    grantReportExportAttempt: {
      findUnique: async () => ({
        id: "attempt-1",
        status: "GENERATING",
        generationToken: "token-1",
        attemptNumber: 1,
        leaseExpiresAt: new Date("2027-01-01T10:05:00.000Z"),
        stagedFileAssetId: "file-1",
        expectedSha256: "a".repeat(64),
        expectedByteSize: 100,
        manifestSchemaVersion: 2,
        artifact: { id: "artifact-1", status: "GENERATING", latestAttemptNumber: 2, reportVersion: { status: "SUBMITTED", report: { status: "SUBMITTED" } } },
      }),
      updateMany: async () => { writes += 1; return { count: 1 }; },
    },
    grantReportExportArtifact: { updateMany: async () => { writes += 1; return { count: 1 }; } },
    auditLog: { create: async () => { writes += 1; } },
  };
  await assert.rejects(
    () => completeGrantReportExportAttempt({
      kind: "claimed",
      artifactId: "artifact-1",
      attemptId: "attempt-1",
      attemptNumber: 1,
      generationToken: "token-1",
      leaseExpiresAt: new Date("2027-01-01T10:05:00.000Z"),
      reportId: "report-1",
      versionId: "version-1",
      fileAssetId: "file-2",
      sha256: "a".repeat(64),
      byteSize: 100,
      manifestSchemaVersion: 2,
      actorUserId: "admin-1",
    }, { database: database(tx) as never, now: () => new Date("2027-01-01T10:00:00.000Z") }),
    (error: unknown) => error instanceof GrantReportExportLifecycleError && error.code === "STALE_ATTEMPT",
  );
  assert.equal(writes, 0);
});

test("file staging rejects a storage path owned by a different attempt before database access", async () => {
  let databaseAccesses = 0;
  await assert.rejects(
    () => stageGrantReportExportFile({
      kind: "claimed",
      artifactId: "artifact-1",
      attemptId: "attempt-2",
      attemptNumber: 2,
      generationToken: "token-2",
      leaseExpiresAt: new Date("2027-01-01T10:05:00.000Z"),
      reportId: "report-1",
      versionId: "version-1",
      fileAssetId: "file-2",
      storageKey: "grant-report-exports/report-1/version-1/artifact-1/attempt-1-wrong/file-2/ECDLink-Submission-Pack.zip",
      sha256: "c".repeat(64),
      byteSize: 2048,
      manifestSchemaVersion: 2,
      actorUserId: "admin-1",
    }, {
      database: {
        $transaction: async () => { databaseAccesses += 1; },
      } as never,
    }),
    (error: unknown) => error instanceof GrantReportExportLifecycleError && error.code === "INVALID_STORAGE_PATH",
  );
  assert.equal(databaseAccesses, 0);
});

test("completion atomically binds the artifact to the successful attempt's exact staged file", async () => {
  const now = new Date("2027-01-01T10:00:00.000Z");
  const attemptUpdates: Array<Record<string, unknown>> = [];
  const artifactUpdates: Array<Record<string, unknown>> = [];
  const audits: Array<Record<string, unknown>> = [];
  const tx = {
    grantReportExportAttempt: {
      findUnique: async () => ({
        id: "attempt-2",
        status: "GENERATING",
        generationToken: "token-2",
        attemptNumber: 2,
        leaseExpiresAt: new Date("2027-01-01T10:05:00.000Z"),
        stagedFileAssetId: "file-2",
        expectedSha256: "c".repeat(64),
        expectedByteSize: 2048,
        manifestSchemaVersion: 2,
        artifact: { id: "artifact-1", status: "GENERATING", latestAttemptNumber: 2, reportVersion: { status: "SUBMITTED", report: { status: "SUBMITTED" } } },
      }),
      updateMany: async (args: Record<string, unknown>) => { attemptUpdates.push(args); return { count: 1 }; },
    },
    grantReportExportArtifact: {
      updateMany: async (args: Record<string, unknown>) => { artifactUpdates.push(args); return { count: 1 }; },
    },
    auditLog: { create: async (args: Record<string, unknown>) => { audits.push(args); return {}; } },
  };

  const result = await completeGrantReportExportAttempt({
    kind: "claimed",
    artifactId: "artifact-1",
    attemptId: "attempt-2",
    attemptNumber: 2,
    generationToken: "token-2",
    leaseExpiresAt: new Date("2027-01-01T10:05:00.000Z"),
    reportId: "report-1",
    versionId: "version-1",
    fileAssetId: "file-2",
    sha256: "c".repeat(64),
    byteSize: 2048,
    manifestSchemaVersion: 2,
    storageObjectVersion: "object-version-2",
    actorUserId: "admin-1",
  }, { database: database(tx) as never, now: () => now });

  assert.equal(result.fileAssetId, "file-2");
  assert.deepEqual(attemptUpdates[0].where, { id: "attempt-2", status: "GENERATING", generationToken: "token-2", stagedFileAssetId: "file-2" });
  assert.equal((attemptUpdates[0].data as { status: string }).status, "COMPLETED");
  assert.deepEqual(artifactUpdates[0].where, { id: "artifact-1", status: "GENERATING", latestAttemptNumber: 2 });
  assert.equal((artifactUpdates[0].data as { completedFileAssetId: string }).completedFileAssetId, "file-2");
  assert.equal((artifactUpdates[0].data as { status: string }).status, "COMPLETED");
  assert.equal((artifactUpdates[0].data as { integrityStatus: string }).integrityStatus, "VERIFIED");
  assert.equal(audits.length, 1);
});

test("lease renewal rejects expired attempts without extending them", async () => {
  let writes = 0;
  const tx = {
    grantReportExportAttempt: {
      findUnique: async () => ({ id: "attempt-1", status: "GENERATING", generationToken: "token-1", attemptNumber: 1, leaseExpiresAt: new Date("2027-01-01T09:59:00.000Z"), artifact: { status: "GENERATING", latestAttemptNumber: 1 } }),
      update: async () => { writes += 1; },
    },
  };
  await assert.rejects(
    () => renewGrantReportExportAttemptLease({ kind: "claimed", artifactId: "artifact-1", attemptId: "attempt-1", attemptNumber: 1, generationToken: "token-1", leaseExpiresAt: new Date(), reportId: "report-1", versionId: "version-1" }, { database: database(tx) as never, now: () => new Date("2027-01-01T10:00:00.000Z") }),
    (error: unknown) => error instanceof GrantReportExportLifecycleError && error.code === "ATTEMPT_EXPIRED",
  );
  assert.equal(writes, 0);
});

test("an expired cleanup lease cannot detach or delete its staged file", async () => {
  let writes = 0;
  const tx = {
    grantReportExportAttempt: {
      findUnique: async () => ({
        status: "FAILED",
        cleanupToken: "cleanup-token",
        cleanupLeaseExpiresAt: new Date("2027-01-01T09:59:00.000Z"),
        stagedFileAssetId: "file-1",
      }),
      update: async () => { writes += 1; },
    },
    fileAsset: { delete: async () => { writes += 1; } },
    auditLog: { create: async () => { writes += 1; } },
  };
  await assert.rejects(
    () => completeGrantReportExportCleanup({
      artifactId: "artifact-1",
      attemptId: "attempt-1",
      attemptNumber: 1,
      generationToken: "generation-token",
      cleanupToken: "cleanup-token",
      fileAssetId: "file-1",
      storageKey: "unused-in-repository-finalization",
      reportId: "report-1",
      versionId: "version-1",
      actorUserId: "admin-1",
    }, { database: database(tx) as never, now: () => new Date("2027-01-01T10:00:00.000Z") }),
    (error: unknown) => error instanceof GrantReportExportLifecycleError && error.code === "CLEANUP_NOT_AVAILABLE",
  );
  assert.equal(writes, 0);
});
