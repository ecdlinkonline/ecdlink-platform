import assert from "node:assert/strict";
import test from "node:test";
import { Prisma, type PrismaClient } from "@prisma/client";
import { claimGrantReportExportAttempt, completeGrantReportExportAttempt } from "../lifecycle-repository";
import { createGrantReportExportOutboxRepository, recoverExpiredGrantReportExportDispatches } from "../outbox-repository";
import { createQueuedExportRequestFixture, createSubmittedReportFixture } from "./fixture-factory";
import { bounded, createBarrier, createIntegrationClient, databaseIntegrationTest, uniqueTestId, withIntegrationClient } from "./integration-test-context";

function synchronizedDatabase(client: PrismaClient, barrier: () => Promise<void>) {
  return {
    $transaction: <T>(operation: (tx: Prisma.TransactionClient) => Promise<T>, options: { isolationLevel: Prisma.TransactionIsolationLevel }) => client.$transaction(async (tx) => {
      await barrier();
      return operation(tx);
    }, options),
  };
}

databaseIntegrationTest("A. concurrent export request creation has one active winner", async () => {
  const setup = await createIntegrationClient();
  const first = await createIntegrationClient();
  const second = await createIntegrationClient();
  try {
    const fixture = await createSubmittedReportFixture(setup.client, uniqueTestId("A"));
    const barrier = createBarrier(2);
    const create = (client: PrismaClient, suffix: string) => client.$transaction(async (tx) => {
      await barrier();
      return createQueuedExportRequestFixture(tx, fixture, suffix);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    const results = await bounded(Promise.allSettled([create(first.client, "first"), create(second.client, "second")]), 10_000);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected").length, 1);
    assert.equal(await setup.client.grantReportExportRequest.count({ where: { grantReportVersionId: fixture.versionId, status: { in: ["QUEUED", "DISPATCHING", "DISPATCHED"] } } }), 1);
  } finally { await Promise.all([setup.disconnect(), first.disconnect(), second.disconnect()]); }
});

databaseIntegrationTest("B. concurrent dispatcher claims have one token owner", async () => {
  const setup = await createIntegrationClient();
  const first = await createIntegrationClient();
  const second = await createIntegrationClient();
  try {
    const fixture = await createSubmittedReportFixture(setup.client, uniqueTestId("B"));
    await createQueuedExportRequestFixture(setup.client, fixture);
    const barrier = createBarrier(2);
    const repositories = [
      createGrantReportExportOutboxRepository({ database: synchronizedDatabase(first.client, barrier) as never, token: () => "1".repeat(64) }),
      createGrantReportExportOutboxRepository({ database: synchronizedDatabase(second.client, barrier) as never, token: () => "2".repeat(64) }),
    ];
    const results = await bounded(Promise.allSettled(repositories.map((repository) => repository.claimPendingRequest())), 10_000);
    const claims = results.flatMap((result) => result.status === "fulfilled" && result.value ? [result.value] : []);
    assert.equal(claims.length, 1);
    assert.equal(await setup.client.auditLog.count({ where: { action: "grant.report.export.dispatch_claimed", entityId: claims[0].requestId } }), 1);
  } finally { await Promise.all([setup.disconnect(), first.disconnect(), second.disconnect()]); }
});

databaseIntegrationTest("C. stale dispatch tokens cannot mutate current ownership", async () => {
  await withIntegrationClient(async (client) => {
    const fixture = await createSubmittedReportFixture(client, uniqueTestId("C"));
    await createQueuedExportRequestFixture(client, fixture);
    const repository = createGrantReportExportOutboxRepository({ database: client as never, token: () => "3".repeat(64) });
    const claim = await repository.claimPendingRequest();
    assert.ok(claim);
    await assert.rejects(() => repository.extendDispatchLease({ ...claim!, dispatchToken: "4".repeat(64) }));
    assert.equal((await client.grantReportExportRequest.findUniqueOrThrow({ where: { id: claim!.requestId } })).dispatchToken, "3".repeat(64));
  });
});

databaseIntegrationTest("D. heartbeat and expiry recovery cannot both win", async () => {
  const setup = await createIntegrationClient();
  const first = await createIntegrationClient();
  const second = await createIntegrationClient();
  try {
    const fixture = await createSubmittedReportFixture(setup.client, uniqueTestId("D"));
    const requestId = await createQueuedExportRequestFixture(setup.client, fixture);
    const claimRepository = createGrantReportExportOutboxRepository({ database: setup.client as never, token: () => "5".repeat(64) });
    const claim = await claimRepository.claimPendingRequest();
    assert.ok(claim);
    await setup.client.$executeRaw(Prisma.sql`UPDATE "GrantReportExportRequest" SET "dispatchLeaseExpiresAt" = clock_timestamp() - interval '1 millisecond' WHERE "id" = ${requestId}`);
    const barrier = createBarrier(2);
    const heartbeatRepository = createGrantReportExportOutboxRepository({ database: synchronizedDatabase(first.client, barrier) as never });
    const outcomes = await bounded(Promise.allSettled([
      heartbeatRepository.extendDispatchLease(claim!),
      recoverExpiredGrantReportExportDispatches({ database: synchronizedDatabase(second.client, barrier) as never }),
    ]), 10_000);
    assert.equal(outcomes.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal((await setup.client.grantReportExportRequest.findUniqueOrThrow({ where: { id: requestId } })).status, "QUEUED");
  } finally { await Promise.all([setup.disconnect(), first.disconnect(), second.disconnect()]); }
});

databaseIntegrationTest("E. recovery racing publication acknowledgement has one durable outcome", async () => {
  const setup = await createIntegrationClient();
  const first = await createIntegrationClient();
  const second = await createIntegrationClient();
  try {
    const fixture = await createSubmittedReportFixture(setup.client, uniqueTestId("E"));
    const requestId = await createQueuedExportRequestFixture(setup.client, fixture);
    const owner = createGrantReportExportOutboxRepository({ database: setup.client as never, token: () => "6".repeat(64) });
    const claim = await owner.claimPendingRequest();
    assert.ok(claim);
    await setup.client.$executeRaw(Prisma.sql`UPDATE "GrantReportExportRequest" SET "dispatchLeaseExpiresAt" = clock_timestamp() - interval '1 millisecond' WHERE "id" = ${requestId}`);
    const barrier = createBarrier(2);
    const acknowledger = createGrantReportExportOutboxRepository({ database: synchronizedDatabase(first.client, barrier) as never });
    await bounded(Promise.allSettled([
      acknowledger.markPublicationSuccessful(claim!, { ok: true, messageId: "race-message", publishedAt: new Date() }),
      recoverExpiredGrantReportExportDispatches({ database: synchronizedDatabase(second.client, barrier) as never }),
    ]), 10_000);
    const request = await setup.client.grantReportExportRequest.findUniqueOrThrow({ where: { id: requestId } });
    assert.ok(["QUEUED", "DISPATCHED"].includes(request.status));
    assert.equal(await setup.client.auditLog.count({ where: { entityId: requestId, action: { in: ["grant.report.export.dispatched", "grant.report.export.dispatch_recovered"] } } }), 1);
  } finally { await Promise.all([setup.disconnect(), first.disconnect(), second.disconnect()]); }
});

databaseIntegrationTest("F. generation lease decisions demonstrate the known Node-clock skew blocker", async () => {
  await withIntegrationClient(async (client) => {
    const fixture = await createSubmittedReportFixture(client, uniqueTestId("F"));
    const databaseNow = (await client.$queryRaw<Array<{ now: Date }>>(Prisma.sql`SELECT clock_timestamp() AS now`))[0].now;
    const first = await claimGrantReportExportAttempt({ reportId: fixture.reportId, versionId: fixture.versionId, actorUserId: fixture.adminUserId }, { database: client as never, now: () => databaseNow });
    assert.equal(first.kind, "claimed");
    const skewed = await claimGrantReportExportAttempt({ reportId: fixture.reportId, versionId: fixture.versionId, actorUserId: fixture.adminUserId }, { database: client as never, now: () => new Date(databaseNow.getTime() + 10 * 60_000) });
    assert.equal(skewed.kind, "claimed", "A fast process clock incorrectly abandons the database-valid lease; this assertion documents the blocker.");
    if (skewed.kind === "claimed") assert.equal(skewed.attemptNumber, 2);
  });
});

databaseIntegrationTest("G. attempt five exhaustion is terminal", async () => {
  await withIntegrationClient(async (client) => {
    const fixture = await createSubmittedReportFixture(client, uniqueTestId("G"));
    const requestId = await createQueuedExportRequestFixture(client, fixture, "request", { dispatchAttemptCount: 4 });
    const repository = createGrantReportExportOutboxRepository({ database: client as never, token: () => "7".repeat(64) });
    await repository.claimPendingRequest();
    await client.$executeRaw(Prisma.sql`UPDATE "GrantReportExportRequest" SET "dispatchLeaseExpiresAt" = clock_timestamp() - interval '1 millisecond' WHERE "id" = ${requestId}`);
    await recoverExpiredGrantReportExportDispatches({ database: client as never });
    assert.equal((await client.grantReportExportRequest.findUniqueOrThrow({ where: { id: requestId } })).status, "FAILED");
  });
});

databaseIntegrationTest("H. concurrent generation attempts preserve one current attempt", async () => {
  const setup = await createIntegrationClient();
  const first = await createIntegrationClient();
  const second = await createIntegrationClient();
  try {
    const fixture = await createSubmittedReportFixture(setup.client, uniqueTestId("H"));
    const barrier = createBarrier(2);
    const results = await bounded(Promise.allSettled([
      claimGrantReportExportAttempt({ reportId: fixture.reportId, versionId: fixture.versionId, actorUserId: fixture.adminUserId }, { database: synchronizedDatabase(first.client, barrier) as never }),
      claimGrantReportExportAttempt({ reportId: fixture.reportId, versionId: fixture.versionId, actorUserId: fixture.adminUserId }, { database: synchronizedDatabase(second.client, barrier) as never }),
    ]), 10_000);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 2);
    assert.equal(await setup.client.grantReportExportAttempt.count({ where: { artifact: { grantReportVersionId: fixture.versionId }, status: "GENERATING" } }), 1);
  } finally { await Promise.all([setup.disconnect(), first.disconnect(), second.disconnect()]); }
});

databaseIntegrationTest("I. stale generation completion is rejected", async () => {
  await withIntegrationClient(async (client) => {
    const fixture = await createSubmittedReportFixture(client, uniqueTestId("I"));
    const first = await claimGrantReportExportAttempt({ reportId: fixture.reportId, versionId: fixture.versionId, actorUserId: fixture.adminUserId }, { database: client as never });
    assert.equal(first.kind, "claimed");
    if (first.kind !== "claimed") return;
    await client.grantReportExportAttempt.update({ where: { id: first.attemptId }, data: { leaseExpiresAt: new Date(Date.now() - 1) } });
    await claimGrantReportExportAttempt({ reportId: fixture.reportId, versionId: fixture.versionId, actorUserId: fixture.adminUserId }, { database: client as never });
    await assert.rejects(() => completeGrantReportExportAttempt({ ...first, fileAssetId: "absent", sha256: "a".repeat(64), byteSize: 1, manifestSchemaVersion: 1, actorUserId: fixture.adminUserId }, { database: client as never }));
  });
});

databaseIntegrationTest("J. queue acceptance followed by failed acknowledgement remains recoverable and at-least-once", async () => {
  await withIntegrationClient(async (client) => {
    const fixture = await createSubmittedReportFixture(client, uniqueTestId("J"));
    const requestId = await createQueuedExportRequestFixture(client, fixture);
    const repository = createGrantReportExportOutboxRepository({ database: client as never, token: () => "8".repeat(64) });
    const claim = await repository.claimPendingRequest();
    assert.ok(claim);
    await client.$executeRaw(Prisma.sql`UPDATE "GrantReportExportRequest" SET "dispatchLeaseExpiresAt" = clock_timestamp() - interval '1 millisecond' WHERE "id" = ${requestId}`);
    await assert.rejects(() => repository.markPublicationSuccessful(claim!, { ok: true, messageId: "accepted-but-unacknowledged", publishedAt: new Date() }));
    assert.equal((await client.grantReportExportRequest.findUniqueOrThrow({ where: { id: requestId } })).status, "DISPATCHING");
    await recoverExpiredGrantReportExportDispatches({ database: client as never });
    assert.equal((await client.grantReportExportRequest.findUniqueOrThrow({ where: { id: requestId } })).status, "QUEUED");
  });
});

databaseIntegrationTest("K. duplicate queue delivery converges on one generation artifact", async () => {
  const setup = await createIntegrationClient();
  const first = await createIntegrationClient();
  const second = await createIntegrationClient();
  try {
    const fixture = await createSubmittedReportFixture(setup.client, uniqueTestId("K"));
    const barrier = createBarrier(2);
    const results = await bounded(Promise.allSettled([
      claimGrantReportExportAttempt({ reportId: fixture.reportId, versionId: fixture.versionId, actorUserId: fixture.adminUserId }, { database: synchronizedDatabase(first.client, barrier) as never }),
      claimGrantReportExportAttempt({ reportId: fixture.reportId, versionId: fixture.versionId, actorUserId: fixture.adminUserId }, { database: synchronizedDatabase(second.client, barrier) as never }),
    ]), 10_000);
    const fulfilled = results.filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof claimGrantReportExportAttempt>>> => result.status === "fulfilled");
    const rejected = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
    assert.ok(fulfilled.some((result) => result.value.kind === "claimed"), "At least one duplicate delivery must acquire the authoritative generation claim.");
    for (const result of fulfilled) {
      assert.ok(["claimed", "in_progress", "completed"].includes(result.value.kind), "Every fulfilled duplicate delivery must have an explicitly supported claim outcome.");
    }
    for (const result of rejected) {
      assert.ok(result.reason instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(result.reason.code), "Only a classified transaction conflict may reject a duplicate delivery.");
    }
    const artifact = await setup.client.grantReportExportArtifact.findUniqueOrThrow({ where: { grantReportVersionId_format: { grantReportVersionId: fixture.versionId, format: "SUBMISSION_PACK_ZIP" } } });
    assert.equal(await setup.client.grantReportExportArtifact.count({ where: { grantReportVersionId: fixture.versionId, format: "SUBMISSION_PACK_ZIP" } }), 1);
    assert.equal(await setup.client.grantReportExportArtifact.count({ where: { grantReportVersionId: fixture.versionId, status: "COMPLETED" } }), 0);
    assert.equal(await setup.client.grantReportExportAttempt.count({ where: { artifactId: artifact.id, status: "GENERATING", attemptNumber: artifact.latestAttemptNumber } }), 1);
    assert.equal(await setup.client.auditLog.count({ where: { action: "grant.report.export.generation_started", entityId: artifact.id } }), 1);
  } finally { await Promise.all([setup.disconnect(), first.disconnect(), second.disconnect()]); }
});

databaseIntegrationTest("L. audit records roll back with failed transitions", async () => {
  await withIntegrationClient(async (client) => {
    const fixture = await createSubmittedReportFixture(client, uniqueTestId("L"));
    const action = `${fixture.prefix}.rollback`;
    await assert.rejects(() => client.$transaction(async (tx) => {
      await tx.auditLog.create({ data: { action, entityType: "GrantReportExportRequest", entityId: "none" } });
      await tx.grantReportExportRequest.create({ data: { id: `${fixture.prefix}_invalid`, grantReportId: fixture.reportId, grantReportVersionId: "wrong", format: "SUBMISSION_PACK_ZIP", requestedByUserId: fixture.adminUserId, idempotencyKey: "a".repeat(64) } });
    }));
    assert.equal(await client.auditLog.count({ where: { action } }), 0);
  });
});

databaseIntegrationTest("M. real Serializable conflicts select one committed writer", async () => {
  const setup = await createIntegrationClient();
  const first = await createIntegrationClient();
  const second = await createIntegrationClient();
  try {
    const fixture = await createSubmittedReportFixture(setup.client, uniqueTestId("M"));
    const requestId = await createQueuedExportRequestFixture(setup.client, fixture);
    const barrier = createBarrier(2);
    const mutate = (client: PrismaClient, value: Date) => client.$transaction(async (tx) => {
      await tx.grantReportExportRequest.findUniqueOrThrow({ where: { id: requestId } });
      await barrier();
      return tx.grantReportExportRequest.update({ where: { id: requestId }, data: { nextDispatchAt: value } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    const outcomes = await bounded(Promise.allSettled([mutate(first.client, new Date("2027-01-01")), mutate(second.client, new Date("2027-01-02"))]), 10_000);
    assert.equal(outcomes.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(outcomes.filter((result) => result.status === "rejected").length, 1);
  } finally { await Promise.all([setup.disconnect(), first.disconnect(), second.disconnect()]); }
});

databaseIntegrationTest("N. partial unique index rejects a second active row", async () => {
  await withIntegrationClient(async (client) => {
    const fixture = await createSubmittedReportFixture(client, uniqueTestId("N"));
    await createQueuedExportRequestFixture(client, fixture, "first");
    await assert.rejects(() => createQueuedExportRequestFixture(client, fixture, "second"));
  });
});

test.skip("O. worker completion versus request recovery awaits production request-completion repository methods", () => {
  // The committed application does not yet expose the worker transition that
  // atomically binds a completed artifact to a DISPATCHED outbox request.
});

databaseIntegrationTest("P. completed artifacts and attempts reject mutation", async () => {
  await withIntegrationClient(async (client) => {
    const fixture = await createSubmittedReportFixture(client, uniqueTestId("P"));
    const claim = await claimGrantReportExportAttempt({ reportId: fixture.reportId, versionId: fixture.versionId, actorUserId: fixture.adminUserId }, { database: client as never });
    assert.equal(claim.kind, "claimed");
    if (claim.kind !== "claimed") return;
    const fileId = `${fixture.prefix}_file`;
    await client.fileAsset.create({ data: { id: fileId, storageProvider: "supabase", storageKey: `${fixture.prefix}/pack.zip`, originalFilename: "pack.zip", mimeType: "application/zip", fileSize: 10, checksum: "f".repeat(64), uploadedByUserId: fixture.adminUserId } });
    await client.grantReportExportAttempt.update({ where: { id: claim.attemptId }, data: { stagedFileAssetId: fileId, expectedSha256: "f".repeat(64), expectedByteSize: 10, manifestSchemaVersion: 1 } });
    await completeGrantReportExportAttempt({ ...claim, fileAssetId: fileId, sha256: "f".repeat(64), byteSize: 10, manifestSchemaVersion: 1, actorUserId: fixture.adminUserId }, { database: client as never });
    await assert.rejects(() => client.grantReportExportAttempt.update({ where: { id: claim.attemptId }, data: { failureCode: "CHANGED" } }));
    await assert.rejects(() => client.grantReportExportArtifact.delete({ where: { id: claim.artifactId } }));
  });
});
