import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import {
  claimGrantReportExportAttempt,
  completeGrantReportExportAttempt,
  renewGrantReportExportAttemptLease,
} from "../lifecycle-repository";
import { createSubmittedReportFixture } from "./fixture-factory";
import { bounded, createBarrier, createIntegrationClient, databaseIntegrationTest, uniqueTestId, withIntegrationClient } from "./integration-test-context";

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
    await client.grantReportExportAttempt.update({ where: { id: first.attemptId }, data: { leaseExpiresAt: new Date(Date.now() - 1) } });
    const second = await claimGrantReportExportAttempt({ reportId: fixture.reportId, versionId: fixture.versionId, actorUserId: fixture.adminUserId }, { database: client as never });
    assert.equal(second.kind, "claimed");
    await assert.rejects(() => renewGrantReportExportAttemptLease(first, { database: client as never }));
    await assert.rejects(() => completeGrantReportExportAttempt({ ...first, fileAssetId: `${fixture.prefix}_missing`, sha256: "a".repeat(64), byteSize: 100, manifestSchemaVersion: 1, actorUserId: fixture.adminUserId }, { database: client as never }));
    const artifact = await client.grantReportExportArtifact.findUniqueOrThrow({ where: { id: first.artifactId } });
    assert.equal(artifact.latestAttemptNumber, 2);
    assert.equal(artifact.completedFileAssetId, null);
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

databaseIntegrationTest("cleanup claims remain bound to the exact failed attempt and staged file", async () => {
  await withIntegrationClient(async (client) => {
    const fixture = await createSubmittedReportFixture(client, uniqueTestId("cleanup-ownership"));
    const claim = await claimGrantReportExportAttempt({ reportId: fixture.reportId, versionId: fixture.versionId, actorUserId: fixture.adminUserId }, { database: client as never });
    assert.equal(claim.kind, "claimed");
    if (claim.kind !== "claimed") return;
    const fileId = `${fixture.prefix}_failed_file`;
    await client.fileAsset.create({ data: { id: fileId, storageProvider: "supabase", storageKey: `${fixture.prefix}/failed.zip`, originalFilename: "failed.zip", mimeType: "application/zip", fileSize: 100, checksum: "d".repeat(64), uploadedByUserId: fixture.adminUserId } });
    const finishedAt = new Date();
    await client.grantReportExportAttempt.update({ where: { id: claim.attemptId }, data: { stagedFileAssetId: fileId, status: "FAILED", finishedAt, failureCode: "STORAGE_UPLOAD_FAILED", cleanupEligibleAt: finishedAt } });
    await client.grantReportExportArtifact.update({ where: { id: claim.artifactId }, data: { status: "FAILED" } });
    const token = "e".repeat(64);
    const lease = new Date(Date.now() + 120_000);
    const winner = await client.grantReportExportAttempt.updateMany({ where: { id: claim.attemptId, stagedFileAssetId: fileId, cleanupToken: null }, data: { cleanupToken: token, cleanupLeaseExpiresAt: lease } });
    const loser = await client.grantReportExportAttempt.updateMany({ where: { id: claim.attemptId, stagedFileAssetId: `${fileId}_other`, cleanupToken: null }, data: { cleanupToken: "f".repeat(64), cleanupLeaseExpiresAt: lease } });
    assert.equal(winner.count, 1);
    assert.equal(loser.count, 0);
  });
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
