import assert from "node:assert/strict";
import test from "node:test";
import {
  claimGrantReportExportAttempt,
  claimGrantReportExportCleanup,
  completeGrantReportExportCleanup,
  completeGrantReportExportAttempt,
  renewGrantReportExportAttemptLease,
  renewGrantReportExportCleanupLease,
  stageGrantReportExportFile,
} from "@/lib/grant-report-export/lifecycle-repository";
import { GrantReportExportLifecycleError } from "@/lib/grant-report-export/export-lifecycle";

type RawQuery = { sql: string; values: unknown[] };

function database(transaction: Record<string, unknown>, isolation: string[] = []) {
  return {
    $transaction: async (operation: (tx: unknown) => Promise<unknown>, options: { isolationLevel: string }) => {
      isolation.push(options.isolationLevel);
      return operation(transaction);
    },
  };
}

function rawQuery(value: unknown): RawQuery {
  const query = value as Partial<RawQuery>;
  assert.equal(typeof query.sql, "string");
  assert.ok(Array.isArray(query.values));
  return query as RawQuery;
}

const claimed = {
  kind: "claimed" as const,
  artifactId: "artifact-1",
  attemptId: "attempt-1",
  attemptNumber: 1,
  generationToken: "token-1",
  leaseExpiresAt: new Date("2027-01-01T10:05:00.000Z"),
  reportId: "report-1",
  versionId: "version-1",
};

test("expired leases are abandoned with a database-clock predicate before a retry is created", async () => {
  const startedAt = new Date("2027-01-01T10:00:00.000Z");
  const leaseExpiresAt = new Date("2027-01-01T10:05:00.000Z");
  const queries: RawQuery[] = [];
  const artifactUpdates: Array<Record<string, unknown>> = [];
  const attemptsCreated: Array<Record<string, unknown>> = [];
  const isolation: string[] = [];
  const tx = {
    $queryRaw: async (value: unknown) => {
      const query = rawQuery(value);
      queries.push(query);
      return queries.length === 1 ? [{ id: "attempt-1" }] : [{ startedAt, leaseExpiresAt }];
    },
    grantReportVersion: { findFirst: async () => ({ status: "SUBMITTED", report: { status: "SUBMITTED" } }) },
    grantReportExportArtifact: {
      findUnique: async () => ({ id: "artifact-1", status: "GENERATING", latestAttemptNumber: 1, completedFileAssetId: null, sha256: null, byteSize: null, completedAt: null }),
      updateMany: async (args: Record<string, unknown>) => { artifactUpdates.push(args); return { count: 1 }; },
    },
    grantReportExportAttempt: {
      findUnique: async () => ({ id: "attempt-1", attemptNumber: 1, generationToken: "old-token", status: "GENERATING", leaseExpiresAt: new Date("1990-01-01"), stagedFileAssetId: "file-old" }),
      create: async (args: Record<string, unknown>) => { attemptsCreated.push(args); return { id: "attempt-2" }; },
    },
    auditLog: { create: async () => ({}) },
  };

  const result = await claimGrantReportExportAttempt(
    { reportId: "report-1", versionId: "version-1", actorUserId: "admin-1" },
    { database: database(tx, isolation) as never, token: () => "new-token", cleanupQuarantineMilliseconds: 600_000 },
  );

  assert.equal(result.kind, "claimed");
  assert.equal(result.kind === "claimed" ? result.attemptNumber : null, 2);
  assert.deepEqual(isolation, ["Serializable"]);
  assert.match(queries[0].sql, /clock_timestamp\(\)/);
  assert.match(queries[0].sql, /"leaseExpiresAt" <= "databaseClock"\."now"/);
  assert.deepEqual(queries[0].values, [600_000, "attempt-1", "old-token", 1, "artifact-1"]);
  assert.match(queries[1].sql, /clock_timestamp\(\)/);
  assert.deepEqual(queries[1].values, [300_000]);
  assert.deepEqual((attemptsCreated[0].data as { startedAt: Date }).startedAt, startedAt);
  assert.deepEqual((attemptsCreated[0].data as { leaseExpiresAt: Date }).leaseExpiresAt, leaseExpiresAt);
  assert.equal((artifactUpdates[0].data as { latestAttemptNumber: number }).latestAttemptNumber, 2);
});

test("a database-valid lease is reused even when its Date value appears expired to the process", async () => {
  let writes = 0;
  const queries: RawQuery[] = [];
  const tx = {
    $queryRaw: async (value: unknown) => { queries.push(rawQuery(value)); return []; },
    grantReportVersion: { findFirst: async () => ({ status: "SUBMITTED", report: { status: "SUBMITTED" } }) },
    grantReportExportArtifact: { findUnique: async () => ({ id: "artifact-1", status: "GENERATING", latestAttemptNumber: 1, completedFileAssetId: null, sha256: null, byteSize: null, completedAt: null }) },
    grantReportExportAttempt: {
      findUnique: async () => ({ id: "attempt-1", attemptNumber: 1, generationToken: "token", status: "GENERATING", leaseExpiresAt: new Date("1990-01-01"), stagedFileAssetId: null }),
      create: async () => { writes += 1; },
    },
    auditLog: { create: async () => { writes += 1; } },
  };
  const result = await claimGrantReportExportAttempt(
    { reportId: "report-1", versionId: "version-1", actorUserId: "admin-1" },
    { database: database(tx) as never },
  );
  assert.equal(result.kind, "in_progress");
  assert.equal(writes, 0);
  assert.match(queries[0].sql, /clock_timestamp\(\)/);
});

test("lease renewal is one parameterized database-clock ownership update", async () => {
  const renewedUntil = new Date("2027-01-01T10:05:00.000Z");
  const queries: RawQuery[] = [];
  const tx = {
    $queryRaw: async (value: unknown) => { queries.push(rawQuery(value)); return [{ leaseExpiresAt: renewedUntil }]; },
    grantReportExportAttempt: {
      findUnique: async () => ({ id: "attempt-1", status: "GENERATING", generationToken: "token-1", attemptNumber: 1, leaseExpiresAt: new Date("1990-01-01"), artifact: { status: "GENERATING", latestAttemptNumber: 1 } }),
    },
  };
  const result = await renewGrantReportExportAttemptLease(claimed, { database: database(tx) as never });
  assert.deepEqual(result, renewedUntil);
  assert.match(queries[0].sql, /UPDATE "GrantReportExportAttempt"/);
  assert.match(queries[0].sql, /"leaseExpiresAt" > "databaseClock"\."now"/);
  assert.deepEqual(queries[0].values, [300_000, "attempt-1", "token-1", 1]);
});

test("a zero-row lease renewal is treated as database-authoritative expiration", async () => {
  const tx = {
    $queryRaw: async () => [],
    grantReportExportAttempt: {
      findUnique: async () => ({ id: "attempt-1", status: "GENERATING", generationToken: "token-1", attemptNumber: 1, leaseExpiresAt: new Date("2999-01-01"), artifact: { status: "GENERATING", latestAttemptNumber: 1 } }),
    },
  };
  await assert.rejects(
    () => renewGrantReportExportAttemptLease(claimed, { database: database(tx) as never }),
    (error: unknown) => error instanceof GrantReportExportLifecycleError && error.code === "ATTEMPT_EXPIRED",
  );
});

test("completion rejects stale attempts and mismatched staged files before SQL mutation", async () => {
  let writes = 0;
  const tx = {
    $queryRaw: async () => { writes += 1; return []; },
    grantReportExportAttempt: {
      findUnique: async () => ({
        id: "attempt-1", status: "GENERATING", generationToken: "token-1", attemptNumber: 1,
        leaseExpiresAt: new Date("2027-01-01T10:05:00.000Z"), stagedFileAssetId: "file-1",
        expectedSha256: "a".repeat(64), expectedByteSize: 100, manifestSchemaVersion: 2,
        artifact: { id: "artifact-1", status: "GENERATING", latestAttemptNumber: 2, reportVersion: { status: "SUBMITTED", report: { status: "SUBMITTED" } } },
      }),
    },
  };
  await assert.rejects(
    () => completeGrantReportExportAttempt({ ...claimed, fileAssetId: "file-2", sha256: "a".repeat(64), byteSize: 100, manifestSchemaVersion: 2, actorUserId: "admin-1" }, { database: database(tx) as never }),
    (error: unknown) => error instanceof GrantReportExportLifecycleError && error.code === "STALE_ATTEMPT",
  );
  assert.equal(writes, 0);
});

test("completion uses an atomic database lease predicate and database completion timestamp", async () => {
  const completedAt = new Date("2027-01-01T10:00:00.000Z");
  const queries: RawQuery[] = [];
  const artifactUpdates: Array<Record<string, unknown>> = [];
  const tx = {
    $queryRaw: async (value: unknown) => { queries.push(rawQuery(value)); return [{ finishedAt: completedAt }]; },
    grantReportExportAttempt: {
      findUnique: async () => ({
        id: "attempt-1", status: "GENERATING", generationToken: "token-1", attemptNumber: 1,
        leaseExpiresAt: new Date("2999-01-01"), stagedFileAssetId: "file-1",
        expectedSha256: "c".repeat(64), expectedByteSize: 2048, manifestSchemaVersion: 2,
        artifact: { id: "artifact-1", status: "GENERATING", latestAttemptNumber: 1, reportVersion: { status: "SUBMITTED", report: { status: "SUBMITTED" } } },
      }),
    },
    grantReportExportArtifact: { updateMany: async (args: Record<string, unknown>) => { artifactUpdates.push(args); return { count: 1 }; } },
    auditLog: { create: async () => ({}) },
  };
  const result = await completeGrantReportExportAttempt({
    ...claimed, fileAssetId: "file-1", sha256: "c".repeat(64), byteSize: 2048,
    manifestSchemaVersion: 2, actorUserId: "admin-1",
  }, { database: database(tx) as never });
  assert.deepEqual(result.completedAt, completedAt);
  assert.match(queries[0].sql, /clock_timestamp\(\)/);
  assert.match(queries[0].sql, /"artifact"\."latestAttemptNumber" = "attempt"\."attemptNumber"/);
  assert.deepEqual(queries[0].values, ["attempt-1", "token-1", 1, "file-1"]);
  assert.deepEqual((artifactUpdates[0].data as { completedAt: Date }).completedAt, completedAt);
});

test("file staging rejects a storage path owned by a different attempt before database access", async () => {
  let databaseAccesses = 0;
  await assert.rejects(
    () => stageGrantReportExportFile({
      ...claimed, attemptId: "attempt-2", attemptNumber: 2, generationToken: "token-2", fileAssetId: "file-2",
      storageKey: "grant-report-exports/report-1/version-1/artifact-1/attempt-1-wrong/file-2/ECDLink-Submission-Pack.zip",
      sha256: "c".repeat(64), byteSize: 2048, manifestSchemaVersion: 2, actorUserId: "admin-1",
    }, { database: { $transaction: async () => { databaseAccesses += 1; } } as never }),
    (error: unknown) => error instanceof GrantReportExportLifecycleError && error.code === "INVALID_STORAGE_PATH",
  );
  assert.equal(databaseAccesses, 0);
});

test("cleanup claim recovery uses one database clock for quarantine, expiry and new deadline", async () => {
  const cleanupLeaseExpiresAt = new Date("2027-01-01T10:02:00.000Z");
  const queries: RawQuery[] = [];
  const tx = {
    $queryRaw: async (value: unknown) => { queries.push(rawQuery(value)); return [{ cleanupLeaseExpiresAt }]; },
    grantReportExportAttempt: {
      findUnique: async () => ({
        id: "attempt-1", attemptNumber: 1, generationToken: "generation-token", status: "FAILED",
        stagedFileAssetId: "file-1", cleanupEligibleAt: new Date("2999-01-01"), cleanupToken: "old-token",
        cleanupLeaseExpiresAt: new Date("2999-01-01"), cleanedAt: null,
        stagedFile: { id: "file-1", storageProvider: "supabase", storageKey: "owned-key" },
        artifact: { id: "artifact-1", grantReportId: "report-1", grantReportVersionId: "version-1" },
      }),
    },
  };
  const result = await claimGrantReportExportCleanup(
    { attemptId: "attempt-1", actorUserId: "admin-1" },
    { database: database(tx) as never, token: () => "new-cleanup-token" },
  );
  assert.equal(result.cleanupToken, "new-cleanup-token");
  assert.match(queries[0].sql, /"cleanupEligibleAt" <= "databaseClock"\."now"/);
  assert.match(queries[0].sql, /"cleanupLeaseExpiresAt" <= "databaseClock"\."now"/);
  assert.deepEqual(queries[0].values, ["new-cleanup-token", 120_000, "attempt-1", "file-1"]);
});

test("a zero-row cleanup completion cannot detach or delete the staged file", async () => {
  let writes = 0;
  const tx = {
    $queryRaw: async () => [],
    grantReportExportAttempt: {
      findUnique: async () => ({ status: "FAILED", cleanupToken: "cleanup-token", cleanupLeaseExpiresAt: new Date("2999-01-01"), stagedFileAssetId: "file-1" }),
    },
    fileAsset: { delete: async () => { writes += 1; } },
    auditLog: { create: async () => { writes += 1; } },
  };
  await assert.rejects(
    () => completeGrantReportExportCleanup({
      artifactId: "artifact-1", attemptId: "attempt-1", attemptNumber: 1, generationToken: "generation-token",
      cleanupToken: "cleanup-token", fileAssetId: "file-1", storageKey: "unused-in-repository-finalization",
      reportId: "report-1", versionId: "version-1", actorUserId: "admin-1",
    }, { database: database(tx) as never }),
    (error: unknown) => error instanceof GrantReportExportLifecycleError && error.code === "CLEANUP_NOT_AVAILABLE",
  );
  assert.equal(writes, 0);
});

test("cleanup renewal uses exact ownership and a single database clock", async () => {
  const renewedUntil = new Date("2027-01-01T10:02:00.000Z");
  const queries: RawQuery[] = [];
  const tx = {
    $queryRaw: async (value: unknown) => { queries.push(rawQuery(value)); return [{ cleanupLeaseExpiresAt: renewedUntil }]; },
  };
  const result = await renewGrantReportExportCleanupLease({
    artifactId: "artifact-1", attemptId: "attempt-1", attemptNumber: 1,
    generationToken: "generation-token", cleanupToken: "cleanup-token",
    fileAssetId: "file-1", storageKey: "owned-key", reportId: "report-1", versionId: "version-1",
  }, { database: database(tx) as never });
  assert.deepEqual(result, renewedUntil);
  assert.match(queries[0].sql, /clock_timestamp\(\)/);
  assert.match(queries[0].sql, /"cleanupLeaseExpiresAt" > "databaseClock"\."now"/);
  assert.deepEqual(queries[0].values, [120_000, "attempt-1", 1, "generation-token", "cleanup-token", "file-1"]);
});
