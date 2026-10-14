import assert from "node:assert/strict";
import test from "node:test";
import {
  GrantReportExportDispatchAcknowledgementError,
  GrantReportExportDispatchOwnershipLostError,
  dispatchNextGrantReportExportRequest,
} from "@/lib/grant-report-export/outbox-dispatcher";
import type {
  ClaimedGrantReportExportRequest,
  GrantReportExportOutboxRepository,
} from "@/lib/grant-report-export/outbox-contracts";

const claim: ClaimedGrantReportExportRequest = {
  requestId: "request-1",
  dispatchToken: "a".repeat(64),
  dispatchAttemptCount: 1,
  dispatchLeaseExpiresAt: new Date("2027-01-01T00:01:00Z"),
  grantReportId: "report-1",
  grantReportVersionId: "version-1",
  format: "SUBMISSION_PACK_ZIP",
  requestedByUserId: "user-1",
};

function repository(overrides: Partial<GrantReportExportOutboxRepository> = {}): GrantReportExportOutboxRepository {
  return {
    claimPendingRequest: async () => ({ ...claim }),
    extendDispatchLease: async () => claim.dispatchLeaseExpiresAt,
    markPublicationSuccessful: async () => undefined,
    releaseClaimForRetry: async () => new Date("2027-01-01T00:00:05Z"),
    markPermanentDispatchFailure: async () => undefined,
    getRequestStatus: async () => null,
    ...overrides,
  };
}

test("successful queue publication is acknowledged with provider-neutral evidence", async () => {
  let acknowledged = false;
  const result = await dispatchNextGrantReportExportRequest({
    repository: repository({ markPublicationSuccessful: async (_claim, publication) => { acknowledged = publication.messageId === "message-1"; } }),
    publisher: { publishExportRequest: async () => ({ ok: true, messageId: "message-1", publishedAt: new Date("2027-01-01T00:00:01Z") }) },
  });
  assert.equal(result.kind, "dispatched");
  assert.equal(acknowledged, true);
});

test("publication heartbeats are sequential and keep a long publication owned", async () => {
  let activeHeartbeats = 0;
  let maximumConcurrentHeartbeats = 0;
  let heartbeatCount = 0;
  const result = await dispatchNextGrantReportExportRequest({
    repository: repository({
      extendDispatchLease: async () => {
        activeHeartbeats += 1;
        maximumConcurrentHeartbeats = Math.max(maximumConcurrentHeartbeats, activeHeartbeats);
        await new Promise((resolve) => setTimeout(resolve, 2));
        heartbeatCount += 1;
        activeHeartbeats -= 1;
        return new Date();
      },
    }),
    publisher: {
      publishExportRequest: async ({ signal }) => {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, 35);
          signal.addEventListener("abort", () => { clearTimeout(timer); reject(new Error("aborted")); }, { once: true });
        });
        return { ok: true, messageId: "message-long", publishedAt: new Date() };
      },
    },
    heartbeatMilliseconds: 5,
    publicationTimeoutMilliseconds: 200,
  });
  assert.equal(result.kind, "dispatched");
  assert.ok(heartbeatCount >= 2);
  assert.equal(maximumConcurrentHeartbeats, 1);
  assert.equal(activeHeartbeats, 0);
});

test("heartbeat ownership loss aborts publication and performs no stale mutation", async () => {
  let aborted = false;
  let mutations = 0;
  await assert.rejects(
    () => dispatchNextGrantReportExportRequest({
      repository: repository({
        extendDispatchLease: async () => { throw new Error("lease lost"); },
        markPublicationSuccessful: async () => { mutations += 1; },
        releaseClaimForRetry: async () => { mutations += 1; return new Date(); },
        markPermanentDispatchFailure: async () => { mutations += 1; },
      }),
      publisher: {
        publishExportRequest: ({ signal }) => new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => { aborted = true; reject(new Error("provider aborted")); }, { once: true });
        }),
      },
      heartbeatMilliseconds: 5,
      publicationTimeoutMilliseconds: 200,
    }),
    (error: unknown) => error instanceof GrantReportExportDispatchOwnershipLostError,
  );
  assert.equal(aborted, true);
  assert.equal(mutations, 0);
});

test("transient publication failures schedule retry from the repository database clock", async () => {
  let scheduledDelay: number | undefined;
  const databaseDerivedNextDispatchAt = new Date("2027-01-01T00:00:05Z");
  const result = await dispatchNextGrantReportExportRequest({
    repository: repository({
      releaseClaimForRetry: async (_claim, _code, delay) => {
        scheduledDelay = delay;
        return databaseDerivedNextDispatchAt;
      },
    }),
    publisher: { publishExportRequest: async () => ({ ok: false, failure: { code: "QUEUE_UNAVAILABLE", retryable: true } }) },
  });
  assert.equal(result.kind, "retry_scheduled");
  assert.equal(scheduledDelay, 5_000);
  assert.equal(result.nextDispatchAt, databaseDerivedNextDispatchAt);
});

test("a thrown publisher exception is sanitized as an ambiguous transient outcome", async () => {
  let failureCode = "";
  const result = await dispatchNextGrantReportExportRequest({
    repository: repository({
      releaseClaimForRetry: async (_claim, code) => {
        failureCode = code;
        return new Date("2027-01-01T00:00:05Z");
      },
    }),
    publisher: { publishExportRequest: () => { throw new Error("secret provider endpoint and response"); } },
  });
  assert.equal(result.kind, "retry_scheduled");
  assert.equal(failureCode, "QUEUE_UNAVAILABLE");
  assert.equal(JSON.stringify(result).includes("secret provider"), false);
});

test("publication timeout aborts the provider and schedules an ambiguous retry", async () => {
  let aborted = false;
  const result = await dispatchNextGrantReportExportRequest({
    repository: repository(),
    publisher: {
      publishExportRequest: ({ signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => { aborted = true; reject(new Error("aborted")); }, { once: true });
      }),
    },
    heartbeatMilliseconds: 5,
    publicationTimeoutMilliseconds: 20,
  });
  assert.equal(result.kind, "retry_scheduled");
  assert.equal(aborted, true);
  assert.equal(result.failureCode, "QUEUE_UNAVAILABLE");
});

test("permanent failures and exhausted retries become terminal", async () => {
  let failureCode = "";
  const permanent = await dispatchNextGrantReportExportRequest({
    repository: repository({ markPermanentDispatchFailure: async (_claim, code) => { failureCode = code; } }),
    publisher: { publishExportRequest: async () => ({ ok: false, failure: { code: "QUEUE_CONFIGURATION_INVALID", retryable: false } }) },
  });
  assert.equal(permanent.kind, "failed");
  assert.equal(failureCode, "QUEUE_CONFIGURATION_INVALID");

  const exhaustedClaim = { ...claim, dispatchAttemptCount: 5 };
  const exhausted = await dispatchNextGrantReportExportRequest({
    repository: repository({
      claimPendingRequest: async () => exhaustedClaim,
      markPermanentDispatchFailure: async (_current, code) => { failureCode = code; },
    }),
    publisher: { publishExportRequest: async () => ({ ok: false, failure: { code: "QUEUE_UNAVAILABLE", retryable: true } }) },
  });
  assert.equal(exhausted.kind, "failed");
  assert.equal(failureCode, "DISPATCH_ATTEMPTS_EXHAUSTED");
});

test("an acknowledgement failure leaves accepted publication leased for at-least-once recovery", async () => {
  let released = false;
  await assert.rejects(
    () => dispatchNextGrantReportExportRequest({
      repository: repository({
        markPublicationSuccessful: async () => { throw new Error("database unavailable"); },
        releaseClaimForRetry: async () => { released = true; return new Date(); },
      }),
      publisher: { publishExportRequest: async () => ({ ok: true, messageId: "message-1", publishedAt: new Date() }) },
    }),
    (error: unknown) => error instanceof GrantReportExportDispatchAcknowledgementError,
  );
  assert.equal(released, false);
});

test("conflicting retry policy and invalid dispatcher timing are rejected before claiming", async () => {
  let claims = 0;
  const currentRepository = repository({ claimPendingRequest: async () => { claims += 1; return claim; } });
  const publisher = { publishExportRequest: async () => ({ ok: true as const, messageId: "message", publishedAt: new Date() }) };
  await assert.rejects(() => dispatchNextGrantReportExportRequest({
    repository: currentRepository,
    publisher,
    retryPolicy: { maximumAttempts: 4, retryDelayMilliseconds: () => 1, shouldRetry: () => true },
  }));
  await assert.rejects(() => dispatchNextGrantReportExportRequest({ repository: currentRepository, publisher, heartbeatMilliseconds: Number.NaN }));
  await assert.rejects(() => dispatchNextGrantReportExportRequest({ repository: currentRepository, publisher, publicationTimeoutMilliseconds: 1.5 }));
  await assert.rejects(() => dispatchNextGrantReportExportRequest({ repository: currentRepository, publisher, heartbeatMilliseconds: 20, publicationTimeoutMilliseconds: 20 }));
  await assert.rejects(() => dispatchNextGrantReportExportRequest({ repository: currentRepository, publisher, publicationTimeoutMilliseconds: Number.MAX_SAFE_INTEGER }));
  assert.equal(claims, 0);
});

test("an empty outbox does not call the queue provider", async () => {
  let published = false;
  const result = await dispatchNextGrantReportExportRequest({
    repository: repository({ claimPendingRequest: async () => null }),
    publisher: { publishExportRequest: async () => { published = true; return { ok: true, messageId: "unexpected", publishedAt: new Date() }; } },
  });
  assert.equal(result.kind, "idle");
  assert.equal(published, false);
});
