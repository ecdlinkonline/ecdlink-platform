import "server-only";

import {
  createGrantReportExportDispatchRetryPolicy,
  grantReportExportDispatchDefaults,
  type ClaimedGrantReportExportRequest,
  type GrantReportExportDispatchFailureCode,
  type GrantReportExportDispatchRetryPolicy,
  type GrantReportExportOutboxRepository,
  type GrantReportExportQueuePublicationResult,
  type GrantReportExportQueuePublisher,
} from "@/lib/grant-report-export/outbox-contracts";

export class GrantReportExportDispatchAcknowledgementError extends Error {
  constructor(public readonly requestId: string) {
    super("The queue accepted the export request, but publication acknowledgement could not be recorded.");
    this.name = "GrantReportExportDispatchAcknowledgementError";
  }
}

export class GrantReportExportDispatchOwnershipLostError extends Error {
  constructor(public readonly requestId: string) {
    super("The export dispatch lease was lost while queue publication was in progress.");
    this.name = "GrantReportExportDispatchOwnershipLostError";
  }
}

type PublicationOutcome =
  | { kind: "settled"; publication: GrantReportExportQueuePublicationResult }
  | { kind: "ambiguous_exception" }
  | { kind: "timeout" }
  | { kind: "ownership_lost" };

function positiveSafeInteger(value: number, name: string) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`The export dispatch ${name} is invalid.`);
  }
  return value;
}

function waitForHeartbeat(milliseconds: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timer = setTimeout(finish, milliseconds);
    signal.addEventListener("abort", finish, { once: true });
  });
}

async function publishWithLeaseHeartbeat(input: {
  claim: ClaimedGrantReportExportRequest;
  repository: GrantReportExportOutboxRepository;
  publisher: GrantReportExportQueuePublisher;
  heartbeatMilliseconds: number;
  publicationTimeoutMilliseconds: number;
}): Promise<PublicationOutcome> {
  const publicationController = new AbortController();
  const heartbeatController = new AbortController();
  let ownershipLost = false;
  let resolveOwnershipLoss: (() => void) | undefined;
  const ownershipLoss = new Promise<PublicationOutcome>((resolve) => {
    resolveOwnershipLoss = () => resolve({ kind: "ownership_lost" });
  });

  const heartbeat = (async () => {
    while (!heartbeatController.signal.aborted) {
      await waitForHeartbeat(input.heartbeatMilliseconds, heartbeatController.signal);
      if (heartbeatController.signal.aborted) return;
      try {
        await input.repository.extendDispatchLease(input.claim);
      } catch {
        ownershipLost = true;
        publicationController.abort();
        resolveOwnershipLoss?.();
        return;
      }
    }
  })();

  const publication = Promise.resolve().then(() => input.publisher.publishExportRequest({
    requestId: input.claim.requestId,
    dispatchToken: input.claim.dispatchToken,
    signal: publicationController.signal,
  })).then(
    (result): PublicationOutcome => ({ kind: "settled", publication: result }),
    (): PublicationOutcome => ({ kind: "ambiguous_exception" }),
  );

  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<PublicationOutcome>((resolve) => {
    timeout = setTimeout(() => {
      publicationController.abort();
      resolve({ kind: "timeout" });
    }, input.publicationTimeoutMilliseconds);
  });

  let outcome: PublicationOutcome;
  try {
    outcome = await Promise.race([publication, timedOut, ownershipLoss]);
  } finally {
    if (timeout) clearTimeout(timeout);
    heartbeatController.abort();
    await heartbeat;
  }
  if (ownershipLost) return { kind: "ownership_lost" };
  return outcome;
}

async function recordSafeFailure(input: {
  claim: ClaimedGrantReportExportRequest;
  repository: GrantReportExportOutboxRepository;
  retryPolicy: GrantReportExportDispatchRetryPolicy;
  failure: { code: GrantReportExportDispatchFailureCode; retryable: boolean };
}) {
  if (input.retryPolicy.shouldRetry({ attemptNumber: input.claim.dispatchAttemptCount, failure: input.failure })) {
    const delay = input.retryPolicy.retryDelayMilliseconds(input.claim.dispatchAttemptCount);
    const nextDispatchAt = await input.repository.releaseClaimForRetry(input.claim, input.failure.code, delay);
    return {
      kind: "retry_scheduled" as const,
      requestId: input.claim.requestId,
      nextDispatchAt,
      failureCode: input.failure.code,
    };
  }

  const failureCode = input.failure.retryable ? "DISPATCH_ATTEMPTS_EXHAUSTED" as const : input.failure.code;
  await input.repository.markPermanentDispatchFailure(input.claim, failureCode);
  return { kind: "failed" as const, requestId: input.claim.requestId, failureCode };
}

export async function dispatchNextGrantReportExportRequest(
  dependencies: {
    repository: GrantReportExportOutboxRepository;
    publisher: GrantReportExportQueuePublisher;
    retryPolicy?: GrantReportExportDispatchRetryPolicy;
    heartbeatMilliseconds?: number;
    publicationTimeoutMilliseconds?: number;
  },
) {
  const retryPolicy = dependencies.retryPolicy ?? createGrantReportExportDispatchRetryPolicy();
  if (retryPolicy.maximumAttempts !== grantReportExportDispatchDefaults.maximumAttempts) {
    throw new Error("The export dispatch retry policy conflicts with the database attempt limit.");
  }
  const heartbeatMilliseconds = positiveSafeInteger(
    dependencies.heartbeatMilliseconds ?? grantReportExportDispatchDefaults.heartbeatMilliseconds,
    "heartbeat interval",
  );
  const publicationTimeoutMilliseconds = positiveSafeInteger(
    dependencies.publicationTimeoutMilliseconds ?? grantReportExportDispatchDefaults.publicationTimeoutMilliseconds,
    "publication timeout",
  );
  if (
    heartbeatMilliseconds > grantReportExportDispatchDefaults.heartbeatMilliseconds
    || publicationTimeoutMilliseconds > grantReportExportDispatchDefaults.publicationTimeoutMilliseconds
    || heartbeatMilliseconds >= publicationTimeoutMilliseconds
  ) {
    throw new Error("The export dispatch heartbeat and publication timeout configuration is invalid.");
  }
  const claim = await dependencies.repository.claimPendingRequest();
  if (!claim) return { kind: "idle" as const };

  const outcome = await publishWithLeaseHeartbeat({
    claim,
    repository: dependencies.repository,
    publisher: dependencies.publisher,
    heartbeatMilliseconds,
    publicationTimeoutMilliseconds,
  });
  if (outcome.kind === "ownership_lost") {
    throw new GrantReportExportDispatchOwnershipLostError(claim.requestId);
  }

  if (outcome.kind === "settled" && outcome.publication.ok) {
    try {
      await dependencies.repository.markPublicationSuccessful(claim, outcome.publication);
    } catch {
      // The provider may already have accepted the message. Leaving the claim
      // leased makes recovery explicitly at-least-once instead of pretending
      // that publication failed or releasing it for immediate duplication.
      throw new GrantReportExportDispatchAcknowledgementError(claim.requestId);
    }
    return { kind: "dispatched" as const, requestId: claim.requestId, messageId: outcome.publication.messageId };
  }

  const failure = outcome.kind === "settled" && !outcome.publication.ok
    ? outcome.publication.failure
    : { code: "QUEUE_UNAVAILABLE" as const, retryable: true };
  return recordSafeFailure({ claim, repository: dependencies.repository, retryPolicy, failure });
}
