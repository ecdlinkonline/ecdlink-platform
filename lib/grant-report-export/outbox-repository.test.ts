import assert from "node:assert/strict";
import test from "node:test";
import {
  createGrantReportExportOutboxRepository,
  GrantReportExportOutboxError,
  recoverExpiredGrantReportExportDispatches,
} from "@/lib/grant-report-export/outbox-repository";

function database(transaction: Record<string, unknown>, isolations: string[] = []) {
  return {
    $transaction: async (operation: (tx: unknown) => Promise<unknown>, options: { isolationLevel: string }) => {
      isolations.push(options.isolationLevel);
      return operation(transaction);
    },
  };
}

const candidate = {
  id: "request-1",
  grantReportId: "report-1",
  grantReportVersionId: "version-1",
  format: "SUBMISSION_PACK_ZIP" as const,
  requestedByUserId: "user-1",
  dispatchAttemptCount: 0,
};

test("a pending request claim uses serializable compare-and-swap and increments exactly once", async () => {
  const updates: Array<Record<string, unknown>> = [];
  const audits: Array<Record<string, unknown>> = [];
  const isolations: string[] = [];
  const tx = {
    grantReportExportRequest: {
      findFirst: async () => candidate,
      updateMany: async (args: Record<string, unknown>) => { updates.push(args); return { count: 1 }; },
    },
    auditLog: { create: async (args: Record<string, unknown>) => { audits.push(args); return {}; } },
  };
  const repository = createGrantReportExportOutboxRepository({
    database: database(tx, isolations) as never,
    databaseClock: async () => new Date("2027-01-01T00:00:00Z"),
    token: () => "a".repeat(64),
  });
  const result = await repository.claimPendingRequest();
  assert.equal(result?.dispatchAttemptCount, 1);
  assert.equal(result?.dispatchLeaseExpiresAt.toISOString(), "2027-01-01T00:01:00.000Z");
  assert.deepEqual(isolations, ["Serializable"]);
  assert.deepEqual((updates[0].where as { status: string; dispatchAttemptCount: number }), {
    id: "request-1",
    status: "QUEUED",
    nextDispatchAt: { lte: new Date("2027-01-01T00:00:00Z") },
    dispatchAttemptCount: 0,
  });
  assert.deepEqual((updates[0].data as { dispatchAttemptCount: unknown }).dispatchAttemptCount, { increment: 1 });
  assert.equal(audits.length, 1);
  const auditData = audits[0].data as { actorUserId: string | null; metadata: Record<string, unknown> };
  assert.equal(auditData.actorUserId, null);
  assert.equal(auditData.metadata.actorType, "SYSTEM_WORKER");
  assert.equal(auditData.metadata.requestedByUserId, "user-1");
});

test("concurrent claim loser receives no ownership and creates no audit", async () => {
  let audits = 0;
  const repository = createGrantReportExportOutboxRepository({
    database: database({
      grantReportExportRequest: { findFirst: async () => candidate, updateMany: async () => ({ count: 0 }) },
      auditLog: { create: async () => { audits += 1; } },
    }) as never,
    databaseClock: async () => new Date("2027-01-01T00:00:00Z"),
    token: () => "b".repeat(64),
  });
  assert.equal(await repository.claimPendingRequest(), null);
  assert.equal(audits, 0);
});

test("database time, not a skewed application clock, controls claim eligibility and lease expiration", async () => {
  const databaseTime = new Date("2027-01-01T00:00:00Z");
  const updates: Array<Record<string, unknown>> = [];
  const originalDateNow = Date.now;
  Date.now = () => new Date("2099-12-31T23:59:59Z").getTime();
  try {
    const repository = createGrantReportExportOutboxRepository({
      database: database({
        grantReportExportRequest: {
          findFirst: async () => candidate,
          updateMany: async (args: Record<string, unknown>) => { updates.push(args); return { count: 1 }; },
        },
        auditLog: { create: async () => ({}) },
      }) as never,
      databaseClock: async () => databaseTime,
      token: () => "9".repeat(64),
    });
    const claimed = await repository.claimPendingRequest();
    assert.equal(claimed?.dispatchLeaseExpiresAt.toISOString(), "2027-01-01T00:01:00.000Z");
    assert.deepEqual((updates[0].where as { nextDispatchAt: unknown }).nextDispatchAt, { lte: databaseTime });
  } finally {
    Date.now = originalDateNow;
  }
});

test("already-exhausted queued rows are detected instead of remaining silently unclaimable", async () => {
  let reads = 0;
  const repository = createGrantReportExportOutboxRepository({
    database: database({
      grantReportExportRequest: {
        findFirst: async () => {
          reads += 1;
          return reads === 1 ? null : { id: "exhausted-request" };
        },
      },
    }) as never,
    databaseClock: async () => new Date("2027-01-01T00:00:00Z"),
  });
  await assert.rejects(
    () => repository.claimPendingRequest(),
    (error: unknown) => error instanceof GrantReportExportOutboxError && error.code === "DISPATCH_ATTEMPTS_EXHAUSTED",
  );
});

test("heartbeat uses the exact token and rejects stale or expired claims", async () => {
  const updates: Array<Record<string, unknown>> = [];
  const repository = createGrantReportExportOutboxRepository({
    database: database({ grantReportExportRequest: { updateMany: async (args: Record<string, unknown>) => { updates.push(args); return { count: 1 }; } } }) as never,
    databaseClock: async () => new Date("2027-01-01T00:00:00Z"),
  });
  const claim = {
    requestId: candidate.id,
    dispatchToken: "c".repeat(64),
    dispatchAttemptCount: 1,
    dispatchLeaseExpiresAt: new Date("2027-01-01T00:00:30Z"),
    grantReportId: candidate.grantReportId,
    grantReportVersionId: candidate.grantReportVersionId,
    format: candidate.format,
    requestedByUserId: candidate.requestedByUserId,
  };
  await repository.extendDispatchLease(claim);
  assert.equal((updates[0].where as { dispatchToken: string }).dispatchToken, "c".repeat(64));

  const stale = createGrantReportExportOutboxRepository({
    database: database({ grantReportExportRequest: { updateMany: async () => ({ count: 0 }) } }) as never,
    databaseClock: async () => new Date("2027-01-01T00:00:00Z"),
  });
  await assert.rejects(() => stale.extendDispatchLease(claim), (error: unknown) => error instanceof GrantReportExportOutboxError && error.code === "DISPATCH_LEASE_EXPIRED");
});

test("publication, retry release, and permanent failure are token-scoped compare-and-swap operations", async () => {
  const writes: Array<Record<string, unknown>> = [];
  const tx = {
    grantReportExportRequest: { updateMany: async (args: Record<string, unknown>) => { writes.push(args); return { count: 1 }; } },
    auditLog: { create: async () => ({}) },
  };
  const databaseTime = new Date("2027-01-01T00:00:00Z");
  const repository = createGrantReportExportOutboxRepository({ database: database(tx) as never, databaseClock: async () => databaseTime });
  const claim = {
    requestId: "request-1",
    dispatchToken: "d".repeat(64),
    dispatchAttemptCount: 2,
    dispatchLeaseExpiresAt: new Date("2027-01-01T00:01:00Z"),
    grantReportId: "report-1",
    grantReportVersionId: "version-1",
    format: "SUBMISSION_PACK_ZIP" as const,
    requestedByUserId: "user-1",
  };
  await repository.markPublicationSuccessful(claim, { ok: true, messageId: "queue-message-1", publishedAt: new Date("2099-01-01T00:00:00Z") });
  const nextDispatchAt = await repository.releaseClaimForRetry(claim, "QUEUE_UNAVAILABLE", 60_000);
  await repository.markPermanentDispatchFailure(claim, "QUEUE_CONFIGURATION_INVALID");
  for (const write of writes) {
    assert.equal((write.where as { dispatchToken: string }).dispatchToken, claim.dispatchToken);
    assert.equal((write.where as { dispatchAttemptCount: number }).dispatchAttemptCount, 2);
  }
  assert.equal((writes[0].data as { status: string }).status, "DISPATCHED");
  assert.equal((writes[0].data as { dispatchedAt: Date }).dispatchedAt, databaseTime);
  assert.equal((writes[1].data as { status: string }).status, "QUEUED");
  assert.equal(nextDispatchAt.toISOString(), "2027-01-01T00:01:00.000Z");
  assert.equal((writes[2].data as { status: string }).status, "FAILED");
});

test("an exhausted in-flight claim cannot be released back to QUEUED", async () => {
  let writes = 0;
  const repository = createGrantReportExportOutboxRepository({
    database: database({
      grantReportExportRequest: { updateMany: async () => { writes += 1; return { count: 1 }; } },
      auditLog: { create: async () => { writes += 1; } },
    }) as never,
    databaseClock: async () => new Date("2027-01-01T00:00:00Z"),
  });
  await assert.rejects(
    () => repository.releaseClaimForRetry({
      requestId: "request-1",
      dispatchToken: "d".repeat(64),
      dispatchAttemptCount: 5,
      dispatchLeaseExpiresAt: new Date("2027-01-01T00:01:00Z"),
      grantReportId: "report-1",
      grantReportVersionId: "version-1",
      format: "SUBMISSION_PACK_ZIP",
      requestedByUserId: "user-1",
    }, "QUEUE_UNAVAILABLE", 5_000),
    (error: unknown) => error instanceof GrantReportExportOutboxError && error.code === "DISPATCH_ATTEMPTS_EXHAUSTED",
  );
  assert.equal(writes, 0);
});

test("publication acknowledgement rejects malformed provider evidence before database access", async () => {
  let writes = 0;
  const repository = createGrantReportExportOutboxRepository({
    database: database({
      grantReportExportRequest: { updateMany: async () => { writes += 1; return { count: 1 }; } },
      auditLog: { create: async () => { writes += 1; } },
    }) as never,
  });
  const claim = {
    requestId: "request-1",
    dispatchToken: "d".repeat(64),
    dispatchAttemptCount: 1,
    dispatchLeaseExpiresAt: new Date("2027-01-01T00:01:00Z"),
    grantReportId: "report-1",
    grantReportVersionId: "version-1",
    format: "SUBMISSION_PACK_ZIP" as const,
    requestedByUserId: "user-1",
  };
  await assert.rejects(
    () => repository.markPublicationSuccessful(claim, { ok: true, messageId: "bad\nmessage", publishedAt: new Date() }),
    (error: unknown) => error instanceof GrantReportExportOutboxError && error.code === "INVALID_PUBLICATION",
  );
  await assert.rejects(
    () => repository.markPublicationSuccessful(claim, { ok: true, messageId: "message-1", publishedAt: new Date(Number.NaN) }),
    (error: unknown) => error instanceof GrantReportExportOutboxError && error.code === "INVALID_PUBLICATION",
  );
  assert.equal(writes, 0);
});

test("expired leases are released with their recorded token or terminally failed when attempts are exhausted", async () => {
  const writes: Array<Record<string, unknown>> = [];
  const audits: Array<Record<string, unknown>> = [];
  const result = await recoverExpiredGrantReportExportDispatches({
    database: database({
      grantReportExportRequest: {
        findMany: async () => [
          { id: "retry", dispatchToken: "e".repeat(64), dispatchAttemptCount: 2, requestedByUserId: "user-1" },
          { id: "failed", dispatchToken: "f".repeat(64), dispatchAttemptCount: 5, requestedByUserId: "user-1" },
        ],
        updateMany: async (args: Record<string, unknown>) => { writes.push(args); return { count: 1 }; },
      },
      auditLog: { create: async (args: Record<string, unknown>) => { audits.push(args); return {}; } },
    }) as never,
    databaseClock: async () => new Date("2027-01-01T00:00:00Z"),
  });
  assert.deepEqual(result, { examined: 2, recovered: 1, failed: 1 });
  assert.equal((writes[0].where as { dispatchToken: string }).dispatchToken, "e".repeat(64));
  assert.equal((writes[0].data as { status: string }).status, "QUEUED");
  assert.equal((writes[1].where as { dispatchToken: string }).dispatchToken, "f".repeat(64));
  assert.equal((writes[1].data as { status: string }).status, "FAILED");
  assert.equal(audits.length, 2);
  for (const audit of audits) {
    const data = audit.data as { actorUserId: string | null; metadata: Record<string, unknown> };
    assert.equal(data.actorUserId, null);
    assert.equal(data.metadata.actorType, "SYSTEM_WORKER");
    assert.equal(data.metadata.requestedByUserId, "user-1");
  }
});

test("status lookup requires exact report and version ownership and returns only the safe projection", async () => {
  let where: unknown;
  const repository = createGrantReportExportOutboxRepository({
    database: database({
      grantReportExportRequest: {
        findFirst: async (args: Record<string, unknown>) => {
          where = args.where;
          return {
            id: "request-1", format: "SUBMISSION_PACK_ZIP", status: "QUEUED", lastSafeFailureCode: null, artifactId: null,
            createdAt: new Date(), dispatchedAt: null, completedAt: null, failedAt: null, updatedAt: new Date(),
          };
        },
      },
    }) as never,
  });
  const result = await repository.getRequestStatus({ requestId: "request-1", grantReportId: "report-1", grantReportVersionId: "version-1" });
  assert.deepEqual(where, { id: "request-1", grantReportId: "report-1", grantReportVersionId: "version-1" });
  assert.equal(result?.requestId, "request-1");
  assert.equal("dispatchToken" in (result ?? {}), false);
});
