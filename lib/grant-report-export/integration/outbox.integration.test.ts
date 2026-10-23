import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { createGrantReportExportOutboxRepository, recoverExpiredGrantReportExportDispatches } from "../outbox-repository";
import { createQueuedExportRequestFixture, createSubmittedReportFixture } from "./fixture-factory";
import { databaseIntegrationTest, uniqueTestId, withIntegrationClient } from "./integration-test-context";

databaseIntegrationTest("the partial unique index permits one active request and terminal history", async () => {
  await withIntegrationClient(async (client) => {
    const fixture = await createSubmittedReportFixture(client, uniqueTestId("outbox-active-unique"));
    await createQueuedExportRequestFixture(client, fixture, "active");
    await assert.rejects(() => createQueuedExportRequestFixture(client, fixture, "duplicate"));
  });
});

databaseIntegrationTest("claim, heartbeat, publication acknowledgement, and audit attribution use database ownership", async () => {
  await withIntegrationClient(async (client) => {
    const fixture = await createSubmittedReportFixture(client, uniqueTestId("outbox-publish"));
    const requestId = await createQueuedExportRequestFixture(client, fixture);
    await client.$executeRaw(Prisma.sql`UPDATE "GrantReportExportRequest" SET "nextDispatchAt" = clock_timestamp() - interval '1 second' WHERE "id" = ${requestId}`);
    const repository = createGrantReportExportOutboxRepository({ database: client as never, token: () => "a".repeat(64) });
    const claim = await repository.claimPendingRequest();
    assert.ok(claim);
    assert.equal(claim?.requestId, requestId);
    assert.equal(claim?.dispatchAttemptCount, 1);
    const extended = await repository.extendDispatchLease(claim!);
    assert.ok(extended > claim!.dispatchLeaseExpiresAt);
    await repository.markPublicationSuccessful(claim!, { ok: true, messageId: "integration-message-1", publishedAt: new Date() });
    const request = await client.grantReportExportRequest.findUniqueOrThrow({ where: { id: requestId } });
    assert.equal(request.status, "DISPATCHED");
    assert.equal(request.dispatchToken, null);
    assert.equal(request.queueMessageId, "integration-message-1");
    const actions = await client.auditLog.findMany({ where: { entityId: requestId }, orderBy: { createdAt: "asc" } });
    assert.deepEqual(actions.map((audit) => audit.action), ["grant.report.export.dispatch_claimed", "grant.report.export.dispatched"]);
    assert.equal(actions.every((audit) => audit.actorUserId === null), true);
    assert.equal(actions.every((audit) => (audit.metadata as Record<string, unknown>).requestedByUserId === fixture.adminUserId), true);
  });
});

databaseIntegrationTest("retry scheduling preserves the claim count and uses a database-derived next dispatch time", async () => {
  await withIntegrationClient(async (client) => {
    const fixture = await createSubmittedReportFixture(client, uniqueTestId("outbox-retry"));
    const requestId = await createQueuedExportRequestFixture(client, fixture);
    const repository = createGrantReportExportOutboxRepository({ database: client as never, token: () => "b".repeat(64) });
    const claim = await repository.claimPendingRequest();
    assert.ok(claim);
    const nextDispatchAt = await repository.releaseClaimForRetry(claim!, "QUEUE_UNAVAILABLE", 5_000);
    const request = await client.grantReportExportRequest.findUniqueOrThrow({ where: { id: requestId } });
    assert.equal(request.status, "QUEUED");
    assert.equal(request.dispatchAttemptCount, 1);
    assert.equal(request.nextDispatchAt.getTime(), nextDispatchAt.getTime());
    assert.equal(request.lastSafeFailureCode, "QUEUE_UNAVAILABLE");
  });
});

databaseIntegrationTest("attempt-five recovery is terminal and cannot be reopened", async () => {
  await withIntegrationClient(async (client) => {
    const fixture = await createSubmittedReportFixture(client, uniqueTestId("outbox-exhaustion"));
    const requestId = await createQueuedExportRequestFixture(client, fixture, "request", { dispatchAttemptCount: 4 });
    const repository = createGrantReportExportOutboxRepository({ database: client as never, token: () => "c".repeat(64) });
    const claim = await repository.claimPendingRequest();
    assert.equal(claim?.dispatchAttemptCount, 5);
    await client.$executeRaw(Prisma.sql`UPDATE "GrantReportExportRequest" SET "dispatchLeaseExpiresAt" = clock_timestamp() - interval '1 millisecond' WHERE "id" = ${requestId}`);
    const recovery = await recoverExpiredGrantReportExportDispatches({ database: client as never });
    assert.equal(recovery.failed, 1);
    const request = await client.grantReportExportRequest.findUniqueOrThrow({ where: { id: requestId } });
    assert.equal(request.status, "FAILED");
    assert.equal(request.lastSafeFailureCode, "DISPATCH_ATTEMPTS_EXHAUSTED");
    await assert.rejects(() => client.grantReportExportRequest.update({ where: { id: requestId }, data: { status: "QUEUED", failedAt: null, lastSafeFailureCode: null } }));
  });
});

databaseIntegrationTest("expired lease recovery rejects stale tokens and creates one recovery audit", async () => {
  await withIntegrationClient(async (client) => {
    const fixture = await createSubmittedReportFixture(client, uniqueTestId("outbox-recovery"));
    const requestId = await createQueuedExportRequestFixture(client, fixture);
    const repository = createGrantReportExportOutboxRepository({ database: client as never, token: () => "d".repeat(64) });
    const claim = await repository.claimPendingRequest();
    assert.ok(claim);
    await client.$executeRaw(Prisma.sql`UPDATE "GrantReportExportRequest" SET "dispatchLeaseExpiresAt" = clock_timestamp() - interval '1 millisecond' WHERE "id" = ${requestId}`);
    const result = await recoverExpiredGrantReportExportDispatches({ database: client as never });
    assert.equal(result.recovered, 1);
    await assert.rejects(() => repository.markPublicationSuccessful(claim!, { ok: true, messageId: "stale-message", publishedAt: new Date() }));
    assert.equal(await client.auditLog.count({ where: { entityId: requestId, action: "grant.report.export.dispatch_recovered" } }), 1);
    assert.equal(await client.auditLog.count({ where: { entityId: requestId, action: "grant.report.export.dispatched" } }), 0);
  });
});

databaseIntegrationTest("outbox state and its audit record roll back atomically", async () => {
  await withIntegrationClient(async (client) => {
    const fixture = await createSubmittedReportFixture(client, uniqueTestId("outbox-audit-rollback"));
    const requestId = await createQueuedExportRequestFixture(client, fixture);
    const action = `${fixture.prefix}.outbox_rollback`;
    await assert.rejects(() => client.$transaction(async (tx) => {
      await tx.grantReportExportRequest.update({ where: { id: requestId }, data: { status: "DISPATCHING", dispatchAttemptCount: 1, dispatchToken: "e".repeat(64), dispatchLeaseExpiresAt: new Date(Date.now() + 60_000) } });
      await tx.auditLog.create({ data: { actorUserId: null, action, entityType: "GrantReportExportRequest", entityId: requestId } });
      throw new Error("forced rollback");
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
    assert.equal((await client.grantReportExportRequest.findUniqueOrThrow({ where: { id: requestId } })).status, "QUEUED");
    assert.equal(await client.auditLog.count({ where: { action } }), 0);
  });
});
