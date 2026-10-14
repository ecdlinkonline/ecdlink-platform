import "server-only";

import { randomBytes } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  grantReportExportDispatchDefaults,
  projectGrantReportExportRequestStatus,
  type ClaimedGrantReportExportRequest,
  type GrantReportExportDispatchFailureCode,
  type GrantReportExportOutboxRepository,
  type GrantReportExportQueuePublicationResult,
} from "@/lib/grant-report-export/outbox-contracts";

type OutboxDatabase = Pick<PrismaClient, "$transaction">;
type DatabaseClock = (tx: Prisma.TransactionClient) => Promise<Date>;

type RepositoryOptions = {
  database?: OutboxDatabase;
  databaseClock?: DatabaseClock;
  token?: () => string;
  leaseMilliseconds?: number;
  transactionAttempts?: number;
};

export class GrantReportExportOutboxError extends Error {
  constructor(
    public readonly code:
      | "STALE_DISPATCH_CLAIM"
      | "DISPATCH_LEASE_EXPIRED"
      | "DISPATCH_ATTEMPTS_EXHAUSTED"
      | "INVALID_PUBLICATION"
      | "INVALID_FAILURE_CODE"
      | "INVALID_CONFIGURATION",
    message: string,
  ) {
    super(message);
    this.name = "GrantReportExportOutboxError";
  }
}

function isRetryableTransactionError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

async function serializable<T>(
  database: OutboxDatabase,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
  attempts: number,
) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await database.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (attempt >= attempts || !isRetryableTransactionError(error)) throw error;
    }
  }
}

function createDispatchToken() {
  return randomBytes(32).toString("hex");
}

async function readPostgresClock(tx: Prisma.TransactionClient) {
  // Lease ownership uses the database wall clock. CURRENT_TIMESTAMP is fixed
  // at transaction start and is unsuitable if a transaction is delayed.
  const rows = await tx.$queryRaw<Array<{ databaseNow: Date }>>(Prisma.sql`SELECT clock_timestamp() AS "databaseNow"`);
  const databaseNow = rows[0]?.databaseNow;
  if (!(databaseNow instanceof Date) || !Number.isFinite(databaseNow.getTime())) {
    throw new GrantReportExportOutboxError("INVALID_CONFIGURATION", "The database clock could not be read.");
  }
  return databaseNow;
}

function validatePositiveInteger(value: number, name: string) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new GrantReportExportOutboxError("INVALID_CONFIGURATION", `The export dispatch ${name} is invalid.`);
  }
  return value;
}

function addMilliseconds(value: Date, milliseconds: number) {
  const timestamp = value.getTime() + milliseconds;
  if (!Number.isSafeInteger(timestamp)) {
    throw new GrantReportExportOutboxError("INVALID_CONFIGURATION", "The export dispatch timestamp is invalid.");
  }
  return new Date(timestamp);
}

function validateRetryDelay(value: number) {
  validatePositiveInteger(value, "retry delay");
  if (value > grantReportExportDispatchDefaults.maximumRetryDelayMilliseconds) {
    throw new GrantReportExportOutboxError("INVALID_CONFIGURATION", "The export dispatch retry delay is invalid.");
  }
  return value;
}

function systemAuditMetadata(requestedByUserId: string, metadata: Record<string, unknown>) {
  return { ...metadata, actorType: "SYSTEM_WORKER", requestedByUserId };
}

function assertToken(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new GrantReportExportOutboxError("STALE_DISPATCH_CLAIM", "The export dispatch claim is invalid.");
}

function assertFailureCode(code: string): asserts code is GrantReportExportDispatchFailureCode {
  if (!/^[A-Z][A-Z0-9_]{0,63}$/.test(code)) {
    throw new GrantReportExportOutboxError("INVALID_FAILURE_CODE", "The export dispatch failure classification is invalid.");
  }
}

function assertMessageId(messageId: string) {
  if (!/^[\x20-\x7E]{1,255}$/.test(messageId)) {
    throw new GrantReportExportOutboxError("INVALID_PUBLICATION", "The queue publication result is invalid.");
  }
}

function assertPublicationTimestamp(value: Date) {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new GrantReportExportOutboxError("INVALID_PUBLICATION", "The queue publication result is invalid.");
  }
}

export function createGrantReportExportOutboxRepository(options: RepositoryOptions = {}): GrantReportExportOutboxRepository {
  const database = options.database ?? prisma;
  const databaseClock = options.databaseClock ?? readPostgresClock;
  const token = options.token ?? createDispatchToken;
  const leaseMilliseconds = validatePositiveInteger(options.leaseMilliseconds ?? grantReportExportDispatchDefaults.leaseMilliseconds, "lease duration");
  const transactionAttempts = validatePositiveInteger(options.transactionAttempts ?? grantReportExportDispatchDefaults.transactionAttempts, "transaction retry count");

  return {
    async claimPendingRequest() {
      return serializable(database, async (tx) => {
        const claimedAt = await databaseClock(tx);
        const dispatchToken = token();
        assertToken(dispatchToken);
        const dispatchLeaseExpiresAt = addMilliseconds(claimedAt, leaseMilliseconds);
        const candidate = await tx.grantReportExportRequest.findFirst({
          where: {
            status: "QUEUED",
            nextDispatchAt: { lte: claimedAt },
            dispatchAttemptCount: { lt: grantReportExportDispatchDefaults.maximumAttempts },
          },
          orderBy: [{ nextDispatchAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
          select: {
            id: true,
            grantReportId: true,
            grantReportVersionId: true,
            format: true,
            requestedByUserId: true,
            dispatchAttemptCount: true,
          },
        });
        if (!candidate) {
          const exhausted = await tx.grantReportExportRequest.findFirst({
            where: {
              status: "QUEUED",
              nextDispatchAt: { lte: claimedAt },
              dispatchAttemptCount: { gte: grantReportExportDispatchDefaults.maximumAttempts },
            },
            select: { id: true },
          });
          if (exhausted) {
            throw new GrantReportExportOutboxError(
              "DISPATCH_ATTEMPTS_EXHAUSTED",
              "An exhausted queued export request requires database recovery.",
            );
          }
          return null;
        }
        const claimed = await tx.grantReportExportRequest.updateMany({
          where: {
            id: candidate.id,
            status: "QUEUED",
            nextDispatchAt: { lte: claimedAt },
            dispatchAttemptCount: candidate.dispatchAttemptCount,
          },
          data: {
            status: "DISPATCHING",
            dispatchAttemptCount: { increment: 1 },
            dispatchToken,
            dispatchLeaseExpiresAt,
            lastSafeFailureCode: null,
          },
        });
        if (claimed.count !== 1) return null;
        await tx.auditLog.create({
          data: {
            actorUserId: null,
            action: "grant.report.export.dispatch_claimed",
            entityType: "GrantReportExportRequest",
            entityId: candidate.id,
            metadata: systemAuditMetadata(candidate.requestedByUserId, { dispatchAttemptCount: candidate.dispatchAttemptCount + 1 }),
          },
        });
        return {
          requestId: candidate.id,
          dispatchToken,
          dispatchAttemptCount: candidate.dispatchAttemptCount + 1,
          dispatchLeaseExpiresAt,
          grantReportId: candidate.grantReportId,
          grantReportVersionId: candidate.grantReportVersionId,
          format: candidate.format,
          requestedByUserId: candidate.requestedByUserId,
        };
      }, transactionAttempts);
    },

    async extendDispatchLease(claim) {
      assertToken(claim.dispatchToken);
      return serializable(database, async (tx) => {
        const heartbeatAt = await databaseClock(tx);
        const dispatchLeaseExpiresAt = addMilliseconds(heartbeatAt, leaseMilliseconds);
        const updated = await tx.grantReportExportRequest.updateMany({
          where: {
            id: claim.requestId,
            status: "DISPATCHING",
            dispatchToken: claim.dispatchToken,
            dispatchAttemptCount: claim.dispatchAttemptCount,
            dispatchLeaseExpiresAt: { gt: heartbeatAt },
          },
          data: { dispatchLeaseExpiresAt },
        });
        if (updated.count !== 1) throw new GrantReportExportOutboxError("DISPATCH_LEASE_EXPIRED", "The export dispatch lease is no longer active.");
        return dispatchLeaseExpiresAt;
      }, transactionAttempts);
    },

    async markPublicationSuccessful(claim, publication: Extract<GrantReportExportQueuePublicationResult, { ok: true }>) {
      assertToken(claim.dispatchToken);
      assertMessageId(publication.messageId);
      assertPublicationTimestamp(publication.publishedAt);
      await serializable(database, async (tx) => {
        const acknowledgedAt = await databaseClock(tx);
        const updated = await tx.grantReportExportRequest.updateMany({
          where: {
            id: claim.requestId,
            status: "DISPATCHING",
            dispatchToken: claim.dispatchToken,
            dispatchAttemptCount: claim.dispatchAttemptCount,
            dispatchLeaseExpiresAt: { gt: acknowledgedAt },
          },
          data: {
            status: "DISPATCHED",
            dispatchToken: null,
            dispatchLeaseExpiresAt: null,
            queueMessageId: publication.messageId,
            dispatchedAt: acknowledgedAt,
            lastSafeFailureCode: null,
          },
        });
        if (updated.count !== 1) throw new GrantReportExportOutboxError("STALE_DISPATCH_CLAIM", "The export dispatch claim is no longer current.");
        await tx.auditLog.create({
          data: {
            actorUserId: null,
            action: "grant.report.export.dispatched",
            entityType: "GrantReportExportRequest",
            entityId: claim.requestId,
            metadata: systemAuditMetadata(claim.requestedByUserId, { dispatchAttemptCount: claim.dispatchAttemptCount }),
          },
        });
      }, transactionAttempts);
    },

    async releaseClaimForRetry(claim, failureCode, delayMilliseconds) {
      assertToken(claim.dispatchToken);
      assertFailureCode(failureCode);
      validateRetryDelay(delayMilliseconds);
      if (claim.dispatchAttemptCount >= grantReportExportDispatchDefaults.maximumAttempts) {
        throw new GrantReportExportOutboxError("DISPATCH_ATTEMPTS_EXHAUSTED", "The export dispatch attempt limit has been reached.");
      }
      return serializable(database, async (tx) => {
        const releasedAt = await databaseClock(tx);
        const nextDispatchAt = addMilliseconds(releasedAt, delayMilliseconds);
        const updated = await tx.grantReportExportRequest.updateMany({
          where: {
            id: claim.requestId,
            status: "DISPATCHING",
            dispatchToken: claim.dispatchToken,
            dispatchAttemptCount: claim.dispatchAttemptCount,
            dispatchLeaseExpiresAt: { gt: releasedAt },
          },
          data: {
            status: "QUEUED",
            dispatchToken: null,
            dispatchLeaseExpiresAt: null,
            nextDispatchAt,
            lastSafeFailureCode: failureCode,
          },
        });
        if (updated.count !== 1) throw new GrantReportExportOutboxError("STALE_DISPATCH_CLAIM", "The export dispatch claim is no longer current.");
        await tx.auditLog.create({
          data: {
            actorUserId: null,
            action: "grant.report.export.dispatch_retry_scheduled",
            entityType: "GrantReportExportRequest",
            entityId: claim.requestId,
            metadata: systemAuditMetadata(claim.requestedByUserId, { dispatchAttemptCount: claim.dispatchAttemptCount, failureCode, nextDispatchAt: nextDispatchAt.toISOString() }),
          },
        });
        return nextDispatchAt;
      }, transactionAttempts);
    },

    async markPermanentDispatchFailure(claim, failureCode) {
      assertToken(claim.dispatchToken);
      assertFailureCode(failureCode);
      await serializable(database, async (tx) => {
        const failedAt = await databaseClock(tx);
        const updated = await tx.grantReportExportRequest.updateMany({
          where: {
            id: claim.requestId,
            status: "DISPATCHING",
            dispatchToken: claim.dispatchToken,
            dispatchAttemptCount: claim.dispatchAttemptCount,
            dispatchLeaseExpiresAt: { gt: failedAt },
          },
          data: {
            status: "FAILED",
            dispatchToken: null,
            dispatchLeaseExpiresAt: null,
            failedAt,
            lastSafeFailureCode: failureCode,
          },
        });
        if (updated.count !== 1) throw new GrantReportExportOutboxError("STALE_DISPATCH_CLAIM", "The export dispatch claim is no longer current.");
        await tx.auditLog.create({
          data: {
            actorUserId: null,
            action: "grant.report.export.dispatch_failed",
            entityType: "GrantReportExportRequest",
            entityId: claim.requestId,
            metadata: systemAuditMetadata(claim.requestedByUserId, { dispatchAttemptCount: claim.dispatchAttemptCount, failureCode }),
          },
        });
      }, transactionAttempts);
    },

    async getRequestStatus(input) {
      const request = await database.$transaction(async (tx) => tx.grantReportExportRequest.findFirst({
        where: {
          id: input.requestId,
          grantReportId: input.grantReportId,
          grantReportVersionId: input.grantReportVersionId,
        },
        select: {
          id: true,
          format: true,
          status: true,
          lastSafeFailureCode: true,
          artifactId: true,
          createdAt: true,
          dispatchedAt: true,
          completedAt: true,
          failedAt: true,
          updatedAt: true,
        },
      }), { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
      if (!request) return null;
      return projectGrantReportExportRequestStatus({
        requestId: request.id,
        format: request.format,
        status: request.status,
        safeFailureCode: request.lastSafeFailureCode,
        artifactId: request.artifactId,
        createdAt: request.createdAt,
        dispatchedAt: request.dispatchedAt,
        completedAt: request.completedAt,
        failedAt: request.failedAt,
        updatedAt: request.updatedAt,
      });
    },
  };
}

export async function recoverExpiredGrantReportExportDispatches(options: RepositoryOptions & { limit?: number } = {}) {
  const database = options.database ?? prisma;
  const databaseClock = options.databaseClock ?? readPostgresClock;
  const transactionAttempts = validatePositiveInteger(options.transactionAttempts ?? grantReportExportDispatchDefaults.transactionAttempts, "transaction retry count");
  const limit = Math.min(100, validatePositiveInteger(options.limit ?? 25, "recovery batch size"));
  return serializable(database, async (tx) => {
    const now = await databaseClock(tx);
    const expired = await tx.grantReportExportRequest.findMany({
      where: { status: "DISPATCHING", dispatchLeaseExpiresAt: { lte: now }, dispatchToken: { not: null } },
      orderBy: [{ dispatchLeaseExpiresAt: "asc" }, { id: "asc" }],
      take: limit,
      select: { id: true, dispatchToken: true, dispatchAttemptCount: true, requestedByUserId: true },
    });
    let recovered = 0;
    let failed = 0;
    for (const request of expired) {
      if (!request.dispatchToken) continue;
      const exhausted = request.dispatchAttemptCount >= grantReportExportDispatchDefaults.maximumAttempts;
      const updated = await tx.grantReportExportRequest.updateMany({
        where: {
          id: request.id,
          status: "DISPATCHING",
          dispatchToken: request.dispatchToken,
          dispatchAttemptCount: request.dispatchAttemptCount,
          dispatchLeaseExpiresAt: { lte: now },
        },
        data: exhausted ? {
          status: "FAILED",
          dispatchToken: null,
          dispatchLeaseExpiresAt: null,
          failedAt: now,
          lastSafeFailureCode: "DISPATCH_ATTEMPTS_EXHAUSTED",
        } : {
          status: "QUEUED",
          dispatchToken: null,
          dispatchLeaseExpiresAt: null,
          nextDispatchAt: now,
          lastSafeFailureCode: "DISPATCH_LEASE_EXPIRED",
        },
      });
      if (updated.count !== 1) continue;
      exhausted ? failed += 1 : recovered += 1;
      await tx.auditLog.create({
        data: {
          actorUserId: null,
          action: exhausted ? "grant.report.export.dispatch_failed" : "grant.report.export.dispatch_recovered",
          entityType: "GrantReportExportRequest",
          entityId: request.id,
          metadata: systemAuditMetadata(request.requestedByUserId, { dispatchAttemptCount: request.dispatchAttemptCount, failureCode: exhausted ? "DISPATCH_ATTEMPTS_EXHAUSTED" : "DISPATCH_LEASE_EXPIRED" }),
        },
      });
    }
    return { examined: expired.length, recovered, failed };
  }, transactionAttempts);
}
