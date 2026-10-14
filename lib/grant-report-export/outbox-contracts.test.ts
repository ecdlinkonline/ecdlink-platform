import assert from "node:assert/strict";
import test from "node:test";
import {
  createGrantReportExportDispatchRetryPolicy,
  projectGrantReportExportRequestStatus,
} from "@/lib/grant-report-export/outbox-contracts";

test("dispatch retry policy applies bounded exponential backoff and bounded attempts", () => {
  const policy = createGrantReportExportDispatchRetryPolicy({
    maximumAttempts: 5,
    initialRetryDelayMilliseconds: 1_000,
    maximumRetryDelayMilliseconds: 2_500,
  });
  assert.deepEqual([1, 2, 3, 4, 5].map((attempt) => policy.retryDelayMilliseconds(attempt)), [1_000, 2_000, 2_500, 2_500, 2_500]);
  assert.equal(policy.shouldRetry({ attemptNumber: 4, failure: { code: "QUEUE_UNAVAILABLE", retryable: true } }), true);
  assert.equal(policy.shouldRetry({ attemptNumber: 5, failure: { code: "QUEUE_UNAVAILABLE", retryable: true } }), false);
  assert.equal(policy.shouldRetry({ attemptNumber: 1, failure: { code: "QUEUE_CONFIGURATION_INVALID", retryable: false } }), false);
});

test("dispatch retry policy rejects conflicting and unsafe numeric configuration", () => {
  const invalidOptions = [
    { maximumAttempts: 4 },
    { maximumAttempts: 0 },
    { maximumAttempts: Number.NaN },
    { maximumAttempts: Number.POSITIVE_INFINITY },
    { initialRetryDelayMilliseconds: 0 },
    { initialRetryDelayMilliseconds: -1 },
    { initialRetryDelayMilliseconds: 1.5 },
    { initialRetryDelayMilliseconds: Number.NaN },
    { initialRetryDelayMilliseconds: Number.POSITIVE_INFINITY },
    { maximumRetryDelayMilliseconds: 0 },
    { maximumRetryDelayMilliseconds: 1.5 },
    { maximumRetryDelayMilliseconds: Number.NaN },
    { maximumRetryDelayMilliseconds: Number.POSITIVE_INFINITY },
    { maximumRetryDelayMilliseconds: Number.MAX_SAFE_INTEGER },
    { initialRetryDelayMilliseconds: 2_000, maximumRetryDelayMilliseconds: 1_000 },
  ];
  for (const options of invalidOptions) {
    assert.throws(() => createGrantReportExportDispatchRetryPolicy(options));
  }

  const policy = createGrantReportExportDispatchRetryPolicy();
  for (const attempt of [0, -1, 1.5, 6, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => policy.retryDelayMilliseconds(attempt));
  }
});

test("request status projection contains no dispatch token or provider internals", () => {
  const projected = projectGrantReportExportRequestStatus({
    requestId: "request-1",
    format: "SUBMISSION_PACK_ZIP",
    status: "DISPATCHED",
    safeFailureCode: null,
    artifactId: null,
    createdAt: new Date("2027-01-01T00:00:00Z"),
    dispatchedAt: new Date("2027-01-01T00:00:01Z"),
    completedAt: null,
    failedAt: null,
    updatedAt: new Date("2027-01-01T00:00:01Z"),
  });
  assert.deepEqual(Object.keys(projected).sort(), [
    "artifactId",
    "completedAt",
    "createdAt",
    "dispatchedAt",
    "failedAt",
    "format",
    "requestId",
    "safeFailureCode",
    "status",
    "updatedAt",
  ]);
  assert.equal("dispatchToken" in projected, false);
  assert.equal("queueMessageId" in projected, false);
});

test("request status projection drops unexpected runtime-sensitive properties", () => {
  const projected = projectGrantReportExportRequestStatus({
    requestId: "request-1",
    format: "SUBMISSION_PACK_ZIP",
    status: "QUEUED",
    safeFailureCode: null,
    artifactId: null,
    createdAt: new Date("2027-01-01T00:00:00Z"),
    dispatchedAt: null,
    completedAt: null,
    failedAt: null,
    updatedAt: new Date("2027-01-01T00:00:00Z"),
    dispatchToken: "secret-token",
    queueMessageId: "provider-message",
    storageObjectKey: "private/object.zip",
  } as Parameters<typeof projectGrantReportExportRequestStatus>[0] & Record<string, unknown>);
  assert.equal("dispatchToken" in projected, false);
  assert.equal("queueMessageId" in projected, false);
  assert.equal("storageObjectKey" in projected, false);
});
