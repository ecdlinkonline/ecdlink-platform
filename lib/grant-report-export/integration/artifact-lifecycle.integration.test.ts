import assert from "node:assert/strict";
import { Prisma, type PrismaClient } from "@prisma/client";
import { buildGrantReportExportStoragePath, GrantReportExportLifecycleError } from "../export-lifecycle";
import {
  claimGrantReportExportAttempt,
  claimGrantReportExportCleanup,
  completeGrantReportExportAttempt,
  completeGrantReportExportCleanup,
  releaseGrantReportExportCleanup,
  renewGrantReportExportAttemptLease,
  renewGrantReportExportCleanupLease,
  stageGrantReportExportFile,
} from "../lifecycle-repository";
import { createSubmittedReportFixture } from "./fixture-factory";
import { bounded, createBarrier, createIntegrationClient, databaseIntegrationTest, uniqueTestId, withIntegrationClient } from "./integration-test-context";

type LifecycleErrorCode = GrantReportExportLifecycleError["code"];

function isLifecycleError(...expectedCodes: LifecycleErrorCode[]) {
  return (error: unknown) => {
    assert.ok(error instanceof GrantReportExportLifecycleError);
    assert.ok(expectedCodes.includes(error.code), `Unexpected lifecycle error code: ${error.code}`);
    return true;
  };
}

function assertLifecycleRejection(
  outcome: PromiseSettledResult<unknown>,
  ...expectedCodes: LifecycleErrorCode[]
) {
  assert.equal(outcome.status, "rejected");
  if (outcome.status !== "rejected") return;
  assert.ok(outcome.reason instanceof GrantReportExportLifecycleError);
  assert.ok(
    expectedCodes.includes(outcome.reason.code),
    `Unexpected lifecycle error code: ${outcome.reason.code}`,
  );
}

function synchronizedDatabase(client: PrismaClient, barrier: () => Promise<void>) {
  return {
    $transaction: <T>(operation: (tx: Prisma.TransactionClient) => Promise<T>, options: { isolationLevel: Prisma.TransactionIsolationLevel }) => client.$transaction(async (tx) => {
      await barrier();
      return operation(tx);
    }, options),
  };
}

async function createCleanupEligibleAttempt(client: PrismaClient, suffix: string) {
  const fixture = await createSubmittedReportFixture(client, uniqueTestId(suffix));
  const claim = await claimGrantReportExportAttempt(
    { reportId: fixture.reportId, versionId: fixture.versionId, actorUserId: fixture.adminUserId },
    { database: client as never },
  );
  assert.equal(claim.kind, "claimed");
  if (claim.kind !== "claimed") throw new Error("The cleanup fixture did not acquire a generation attempt.");
  const fileId = `${fixture.prefix}_failed_file`;
  await client.fileAsset.create({
    data: {
      id: fileId,
      storageProvider: "supabase",
      storageKey: `${fixture.prefix}/failed.zip`,
      originalFilename: "failed.zip",
      mimeType: "application/zip",
      fileSize: 100,
      checksum: "d".repeat(64),
      uploadedByUserId: fixture.adminUserId,
    },
  });
  await client.$executeRaw(Prisma.sql`
    UPDATE "GrantReportExportAttempt"
    SET
      "stagedFileAssetId" = ${fileId},
      "status" = 'FAILED',
      "finishedAt" = clock_timestamp(),
      "failureCode" = 'STORAGE_UPLOAD_FAILED',
      "cleanupEligibleAt" = clock_timestamp()
    WHERE "id" = ${claim.attemptId}
  `);
  await client.grantReportExportArtifact.update({ where: { id: claim.artifactId }, data: { status: "FAILED" } });
  return { fixture, claim, fileId };
}

databaseIntegrationTest("concurrent generation claims create one current attempt with a five-minute lease", async () => {
  const setup = await createIntegrationClient();
  const first = await createIntegrationClient();
  const second = await createIntegrationClient();
  try {
    const fixture = await createSubmittedReportFixture(setup.client, uniqueTestId("concurrent-generation"));
    const barrier = createBarrier(2);
    function database(client: typeof first.client) {
      return {
        $transaction: <T>(operation: (tx: Prisma.TransactionClient) => Promise<T>, options: Parameters<typeof client.$transaction>[1]) => client.$transaction(async (tx) => {
          await barrier();
          return operation(tx);
        }, options as never),
      };
    }
    const startedAt = Date.now();
    const results = await bounded(Promise.all([
      claimGrantReportExportAttempt({ reportId: fixture.reportId, versionId: fixture.versionId, actorUserId: fixture.adminUserId }, { database: database(first.client) as never }),
      claimGrantReportExportAttempt({ reportId: fixture.reportId, versionId: fixture.versionId, actorUserId: fixture.adminUserId }, { database: database(second.client) as never }),
    ]), 15_000);
    assert.equal(results.filter((result) => result.kind === "claimed").length, 1);
    assert.equal(results.filter((result) => result.kind === "in_progress").length, 1);
    const claimed = results.find((result) => result.kind === "claimed");
    assert.ok(claimed?.kind === "claimed");
    const leaseDuration = claimed.leaseExpiresAt.getTime() - startedAt;
    assert.ok(leaseDuration >= 299_000 && leaseDuration <= 301_000);
    assert.equal(await setup.client.grantReportExportArtifact.count({ where: { grantReportVersionId: fixture.versionId } }), 1);
    assert.equal(await setup.client.grantReportExportAttempt.count({ where: { artifact: { grantReportVersionId: fixture.versionId } } }), 1);
    assert.equal(await setup.client.auditLog.count({ where: { action: "grant.report.export.generation_started", entityId: claimed.artifactId } }), 1);
  } finally {
    await Promise.all([setup.disconnect(), first.disconnect(), second.disconnect()]);
  }
});

databaseIntegrationTest("a stale generation worker cannot renew or complete after a newer attempt owns the artifact", async () => {
  await withIntegrationClient(async (client) => {
    const fixture = await createSubmittedReportFixture(client, uniqueTestId("stale-generation"));
    const first = await claimGrantReportExportAttempt({ reportId: fixture.reportId, versionId: fixture.versionId, actorUserId: fixture.adminUserId }, { database: client as never, generationLeaseMilliseconds: 1 });
    assert.equal(first.kind, "claimed");
    if (first.kind !== "claimed") return;
    await client.$executeRaw(Prisma.sql`
      UPDATE "GrantReportExportAttempt"
      SET "leaseExpiresAt" = clock_timestamp() - interval '1 millisecond'
      WHERE "id" = ${first.attemptId}
    `);
    const second = await claimGrantReportExportAttempt({ reportId: fixture.reportId, versionId: fixture.versionId, actorUserId: fixture.adminUserId }, { database: client as never });
    assert.equal(second.kind, "claimed");
    await assert.rejects(
      () => renewGrantReportExportAttemptLease(first, { database: client as never }),
      isLifecycleError("STALE_ATTEMPT"),
    );
    await assert.rejects(
      () => completeGrantReportExportAttempt({ ...first, fileAssetId: `${fixture.prefix}_missing`, sha256: "a".repeat(64), byteSize: 100, manifestSchemaVersion: 1, actorUserId: fixture.adminUserId }, { database: client as never }),
      isLifecycleError("STALE_ATTEMPT"),
    );
    const artifact = await client.grantReportExportArtifact.findUniqueOrThrow({ where: { id: first.artifactId } });
    assert.equal(artifact.latestAttemptNumber, 2);
    assert.equal(artifact.completedFileAssetId, null);
  });
});

databaseIntegrationTest("the current generation owner renews through the PostgreSQL clock while a stale token is rejected", async () => {
  await withIntegrationClient(async (client) => {
    const fixture = await createSubmittedReportFixture(client, uniqueTestId("generation-renewal"));
    const claim = await claimGrantReportExportAttempt(
      { reportId: fixture.reportId, versionId: fixture.versionId, actorUserId: fixture.adminUserId },
      { database: client as never, generationLeaseMilliseconds: 30_000 },
    );
    assert.equal(claim.kind, "claimed");
    if (claim.kind !== "claimed") return;
    const renewedLease = await renewGrantReportExportAttemptLease(claim, {
      database: client as never,
      generationLeaseMilliseconds: 300_000,
    });
    assert.ok(renewedLease > claim.leaseExpiresAt);
    const persisted = await client.grantReportExportAttempt.findUniqueOrThrow({ where: { id: claim.attemptId } });
    assert.equal(persisted.generationToken, claim.generationToken);
    assert.equal(persisted.attemptNumber, claim.attemptNumber);
    assert.equal(persisted.leaseExpiresAt.getTime(), renewedLease.getTime());
    await assert.rejects(() => renewGrantReportExportAttemptLease(
      { ...claim, generationToken: "0".repeat(64) },
      { database: client as never },
    ), isLifecycleError("STALE_ATTEMPT"));
  });
});

databaseIntegrationTest("generation lease equality is atomically ineligible while repository renewal accepts future and rejects expired leases", async () => {
  await withIntegrationClient(async (client) => {
    const fixture = await createSubmittedReportFixture(client, uniqueTestId("generation-clock-boundaries"));
    const first = await claimGrantReportExportAttempt(
      { reportId: fixture.reportId, versionId: fixture.versionId, actorUserId: fixture.adminUserId },
      { database: client as never },
    );
    assert.equal(first.kind, "claimed");
    if (first.kind !== "claimed") return;
    await client.$executeRaw(Prisma.sql`
      UPDATE "GrantReportExportAttempt"
      SET "leaseExpiresAt" = clock_timestamp() + interval '1 minute'
      WHERE "id" = ${first.attemptId}
    `);
    await renewGrantReportExportAttemptLease(first, { database: client as never });

    const boundary = await client.$queryRaw<Array<{ atBoundary: boolean; eligible: boolean }>>(Prisma.sql`
      WITH "databaseClock" AS MATERIALIZED (
        SELECT date_trunc('milliseconds', timezone('UTC', clock_timestamp())) AS "now"
      ),
      "boundary" AS (
        UPDATE "GrantReportExportAttempt" AS "attempt"
        SET "leaseExpiresAt" = "databaseClock"."now"
        FROM "databaseClock"
        WHERE "attempt"."id" = ${first.attemptId}
        RETURNING "attempt"."leaseExpiresAt", "databaseClock"."now"
      )
      SELECT
        "leaseExpiresAt" = "now" AS "atBoundary",
        "leaseExpiresAt" > "now" AS "eligible"
      FROM "boundary"
    `);
    assert.equal(boundary[0]?.atBoundary, true);
    assert.equal(boundary[0]?.eligible, false);

    const second = await claimGrantReportExportAttempt(
      { reportId: fixture.reportId, versionId: fixture.versionId, actorUserId: fixture.adminUserId },
      { database: client as never },
    );
    assert.equal(second.kind, "claimed");
    if (second.kind !== "claimed") return;
    await client.$executeRaw(Prisma.sql`
      UPDATE "GrantReportExportAttempt"
      SET "leaseExpiresAt" = clock_timestamp() - interval '1 millisecond'
      WHERE "id" = ${second.attemptId}
    `);
    await assert.rejects(
      () => renewGrantReportExportAttemptLease(second, { database: client as never }),
      isLifecycleError("ATTEMPT_EXPIRED"),
    );
  });
});

databaseIntegrationTest("an expired database lease rolls back staged FileAsset creation", async () => {
  await withIntegrationClient(async (client) => {
    const fixture = await createSubmittedReportFixture(client, uniqueTestId("expired-stage-rollback"));
    const claim = await claimGrantReportExportAttempt(
      { reportId: fixture.reportId, versionId: fixture.versionId, actorUserId: fixture.adminUserId },
      { database: client as never },
    );
    assert.equal(claim.kind, "claimed");
    if (claim.kind !== "claimed") return;
    await client.$executeRaw(Prisma.sql`
      UPDATE "GrantReportExportAttempt"
      SET "leaseExpiresAt" = clock_timestamp() - interval '1 millisecond'
      WHERE "id" = ${claim.attemptId}
    `);
    const fileAssetId = `${fixture.prefix}_rolled_back_file`;
    const storageKey = buildGrantReportExportStoragePath({
      reportId: claim.reportId,
      versionId: claim.versionId,
      artifactId: claim.artifactId,
      attemptNumber: claim.attemptNumber,
      generationToken: claim.generationToken,
      fileAssetId,
    });
    await assert.rejects(() => stageGrantReportExportFile({
      ...claim,
      fileAssetId,
      storageKey,
      sha256: "b".repeat(64),
      byteSize: 100,
      manifestSchemaVersion: 1,
      actorUserId: fixture.adminUserId,
    }, { database: client as never }));
    assert.equal(await client.fileAsset.count({ where: { id: fileAssetId } }), 0);
    assert.equal(await client.auditLog.count({ where: { action: "grant.report.export.file_staged", entityId: claim.attemptId } }), 0);
  });
});

databaseIntegrationTest("a completed artifact is reused idempotently and its identity cannot be replaced", async () => {
  await withIntegrationClient(async (client) => {
    const fixture = await createSubmittedReportFixture(client, uniqueTestId("completed-reuse"));
    const claim = await claimGrantReportExportAttempt({ reportId: fixture.reportId, versionId: fixture.versionId, actorUserId: fixture.adminUserId }, { database: client as never });
    assert.equal(claim.kind, "claimed");
    if (claim.kind !== "claimed") return;
    const fileId = `${fixture.prefix}_file`;
    await client.fileAsset.create({ data: { id: fileId, storageProvider: "supabase", storageKey: `${fixture.prefix}/pack.zip`, originalFilename: "pack.zip", mimeType: "application/zip", fileSize: 100, checksum: "c".repeat(64), uploadedByUserId: fixture.adminUserId } });
    await client.grantReportExportAttempt.update({ where: { id: claim.attemptId }, data: { stagedFileAssetId: fileId, expectedSha256: "c".repeat(64), expectedByteSize: 100, manifestSchemaVersion: 1 } });
    await completeGrantReportExportAttempt({ ...claim, fileAssetId: fileId, sha256: "c".repeat(64), byteSize: 100, manifestSchemaVersion: 1, actorUserId: fixture.adminUserId }, { database: client as never });
    const reused = await claimGrantReportExportAttempt({ reportId: fixture.reportId, versionId: fixture.versionId, actorUserId: fixture.adminUserId }, { database: client as never });
    assert.equal(reused.kind, "completed");
    if (reused.kind === "completed") assert.equal(reused.fileAssetId, fileId);
    await assert.rejects(() => client.grantReportExportArtifact.update({ where: { id: claim.artifactId }, data: { completedFileAssetId: null } }));
  });
});

databaseIntegrationTest("database-clock cleanup recovery fences the expired owner from completion", async () => {
  await withIntegrationClient(async (client) => {
    const fixture = await createSubmittedReportFixture(client, uniqueTestId("cleanup-ownership"));
    const claim = await claimGrantReportExportAttempt({ reportId: fixture.reportId, versionId: fixture.versionId, actorUserId: fixture.adminUserId }, { database: client as never });
    assert.equal(claim.kind, "claimed");
    if (claim.kind !== "claimed") return;
    const fileId = `${fixture.prefix}_failed_file`;
    await client.fileAsset.create({ data: { id: fileId, storageProvider: "supabase", storageKey: `${fixture.prefix}/failed.zip`, originalFilename: "failed.zip", mimeType: "application/zip", fileSize: 100, checksum: "d".repeat(64), uploadedByUserId: fixture.adminUserId } });
    const databaseNow = (await client.$queryRaw<Array<{ now: Date }>>(Prisma.sql`SELECT clock_timestamp() AS now`))[0].now;
    await client.grantReportExportAttempt.update({ where: { id: claim.attemptId }, data: { stagedFileAssetId: fileId, status: "FAILED", finishedAt: databaseNow, failureCode: "STORAGE_UPLOAD_FAILED", cleanupEligibleAt: databaseNow } });
    await client.grantReportExportArtifact.update({ where: { id: claim.artifactId }, data: { status: "FAILED" } });
    const firstCleanup = await claimGrantReportExportCleanup(
      { attemptId: claim.attemptId, actorUserId: fixture.adminUserId },
      { database: client as never, token: () => "e".repeat(64) },
    );
    await client.$executeRaw(Prisma.sql`
      UPDATE "GrantReportExportAttempt"
      SET "cleanupLeaseExpiresAt" = clock_timestamp() - interval '1 millisecond'
      WHERE "id" = ${claim.attemptId}
    `);
    await assert.rejects(
      () => renewGrantReportExportCleanupLease(firstCleanup, { database: client as never }),
      isLifecycleError("CLEANUP_NOT_AVAILABLE"),
    );
    const recoveredCleanup = await claimGrantReportExportCleanup(
      { attemptId: claim.attemptId, actorUserId: fixture.adminUserId },
      { database: client as never, token: () => "f".repeat(64) },
    );
    assert.notEqual(recoveredCleanup.cleanupToken, firstCleanup.cleanupToken);
    assert.equal(await releaseGrantReportExportCleanup(
      { ...firstCleanup, actorUserId: fixture.adminUserId, failureCode: "STALE_CLEANUP_OWNER" },
      { database: client as never },
    ), false);
    assert.equal(
      (await client.grantReportExportAttempt.findUniqueOrThrow({ where: { id: claim.attemptId } })).cleanupToken,
      recoveredCleanup.cleanupToken,
    );
    await assert.rejects(() => completeGrantReportExportCleanup(
      { ...firstCleanup, actorUserId: fixture.adminUserId },
      { database: client as never },
    ), isLifecycleError("CLEANUP_NOT_AVAILABLE"));
    await completeGrantReportExportCleanup(
      { ...recoveredCleanup, actorUserId: fixture.adminUserId },
      { database: client as never },
    );
    const cleaned = await client.grantReportExportAttempt.findUniqueOrThrow({ where: { id: claim.attemptId } });
    assert.ok(cleaned.cleanedAt);
    assert.equal(cleaned.stagedFileAssetId, null);
    assert.equal(await client.fileAsset.count({ where: { id: fileId } }), 0);
  });
});

databaseIntegrationTest("cleanup lease equality is atomically ineligible while repository renewal accepts future and rejects expired leases", async () => {
  await withIntegrationClient(async (client) => {
    const firstFixture = await createCleanupEligibleAttempt(client, "cleanup-clock-boundaries");
    const first = await claimGrantReportExportCleanup(
      { attemptId: firstFixture.claim.attemptId, actorUserId: firstFixture.fixture.adminUserId },
      { database: client as never, token: () => "5".repeat(64) },
    );
    await client.$executeRaw(Prisma.sql`
      UPDATE "GrantReportExportAttempt"
      SET "cleanupLeaseExpiresAt" = clock_timestamp() + interval '1 minute'
      WHERE "id" = ${first.attemptId}
    `);
    await renewGrantReportExportCleanupLease(first, { database: client as never });

    const boundary = await client.$queryRaw<Array<{ atBoundary: boolean; eligible: boolean }>>(Prisma.sql`
      WITH "databaseClock" AS MATERIALIZED (
        SELECT date_trunc('milliseconds', timezone('UTC', clock_timestamp())) AS "now"
      ),
      "boundary" AS (
        UPDATE "GrantReportExportAttempt" AS "attempt"
        SET "cleanupLeaseExpiresAt" = "databaseClock"."now"
        FROM "databaseClock"
        WHERE "attempt"."id" = ${first.attemptId}
        RETURNING "attempt"."cleanupLeaseExpiresAt", "databaseClock"."now"
      )
      SELECT
        "cleanupLeaseExpiresAt" = "now" AS "atBoundary",
        "cleanupLeaseExpiresAt" > "now" AS "eligible"
      FROM "boundary"
    `);
    assert.equal(boundary[0]?.atBoundary, true);
    assert.equal(boundary[0]?.eligible, false);

    const recovered = await claimGrantReportExportCleanup(
      { attemptId: firstFixture.claim.attemptId, actorUserId: firstFixture.fixture.adminUserId },
      { database: client as never, token: () => "6".repeat(64) },
    );
    await client.$executeRaw(Prisma.sql`
      UPDATE "GrantReportExportAttempt"
      SET "cleanupLeaseExpiresAt" = clock_timestamp() - interval '1 millisecond'
      WHERE "id" = ${recovered.attemptId}
    `);
    await assert.rejects(
      () => renewGrantReportExportCleanupLease(recovered, { database: client as never }),
      isLifecycleError("CLEANUP_NOT_AVAILABLE"),
    );
  });
});

databaseIntegrationTest("the current cleanup owner renews without rotating its token or completing cleanup", async () => {
  await withIntegrationClient(async (client) => {
    const { fixture, claim, fileId } = await createCleanupEligibleAttempt(client, "cleanup-renewal");
    const cleanup = await claimGrantReportExportCleanup(
      { attemptId: claim.attemptId, actorUserId: fixture.adminUserId },
      { database: client as never, token: () => "1".repeat(64), cleanupLeaseMilliseconds: 30_000 },
    );
    const renewedLease = await renewGrantReportExportCleanupLease(cleanup, {
      database: client as never,
      cleanupLeaseMilliseconds: 300_000,
    });
    const persisted = await client.grantReportExportAttempt.findUniqueOrThrow({ where: { id: claim.attemptId } });
    assert.equal(persisted.cleanupToken, cleanup.cleanupToken);
    assert.equal(persisted.cleanupLeaseExpiresAt?.getTime(), renewedLease.getTime());
    assert.equal(persisted.cleanedAt, null);
    assert.equal(persisted.stagedFileAssetId, fileId);
    await assert.rejects(() => renewGrantReportExportCleanupLease(
      { ...cleanup, cleanupToken: "2".repeat(64) },
      { database: client as never },
    ), isLifecycleError("CLEANUP_NOT_AVAILABLE"));
  });
});

databaseIntegrationTest("concurrent cleanup claims create exactly one owner and fence the losing token", async () => {
  const setup = await createIntegrationClient();
  const first = await createIntegrationClient();
  const second = await createIntegrationClient();
  try {
    const { fixture, claim, fileId } = await createCleanupEligibleAttempt(setup.client, "concurrent-cleanup");
    const barrier = createBarrier(2);
    const results = await bounded(Promise.allSettled([
      claimGrantReportExportCleanup(
        { attemptId: claim.attemptId, actorUserId: fixture.adminUserId },
        { database: synchronizedDatabase(first.client, barrier) as never, token: () => "3".repeat(64) },
      ),
      claimGrantReportExportCleanup(
        { attemptId: claim.attemptId, actorUserId: fixture.adminUserId },
        { database: synchronizedDatabase(second.client, barrier) as never, token: () => "4".repeat(64) },
      ),
    ]), 10_000);
    const winners = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
    assert.equal(winners.length, 1);
    const rejected = results.filter((result) => result.status === "rejected");
    assert.equal(rejected.length, 1);
    assertLifecycleRejection(rejected[0], "CLEANUP_NOT_AVAILABLE");
    const persisted = await setup.client.grantReportExportAttempt.findUniqueOrThrow({ where: { id: claim.attemptId } });
    assert.equal(persisted.cleanupToken, winners[0].cleanupToken);
    assert.equal(persisted.stagedFileAssetId, fileId);
    const losingToken = winners[0].cleanupToken === "3".repeat(64) ? "4".repeat(64) : "3".repeat(64);
    const losingClaim = { ...winners[0], cleanupToken: losingToken };
    await assert.rejects(() => completeGrantReportExportCleanup(
      { ...losingClaim, actorUserId: fixture.adminUserId },
      { database: setup.client as never },
    ), isLifecycleError("CLEANUP_NOT_AVAILABLE"));
    assert.equal(await releaseGrantReportExportCleanup(
      { ...losingClaim, actorUserId: fixture.adminUserId, failureCode: "LOSING_WORKER" },
      { database: setup.client as never },
    ), false);
    assert.equal(await setup.client.auditLog.count({
      where: { action: { in: ["grant.report.export.cleanup_completed", "grant.report.export.cleanup_failed"] }, entityId: claim.attemptId },
    }), 0);
  } finally {
    await Promise.all([setup.disconnect(), first.disconnect(), second.disconnect()]);
  }
});

databaseIntegrationTest("audit creation rolls back with a failed lifecycle transaction", async () => {
  await withIntegrationClient(async (client) => {
    const fixture = await createSubmittedReportFixture(client, uniqueTestId("artifact-audit-rollback"));
    const action = `${fixture.prefix}.rollback`;
    await assert.rejects(() => client.$transaction(async (tx) => {
      await tx.auditLog.create({ data: { actorUserId: fixture.adminUserId, action, entityType: "GrantReportExportArtifact", entityId: "missing" } });
      await tx.grantReportExportArtifact.create({ data: { id: `${fixture.prefix}_invalid`, grantReportId: fixture.reportId, grantReportVersionId: "wrong-version", format: "SUBMISSION_PACK_ZIP" } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
    assert.equal(await client.auditLog.count({ where: { action } }), 0);
  });
});
