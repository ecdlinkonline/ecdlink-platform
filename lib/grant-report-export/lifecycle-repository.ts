import "server-only";

import { Prisma, type GrantReportExportFormat, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  assertGrantReportExportStoragePath,
  createLifecycleToken,
  grantReportExportLifecycleDefaults,
  GrantReportExportLifecycleError,
  type GrantReportExportFailureCode,
} from "@/lib/grant-report-export/export-lifecycle";

type LifecycleDatabase = Pick<PrismaClient, "$transaction">;

export type ClaimedGrantReportExportAttempt = {
  kind: "claimed";
  artifactId: string;
  attemptId: string;
  attemptNumber: number;
  generationToken: string;
  leaseExpiresAt: Date;
  reportId: string;
  versionId: string;
};

export type GrantReportExportAttemptClaim =
  | ClaimedGrantReportExportAttempt
  | { kind: "in_progress"; artifactId: string; attemptId: string; attemptNumber: number; leaseExpiresAt: Date }
  | { kind: "completed"; artifactId: string; fileAssetId: string; sha256: string; byteSize: number; completedAt: Date };

export type GrantReportExportCleanupClaim = {
  artifactId: string;
  attemptId: string;
  attemptNumber: number;
  generationToken: string;
  cleanupToken: string;
  fileAssetId: string;
  storageKey: string;
  reportId: string;
  versionId: string;
};

type RepositoryOptions = {
  database?: LifecycleDatabase;
  now?: () => Date;
  token?: () => string;
  generationLeaseMilliseconds?: number;
  cleanupQuarantineMilliseconds?: number;
  cleanupLeaseMilliseconds?: number;
};

function isRetryableTransactionError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2034" || error.code === "P2002");
}

async function serializable<T>(database: LifecycleDatabase, operation: (tx: Prisma.TransactionClient) => Promise<T>, retries = 3): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await database.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (attempt >= retries - 1 || !isRetryableTransactionError(error)) throw error;
    }
  }
}

function requireSubmittedVersion(version: { status: string; report: { status: string } } | null) {
  if (!version) throw new GrantReportExportLifecycleError("REPORT_VERSION_NOT_FOUND", "Grant report version not found.");
  if (version.status !== "SUBMITTED" || version.report.status !== "SUBMITTED") {
    throw new GrantReportExportLifecycleError("REPORT_VERSION_NOT_SUBMITTED", "Only submitted report versions can produce an official export artifact.");
  }
}

export async function claimGrantReportExportAttempt(
  input: { reportId: string; versionId: string; actorUserId: string; format?: GrantReportExportFormat },
  options: RepositoryOptions = {},
): Promise<GrantReportExportAttemptClaim> {
  const database = options.database ?? prisma;
  const now = options.now?.() ?? new Date();
  const format = input.format ?? "SUBMISSION_PACK_ZIP";
  const token = options.token ?? createLifecycleToken;
  const leaseMilliseconds = options.generationLeaseMilliseconds ?? grantReportExportLifecycleDefaults.generationLeaseMilliseconds;
  const quarantineMilliseconds = options.cleanupQuarantineMilliseconds ?? grantReportExportLifecycleDefaults.cleanupQuarantineMilliseconds;

  return serializable(database, async (tx) => {
    const version = await tx.grantReportVersion.findFirst({
      where: { id: input.versionId, grantReportId: input.reportId },
      select: { status: true, report: { select: { status: true } } },
    });
    requireSubmittedVersion(version);

    let artifact = await tx.grantReportExportArtifact.findUnique({
      where: { grantReportVersionId_format: { grantReportVersionId: input.versionId, format } },
      select: {
        id: true,
        status: true,
        latestAttemptNumber: true,
        completedFileAssetId: true,
        sha256: true,
        byteSize: true,
        completedAt: true,
      },
    });
    if (artifact?.status === "COMPLETED") {
      if (!artifact.completedFileAssetId || !artifact.sha256 || !artifact.byteSize || !artifact.completedAt) {
        throw new GrantReportExportLifecycleError("STALE_ATTEMPT", "Completed export metadata is inconsistent.");
      }
      return {
        kind: "completed",
        artifactId: artifact.id,
        fileAssetId: artifact.completedFileAssetId,
        sha256: artifact.sha256,
        byteSize: artifact.byteSize,
        completedAt: artifact.completedAt,
      };
    }

    const currentAttempt = artifact?.latestAttemptNumber
      ? await tx.grantReportExportAttempt.findUnique({
          where: { artifactId_attemptNumber: { artifactId: artifact.id, attemptNumber: artifact.latestAttemptNumber } },
          select: { id: true, attemptNumber: true, generationToken: true, status: true, leaseExpiresAt: true, stagedFileAssetId: true },
        })
      : null;
    if (currentAttempt?.status === "GENERATING" && currentAttempt.leaseExpiresAt > now) {
      return {
        kind: "in_progress",
        artifactId: artifact!.id,
        attemptId: currentAttempt.id,
        attemptNumber: currentAttempt.attemptNumber,
        leaseExpiresAt: currentAttempt.leaseExpiresAt,
      };
    }
    if (currentAttempt?.status === "GENERATING") {
      const abandoned = await tx.grantReportExportAttempt.updateMany({
        where: {
          id: currentAttempt.id,
          generationToken: currentAttempt.generationToken,
          status: "GENERATING",
          leaseExpiresAt: { lte: now },
        },
        data: {
          status: "ABANDONED",
          finishedAt: now,
          failureCode: "LEASE_EXPIRED",
          cleanupEligibleAt: currentAttempt.stagedFileAssetId ? new Date(now.getTime() + quarantineMilliseconds) : null,
        },
      });
      if (abandoned.count !== 1) throw new Prisma.PrismaClientKnownRequestError("Export attempt changed concurrently.", { code: "P2034", clientVersion: Prisma.prismaVersion.client });
    }

    const attemptNumber = (artifact?.latestAttemptNumber ?? 0) + 1;
    if (!artifact) {
      artifact = await tx.grantReportExportArtifact.create({
        data: {
          grantReportId: input.reportId,
          grantReportVersionId: input.versionId,
          format,
          status: "GENERATING",
          integrityStatus: "PENDING",
          latestAttemptNumber: attemptNumber,
        },
        select: { id: true, status: true, latestAttemptNumber: true, completedFileAssetId: true, sha256: true, byteSize: true, completedAt: true },
      });
    } else {
      const claimed = await tx.grantReportExportArtifact.updateMany({
        where: { id: artifact.id, latestAttemptNumber: artifact.latestAttemptNumber, status: { not: "COMPLETED" } },
        data: { status: "GENERATING", integrityStatus: "PENDING", latestAttemptNumber: attemptNumber },
      });
      if (claimed.count !== 1) throw new Prisma.PrismaClientKnownRequestError("Export artifact changed concurrently.", { code: "P2034", clientVersion: Prisma.prismaVersion.client });
    }

    const generationToken = token();
    const leaseExpiresAt = new Date(now.getTime() + leaseMilliseconds);
    const attempt = await tx.grantReportExportAttempt.create({
      data: {
        artifactId: artifact.id,
        attemptNumber,
        generationToken,
        status: "GENERATING",
        startedByUserId: input.actorUserId,
        startedAt: now,
        leaseExpiresAt,
      },
      select: { id: true },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: "grant.report.export.generation_started",
        entityType: "GrantReportExportArtifact",
        entityId: artifact.id,
        metadata: { reportId: input.reportId, versionId: input.versionId, format, attemptNumber },
      },
    });
    return { kind: "claimed", artifactId: artifact.id, attemptId: attempt.id, attemptNumber, generationToken, leaseExpiresAt, reportId: input.reportId, versionId: input.versionId };
  });
}

export async function renewGrantReportExportAttemptLease(
  input: ClaimedGrantReportExportAttempt,
  options: RepositoryOptions = {},
) {
  const now = options.now?.() ?? new Date();
  const leaseExpiresAt = new Date(now.getTime() + (options.generationLeaseMilliseconds ?? grantReportExportLifecycleDefaults.generationLeaseMilliseconds));
  const database = options.database ?? prisma;
  return serializable(database, async (tx) => {
    const attempt = await tx.grantReportExportAttempt.findUnique({
      where: { id: input.attemptId },
      select: { id: true, status: true, generationToken: true, attemptNumber: true, leaseExpiresAt: true, artifact: { select: { status: true, latestAttemptNumber: true } } },
    });
    if (!attempt || attempt.status !== "GENERATING" || attempt.generationToken !== input.generationToken || attempt.attemptNumber !== attempt.artifact.latestAttemptNumber || attempt.artifact.status !== "GENERATING") {
      throw new GrantReportExportLifecycleError("STALE_ATTEMPT", "The export generation attempt is no longer current.");
    }
    if (attempt.leaseExpiresAt <= now) throw new GrantReportExportLifecycleError("ATTEMPT_EXPIRED", "The export generation lease has expired.");
    await tx.grantReportExportAttempt.update({ where: { id: attempt.id }, data: { leaseExpiresAt } });
    return leaseExpiresAt;
  });
}

export async function stageGrantReportExportFile(
  input: ClaimedGrantReportExportAttempt & {
    fileAssetId: string;
    storageKey: string;
    sha256: string;
    byteSize: number;
    manifestSchemaVersion: number;
    actorUserId: string;
  },
  options: RepositoryOptions = {},
) {
  const database = options.database ?? prisma;
  const now = options.now?.() ?? new Date();
  assertGrantReportExportStoragePath(input.storageKey, {
    reportId: input.reportId,
    versionId: input.versionId,
    artifactId: input.artifactId,
    attemptNumber: input.attemptNumber,
    generationToken: input.generationToken,
    fileAssetId: input.fileAssetId,
  });
  return serializable(database, async (tx) => {
    const attempt = await tx.grantReportExportAttempt.findUnique({
      where: { id: input.attemptId },
      select: {
        id: true,
        status: true,
        generationToken: true,
        attemptNumber: true,
        leaseExpiresAt: true,
        stagedFileAssetId: true,
        artifact: { select: { status: true, latestAttemptNumber: true } },
      },
    });
    if (!attempt || attempt.status !== "GENERATING" || attempt.generationToken !== input.generationToken || attempt.attemptNumber !== input.attemptNumber || attempt.attemptNumber !== attempt.artifact.latestAttemptNumber || attempt.artifact.status !== "GENERATING") {
      throw new GrantReportExportLifecycleError("STALE_ATTEMPT", "The export generation attempt is no longer current.");
    }
    if (attempt.leaseExpiresAt <= now) throw new GrantReportExportLifecycleError("ATTEMPT_EXPIRED", "The export generation lease has expired.");
    if (attempt.stagedFileAssetId) throw new GrantReportExportLifecycleError("FILE_ALREADY_STAGED", "The export generation attempt already owns a staged file.");

    await tx.fileAsset.create({
      data: {
        id: input.fileAssetId,
        storageProvider: "supabase",
        storageKey: input.storageKey,
        originalFilename: "ECDLink-Submission-Pack.zip",
        mimeType: "application/zip",
        fileSize: input.byteSize,
        checksum: input.sha256,
        uploadedByUserId: input.actorUserId,
      },
    });
    await tx.grantReportExportAttempt.update({
      where: { id: attempt.id },
      data: {
        stagedFileAssetId: input.fileAssetId,
        expectedSha256: input.sha256,
        expectedByteSize: input.byteSize,
        manifestSchemaVersion: input.manifestSchemaVersion,
      },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: "grant.report.export.file_staged",
        entityType: "GrantReportExportAttempt",
        entityId: attempt.id,
        metadata: { artifactId: input.artifactId, reportId: input.reportId, versionId: input.versionId, attemptNumber: input.attemptNumber, fileAssetId: input.fileAssetId, byteSize: input.byteSize, sha256: input.sha256 },
      },
    });
    return { fileAssetId: input.fileAssetId };
  });
}

export async function completeGrantReportExportAttempt(
  input: ClaimedGrantReportExportAttempt & {
    fileAssetId: string;
    sha256: string;
    byteSize: number;
    manifestSchemaVersion: number;
    storageObjectVersion?: string | null;
    actorUserId: string;
  },
  options: RepositoryOptions = {},
) {
  const database = options.database ?? prisma;
  const now = options.now?.() ?? new Date();
  return serializable(database, async (tx) => {
    const attempt = await tx.grantReportExportAttempt.findUnique({
      where: { id: input.attemptId },
      select: {
        id: true,
        status: true,
        generationToken: true,
        attemptNumber: true,
        leaseExpiresAt: true,
        stagedFileAssetId: true,
        expectedSha256: true,
        expectedByteSize: true,
        manifestSchemaVersion: true,
        artifact: {
          select: {
            id: true,
            status: true,
            latestAttemptNumber: true,
            reportVersion: { select: { status: true, report: { select: { status: true } } } },
          },
        },
      },
    });
    if (!attempt || attempt.status !== "GENERATING" || attempt.generationToken !== input.generationToken || attempt.attemptNumber !== input.attemptNumber || attempt.attemptNumber !== attempt.artifact.latestAttemptNumber || attempt.artifact.status !== "GENERATING") {
      throw new GrantReportExportLifecycleError("STALE_ATTEMPT", "The export generation attempt is no longer current.");
    }
    requireSubmittedVersion(attempt.artifact.reportVersion);
    if (attempt.leaseExpiresAt <= now) throw new GrantReportExportLifecycleError("ATTEMPT_EXPIRED", "The export generation lease has expired.");
    if (
      attempt.stagedFileAssetId !== input.fileAssetId
      || attempt.expectedSha256 !== input.sha256
      || attempt.expectedByteSize !== input.byteSize
      || attempt.manifestSchemaVersion !== input.manifestSchemaVersion
    ) {
      throw new GrantReportExportLifecycleError("STALE_ATTEMPT", "The verified export does not match the current attempt's staged file.");
    }

    const completedAttempt = await tx.grantReportExportAttempt.updateMany({
      where: { id: attempt.id, status: "GENERATING", generationToken: input.generationToken, stagedFileAssetId: input.fileAssetId },
      data: { status: "COMPLETED", finishedAt: now },
    });
    const completedArtifact = await tx.grantReportExportArtifact.updateMany({
      where: { id: attempt.artifact.id, status: "GENERATING", latestAttemptNumber: input.attemptNumber },
      data: {
        status: "COMPLETED",
        integrityStatus: "VERIFIED",
        completedFileAssetId: input.fileAssetId,
        sha256: input.sha256,
        byteSize: input.byteSize,
        manifestSchemaVersion: input.manifestSchemaVersion,
        storageObjectVersion: input.storageObjectVersion ?? null,
        completedByUserId: input.actorUserId,
        completedAt: now,
        lastIntegrityVerifiedAt: now,
      },
    });
    if (completedAttempt.count !== 1 || completedArtifact.count !== 1) {
      throw new Prisma.PrismaClientKnownRequestError("Export completion changed concurrently.", { code: "P2034", clientVersion: Prisma.prismaVersion.client });
    }
    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: "grant.report.export.generated",
        entityType: "GrantReportExportArtifact",
        entityId: attempt.artifact.id,
        metadata: { reportId: input.reportId, versionId: input.versionId, attemptNumber: input.attemptNumber, fileAssetId: input.fileAssetId, byteSize: input.byteSize, sha256: input.sha256, manifestSchemaVersion: input.manifestSchemaVersion },
      },
    });
    return { artifactId: attempt.artifact.id, fileAssetId: input.fileAssetId, completedAt: now };
  });
}

export async function failGrantReportExportAttempt(
  input: ClaimedGrantReportExportAttempt & { actorUserId: string; failureCode: GrantReportExportFailureCode },
  options: RepositoryOptions = {},
) {
  const database = options.database ?? prisma;
  const now = options.now?.() ?? new Date();
  const quarantineMilliseconds = options.cleanupQuarantineMilliseconds ?? grantReportExportLifecycleDefaults.cleanupQuarantineMilliseconds;
  return serializable(database, async (tx) => {
    const attempt = await tx.grantReportExportAttempt.findUnique({
      where: { id: input.attemptId },
      select: { id: true, status: true, generationToken: true, attemptNumber: true, stagedFileAssetId: true, artifact: { select: { id: true, status: true, latestAttemptNumber: true } } },
    });
    if (!attempt || attempt.status !== "GENERATING" || attempt.generationToken !== input.generationToken || attempt.attemptNumber !== input.attemptNumber || attempt.attemptNumber !== attempt.artifact.latestAttemptNumber || attempt.artifact.status === "COMPLETED") {
      return { kind: "stale" as const };
    }
    await tx.grantReportExportAttempt.update({
      where: { id: attempt.id },
      data: {
        status: "FAILED",
        finishedAt: now,
        failureCode: input.failureCode,
        cleanupEligibleAt: attempt.stagedFileAssetId ? new Date(now.getTime() + quarantineMilliseconds) : null,
      },
    });
    await tx.grantReportExportArtifact.update({ where: { id: attempt.artifact.id }, data: { status: "FAILED" } });
    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: "grant.report.export.generation_failed",
        entityType: "GrantReportExportArtifact",
        entityId: attempt.artifact.id,
        metadata: { reportId: input.reportId, versionId: input.versionId, attemptNumber: input.attemptNumber, failureCode: input.failureCode },
      },
    });
    return { kind: "failed" as const };
  });
}

export async function claimGrantReportExportCleanup(
  input: { attemptId: string; actorUserId: string },
  options: RepositoryOptions = {},
): Promise<GrantReportExportCleanupClaim> {
  const database = options.database ?? prisma;
  const now = options.now?.() ?? new Date();
  const token = options.token ?? createLifecycleToken;
  const leaseExpiresAt = new Date(now.getTime() + (options.cleanupLeaseMilliseconds ?? grantReportExportLifecycleDefaults.cleanupLeaseMilliseconds));
  return serializable(database, async (tx) => {
    const attempt = await tx.grantReportExportAttempt.findUnique({
      where: { id: input.attemptId },
      select: {
        id: true,
        attemptNumber: true,
        generationToken: true,
        status: true,
        stagedFileAssetId: true,
        cleanupEligibleAt: true,
        cleanupToken: true,
        cleanupLeaseExpiresAt: true,
        cleanedAt: true,
        stagedFile: { select: { id: true, storageProvider: true, storageKey: true } },
        artifact: { select: { id: true, grantReportId: true, grantReportVersionId: true } },
      },
    });
    if (
      !attempt
      || !["FAILED", "ABANDONED"].includes(attempt.status)
      || !attempt.stagedFileAssetId
      || !attempt.stagedFile
      || attempt.stagedFile.storageProvider !== "supabase"
      || !attempt.cleanupEligibleAt
      || attempt.cleanupEligibleAt > now
      || attempt.cleanedAt
      || (attempt.cleanupToken && attempt.cleanupLeaseExpiresAt && attempt.cleanupLeaseExpiresAt > now)
    ) {
      throw new GrantReportExportLifecycleError("CLEANUP_NOT_AVAILABLE", "The export attempt is not eligible for cleanup.");
    }
    const cleanupToken = token();
    const claimed = await tx.grantReportExportAttempt.updateMany({
      where: {
        id: attempt.id,
        status: { in: ["FAILED", "ABANDONED"] },
        stagedFileAssetId: attempt.stagedFileAssetId,
        cleanedAt: null,
        cleanupEligibleAt: { lte: now },
        OR: [{ cleanupToken: null }, { cleanupLeaseExpiresAt: { lte: now } }],
      },
      data: { cleanupToken, cleanupLeaseExpiresAt: leaseExpiresAt },
    });
    if (claimed.count !== 1) throw new GrantReportExportLifecycleError("CLEANUP_NOT_AVAILABLE", "The export attempt cleanup was claimed concurrently.");
    return {
      artifactId: attempt.artifact.id,
      attemptId: attempt.id,
      attemptNumber: attempt.attemptNumber,
      generationToken: attempt.generationToken,
      cleanupToken,
      fileAssetId: attempt.stagedFile.id,
      storageKey: attempt.stagedFile.storageKey,
      reportId: attempt.artifact.grantReportId,
      versionId: attempt.artifact.grantReportVersionId,
    };
  });
}

export async function completeGrantReportExportCleanup(
  input: GrantReportExportCleanupClaim & { actorUserId: string },
  options: RepositoryOptions = {},
) {
  const database = options.database ?? prisma;
  const now = options.now?.() ?? new Date();
  return serializable(database, async (tx) => {
    const attempt = await tx.grantReportExportAttempt.findUnique({
      where: { id: input.attemptId },
      select: { status: true, cleanupToken: true, cleanupLeaseExpiresAt: true, stagedFileAssetId: true },
    });
    if (
      !attempt
      || !["FAILED", "ABANDONED"].includes(attempt.status)
      || attempt.cleanupToken !== input.cleanupToken
      || !attempt.cleanupLeaseExpiresAt
      || attempt.cleanupLeaseExpiresAt <= now
      || attempt.stagedFileAssetId !== input.fileAssetId
    ) {
      throw new GrantReportExportLifecycleError("CLEANUP_NOT_AVAILABLE", "The export cleanup claim is no longer current.");
    }
    await tx.grantReportExportAttempt.update({
      where: { id: input.attemptId },
      data: { stagedFileAssetId: null, cleanupToken: null, cleanupLeaseExpiresAt: null, cleanedAt: now },
    });
    await tx.fileAsset.delete({ where: { id: input.fileAssetId } });
    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: "grant.report.export.cleanup_completed",
        entityType: "GrantReportExportAttempt",
        entityId: input.attemptId,
        metadata: { artifactId: input.artifactId, reportId: input.reportId, versionId: input.versionId, attemptNumber: input.attemptNumber, fileAssetId: input.fileAssetId },
      },
    });
  });
}

export async function releaseGrantReportExportCleanup(
  input: GrantReportExportCleanupClaim & { actorUserId: string; failureCode: string },
  options: RepositoryOptions = {},
) {
  const database = options.database ?? prisma;
  return serializable(database, async (tx) => {
    const released = await tx.grantReportExportAttempt.updateMany({
      where: { id: input.attemptId, cleanupToken: input.cleanupToken, status: { in: ["FAILED", "ABANDONED"] }, cleanedAt: null },
      data: { cleanupToken: null, cleanupLeaseExpiresAt: null },
    });
    if (released.count === 1) {
      await tx.auditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "grant.report.export.cleanup_failed",
          entityType: "GrantReportExportAttempt",
          entityId: input.attemptId,
          metadata: { artifactId: input.artifactId, reportId: input.reportId, versionId: input.versionId, attemptNumber: input.attemptNumber, failureCode: input.failureCode },
        },
      });
    }
    return released.count === 1;
  });
}
