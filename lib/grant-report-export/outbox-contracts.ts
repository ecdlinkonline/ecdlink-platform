import type { GrantReportExportFormat, GrantReportExportRequestStatus } from "@prisma/client";

export const grantReportExportDispatchDefaults = {
  leaseMilliseconds: 60_000,
  maximumAttempts: 5,
  initialRetryDelayMilliseconds: 5_000,
  maximumRetryDelayMilliseconds: 5 * 60_000,
  transactionAttempts: 3,
  heartbeatMilliseconds: 20_000,
  publicationTimeoutMilliseconds: 45_000,
} as const;

export type GrantReportExportDispatchFailureCode =
  | "QUEUE_UNAVAILABLE"
  | "QUEUE_RATE_LIMITED"
  | "QUEUE_AUTHENTICATION_FAILED"
  | "QUEUE_CONFIGURATION_INVALID"
  | "QUEUE_MESSAGE_REJECTED"
  | "DISPATCH_LEASE_EXPIRED"
  | "DISPATCH_ATTEMPTS_EXHAUSTED"
  | "DISPATCH_FAILED";

export type GrantReportExportQueuePublicationResult =
  | {
      ok: true;
      messageId: string;
      publishedAt: Date;
    }
  | {
      ok: false;
      failure: {
        code: GrantReportExportDispatchFailureCode;
        retryable: boolean;
      };
    };

export interface GrantReportExportQueuePublisher {
  publishExportRequest(input: {
    requestId: string;
    dispatchToken: string;
    signal: AbortSignal;
  }): Promise<GrantReportExportQueuePublicationResult>;
}

export type ClaimedGrantReportExportRequest = {
  requestId: string;
  dispatchToken: string;
  dispatchAttemptCount: number;
  dispatchLeaseExpiresAt: Date;
  grantReportId: string;
  grantReportVersionId: string;
  format: GrantReportExportFormat;
  requestedByUserId: string;
};

export type GrantReportExportRequestStatusProjection = {
  requestId: string;
  format: GrantReportExportFormat;
  status: GrantReportExportRequestStatus;
  safeFailureCode: string | null;
  artifactId: string | null;
  createdAt: Date;
  dispatchedAt: Date | null;
  completedAt: Date | null;
  failedAt: Date | null;
  updatedAt: Date;
};

export interface GrantReportExportOutboxRepository {
  claimPendingRequest(): Promise<ClaimedGrantReportExportRequest | null>;
  extendDispatchLease(claim: ClaimedGrantReportExportRequest): Promise<Date>;
  markPublicationSuccessful(
    claim: ClaimedGrantReportExportRequest,
    publication: Extract<GrantReportExportQueuePublicationResult, { ok: true }>,
  ): Promise<void>;
  releaseClaimForRetry(
    claim: ClaimedGrantReportExportRequest,
    failureCode: GrantReportExportDispatchFailureCode,
    delayMilliseconds: number,
  ): Promise<Date>;
  markPermanentDispatchFailure(
    claim: ClaimedGrantReportExportRequest,
    failureCode: GrantReportExportDispatchFailureCode,
  ): Promise<void>;
  getRequestStatus(input: {
    requestId: string;
    grantReportId: string;
    grantReportVersionId: string;
  }): Promise<GrantReportExportRequestStatusProjection | null>;
}

export type GrantReportExportDispatchRetryPolicy = {
  maximumAttempts: number;
  retryDelayMilliseconds(attemptNumber: number): number;
  shouldRetry(input: {
    attemptNumber: number;
    failure: Extract<GrantReportExportQueuePublicationResult, { ok: false }>["failure"];
  }): boolean;
};

type GrantReportExportDispatchRetryPolicyOptions = {
  maximumAttempts?: number;
  initialRetryDelayMilliseconds?: number;
  maximumRetryDelayMilliseconds?: number;
};

export function createGrantReportExportDispatchRetryPolicy(
  options: GrantReportExportDispatchRetryPolicyOptions = {},
): GrantReportExportDispatchRetryPolicy {
  const maximumAttempts = options.maximumAttempts ?? grantReportExportDispatchDefaults.maximumAttempts;
  const initialDelay = options.initialRetryDelayMilliseconds ?? grantReportExportDispatchDefaults.initialRetryDelayMilliseconds;
  const maximumDelay = options.maximumRetryDelayMilliseconds ?? grantReportExportDispatchDefaults.maximumRetryDelayMilliseconds;
  if (
    maximumAttempts !== grantReportExportDispatchDefaults.maximumAttempts
    || !Number.isSafeInteger(initialDelay)
    || !Number.isSafeInteger(maximumDelay)
    || initialDelay < 1
    || maximumDelay < initialDelay
    || maximumDelay > grantReportExportDispatchDefaults.maximumRetryDelayMilliseconds
  ) {
    throw new Error("The export dispatch retry policy is invalid.");
  }
  return {
    maximumAttempts,
    retryDelayMilliseconds(attemptNumber) {
      assertDispatchAttempt(attemptNumber);
      const multiplier = 2 ** (attemptNumber - 1);
      return Math.min(maximumDelay, initialDelay * multiplier);
    },
    shouldRetry({ attemptNumber, failure }) {
      assertDispatchAttempt(attemptNumber);
      return failure.retryable && attemptNumber < maximumAttempts;
    },
  };
}

function assertDispatchAttempt(attemptNumber: number) {
  if (!Number.isSafeInteger(attemptNumber) || attemptNumber < 1 || attemptNumber > grantReportExportDispatchDefaults.maximumAttempts) {
    throw new Error("The export dispatch attempt is invalid.");
  }
}

export function projectGrantReportExportRequestStatus(input: GrantReportExportRequestStatusProjection) {
  return {
    requestId: input.requestId,
    format: input.format,
    status: input.status,
    safeFailureCode: input.safeFailureCode,
    artifactId: input.artifactId,
    createdAt: input.createdAt,
    dispatchedAt: input.dispatchedAt,
    completedAt: input.completedAt,
    failedAt: input.failedAt,
    updatedAt: input.updatedAt,
  };
}
