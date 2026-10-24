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
  token?: () => string;
  generationLeaseMilliseconds?: number;
  cleanupQuarantineMilliseconds?: number;
  cleanupLeaseMilliseconds?: number;
};

type LeaseWindow = { startedAt: Date; leaseExpiresAt: Date };

function requirePositiveDuration(value: number, name: string) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new GrantReportExportLifecycleError("GENERATION_FAILED", `The export ${name} is invalid.`);
  }
  return value;
}

async function readDatabaseLeaseWindow(
  tx: Prisma.TransactionClient,
  leaseMilliseconds: number,
): Promise<LeaseWindow> {
  const duration = requirePositiveDuration(leaseMilliseconds, "lease duration");
  const rows = await tx.$queryRaw<LeaseWindow[]>(Prisma.sql`
    WITH "databaseClock" AS MATERIALIZED (
      SELECT date_trunc('milliseconds', timezone('UTC', clock_timestamp())) AS "now"
    )
    SELECT
      "now" AS "startedAt",
      "now" + (${duration} * interval '1 millisecond') AS "leaseExpiresAt"
    FROM "databaseClock"
  `);
  const window = rows[0];
  if (
    !window
    || !(window.startedAt instanceof Date)
    || !(window.leaseExpiresAt instanceof Date)
    || !Number.isFinite(window.startedAt.getTime())
    || !Number.isFinite(window.leaseExpiresAt.getTime())
    || window.leaseExpiresAt <= window.startedAt
  ) {
    throw new GrantReportExportLifecycleError("GENERATION_FAILED", "The database lease clock is unavailable.");
  }
  return window;
}

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
  const format = input.format ?? "SUBMISSION_PACK_ZIP";
  const token = options.token ?? createLifecycleToken;
  const leaseMilliseconds = requirePositiveDuration(
    options.generationLeaseMilliseconds ?? grantReportExportLifecycleDefaults.generationLeaseMilliseconds,
    "generation lease duration",
  );
  const quarantineMilliseconds = requirePositiveDuration(
    options.cleanupQuarantineMilliseconds ?? grantReportExportLifecycleDefaults.cleanupQuarantineMilliseconds,
    "cleanup quarantine duration",
  );

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
    if (currentAttempt?.status === "GENERATING") {
      const abandoned = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        WITH "databaseClock" AS MATERIALIZED (
          SELECT date_trunc('milliseconds', timezone('UTC', clock_timestamp())) AS "now"
        )
        UPDATE "GrantReportExportAttempt" AS "attempt"
        SET
          "status" = 'ABANDONED',
          "finishedAt" = "databaseClock"."now",
          "failureCode" = 'LEASE_EXPIRED',
          "cleanupEligibleAt" = CASE
            WHEN "attempt"."stagedFileAssetId" IS NOT NULL
              THEN "databaseClock"."now" + (${quarantineMilliseconds} * interval '1 millisecond')
            ELSE NULL
          END,
          "updatedAt" = "databaseClock"."now"
        FROM "databaseClock", "GrantReportExportArtifact" AS "artifact"
        WHERE "attempt"."id" = ${currentAttempt.id}
          AND "attempt"."artifactId" = "artifact"."id"
          AND "attempt"."generationToken" = ${currentAttempt.generationToken}
          AND "attempt"."status" = 'GENERATING'
          AND "attempt"."attemptNumber" = ${currentAttempt.attemptNumber}
          AND "artifact"."id" = ${artifact!.id}
          AND "artifact"."status" = 'GENERATING'
          AND "artifact"."latestAttemptNumber" = "attempt"."attemptNumber"
          AND "attempt"."leaseExpiresAt" <= "databaseClock"."now"
        RETURNING "attempt"."id"
      `);
      if (abandoned.length === 0) {
        return {
          kind: "in_progress",
          artifactId: artifact!.id,
          attemptId: currentAttempt.id,
          attemptNumber: currentAttempt.attemptNumber,
          leaseExpiresAt: currentAttempt.leaseExpiresAt,
        };
      }
      if (abandoned.length !== 1) {
        throw new Prisma.PrismaClientKnownRequestError("Export attempt changed concurrently.", { code: "P2034", clientVersion: Prisma.prismaVersion.client });
      }
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
    const { startedAt, leaseExpiresAt } = await readDatabaseLeaseWindow(tx, leaseMilliseconds);
    const attempt = await tx.grantReportExportAttempt.create({
      data: {
        artifactId: artifact.id,
        attemptNumber,
        generationToken,
        status: "GENERATING",
        startedByUserId: input.actorUserId,
        startedAt,
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
  const leaseMilliseconds = requirePositiveDuration(
    options.generationLeaseMilliseconds ?? grantReportExportLifecycleDefaults.generationLeaseMilliseconds,
    "generation lease duration",
  );
  const database = options.database ?? prisma;
  return serializable(database, async (tx) => {
    const attempt = await tx.grantReportExportAttempt.findUnique({
      where: { id: input.attemptId },
      select: { id: true, status: true, generationToken: true, attemptNumber: true, leaseExpiresAt: true, artifact: { select: { status: true, latestAttemptNumber: true } } },
    });
    if (!attempt || attempt.status !== "GENERATING" || attempt.generationToken !== input.generationToken || attempt.attemptNumber !== attempt.artifact.latestAttemptNumber || attempt.artifact.status !== "GENERATING") {
      throw new GrantReportExportLifecycleError("STALE_ATTEMPT", "The export generation attempt is no longer current.");
    }
    const renewed = await tx.$queryRaw<Array<{ leaseExpiresAt: Date }>>(Prisma.sql`
      WITH "databaseClock" AS MATERIALIZED (
        SELECT date_trunc('milliseconds', timezone('UTC', clock_timestamp())) AS "now"
      )
      UPDATE "GrantReportExportAttempt" AS "attempt"
      SET
        "leaseExpiresAt" = "databaseClock"."now" + (${leaseMilliseconds} * interval '1 millisecond'),
        "updatedAt" = "databaseClock"."now"
      FROM "databaseClock", "GrantReportExportArtifact" AS "artifact"
      WHERE "attempt"."id" = ${attempt.id}
        AND "attempt"."artifactId" = "artifact"."id"
        AND "attempt"."status" = 'GENERATING'
        AND "attempt"."generationToken" = ${input.generationToken}
        AND "attempt"."attemptNumber" = ${input.attemptNumber}
        AND "artifact"."status" = 'GENERATING'
        AND "artifact"."latestAttemptNumber" = "attempt"."attemptNumber"
        AND "attempt"."leaseExpiresAt" > "databaseClock"."now"
      RETURNING "attempt"."leaseExpiresAt"
    `);
    if (renewed.length !== 1 || !(renewed[0].leaseExpiresAt instanceof Date)) {
      throw new GrantReportExportLifecycleError("ATTEMPT_EXPIRED", "The export generation lease has expired.");
    }
    return renewed[0].leaseExpiresAt;
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
    const staged = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      WITH "databaseClock" AS MATERIALIZED (
        SELECT date_trunc('milliseconds', timezone('UTC', clock_timestamp())) AS "now"
      )
      UPDATE "GrantReportExportAttempt" AS "attempt"
      SET
        "stagedFileAssetId" = ${input.fileAssetId},
        "expectedSha256" = ${input.sha256},
        "expectedByteSize" = ${input.byteSize},
        "manifestSchemaVersion" = ${input.manifestSchemaVersion},
        "updatedAt" = "databaseClock"."now"
      FROM "databaseClock", "GrantReportExportArtifact" AS "artifact"
      WHERE "attempt"."id" = ${attempt.id}
        AND "attempt"."artifactId" = "artifact"."id"
        AND "attempt"."status" = 'GENERATING'
        AND "attempt"."generationToken" = ${input.generationToken}
        AND "attempt"."attemptNumber" = ${input.attemptNumber}
        AND "attempt"."stagedFileAssetId" IS NULL
        AND "artifact"."status" = 'GENERATING'
        AND "artifact"."latestAttemptNumber" = "attempt"."attemptNumber"
        AND "attempt"."leaseExpiresAt" > "databaseClock"."now"
      RETURNING "attempt"."id"
    `);
    if (staged.length !== 1) {
      throw new GrantReportExportLifecycleError("ATTEMPT_EXPIRED", "The export generation lease has expired.");
    }
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
    if (
      attempt.stagedFileAssetId !== input.fileAssetId
      || attempt.expectedSha256 !== input.sha256
      || attempt.expectedByteSize !== input.byteSize
      || attempt.manifestSchemaVersion !== input.manifestSchemaVersion
    ) {
      throw new GrantReportExportLifecycleError("STALE_ATTEMPT", "The verified export does not match the current attempt's staged file.");
    }

    const completedAttempt = await tx.$queryRaw<Array<{ finishedAt: Date }>>(Prisma.sql`
      WITH "databaseClock" AS MATERIALIZED (
        SELECT date_trunc('milliseconds', timezone('UTC', clock_timestamp())) AS "now"
      )
      UPDATE "GrantReportExportAttempt" AS "attempt"
      SET
        "status" = 'COMPLETED',
        "finishedAt" = "databaseClock"."now",
        "updatedAt" = "databaseClock"."now"
      FROM "databaseClock", "GrantReportExportArtifact" AS "artifact"
      WHERE "attempt"."id" = ${attempt.id}
        AND "attempt"."artifactId" = "artifact"."id"
        AND "attempt"."status" = 'GENERATING'
        AND "attempt"."generationToken" = ${input.generationToken}
        AND "attempt"."attemptNumber" = ${input.attemptNumber}
        AND "attempt"."stagedFileAssetId" = ${input.fileAssetId}
        AND "artifact"."status" = 'GENERATING'
        AND "artifact"."latestAttemptNumber" = "attempt"."attemptNumber"
        AND "attempt"."leaseExpiresAt" > "databaseClock"."now"
      RETURNING "attempt"."finishedAt"
    `);
    if (completedAttempt.length !== 1 || !(completedAttempt[0].finishedAt instanceof Date)) {
      throw new GrantReportExportLifecycleError("ATTEMPT_EXPIRED", "The export generation lease has expired.");
    }
    const completedAt = completedAttempt[0].finishedAt;
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
        completedAt,
        lastIntegrityVerifiedAt: completedAt,
      },
    });
    if (completedArtifact.count !== 1) {
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
    return { artifactId: attempt.artifact.id, fileAssetId: input.fileAssetId, completedAt };
  });
}

export async function failGrantReportExportAttempt(
  input: ClaimedGrantReportExportAttempt & { actorUserId: string; failureCode: GrantReportExportFailureCode },
  options: RepositoryOptions = {},
) {
  const database = options.database ?? prisma;
  const quarantineMilliseconds = requirePositiveDuration(
    options.cleanupQuarantineMilliseconds ?? grantReportExportLifecycleDefaults.cleanupQuarantineMilliseconds,
    "cleanup quarantine duration",
  );
  return serializable(database, async (tx) => {
    const attempt = await tx.grantReportExportAttempt.findUnique({
      where: { id: input.attemptId },
      select: { id: true, status: true, generationToken: true, attemptNumber: true, stagedFileAssetId: true, artifact: { select: { id: true, status: true, latestAttemptNumber: true } } },
    });
    if (!attempt || attempt.status !== "GENERATING" || attempt.generationToken !== input.generationToken || attempt.attemptNumber !== input.attemptNumber || attempt.attemptNumber !== attempt.artifact.latestAttemptNumber || attempt.artifact.status === "COMPLETED") {
      return { kind: "stale" as const };
    }
    const failed = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      WITH "databaseClock" AS MATERIALIZED (
        SELECT date_trunc('milliseconds', timezone('UTC', clock_timestamp())) AS "now"
      )
      UPDATE "GrantReportExportAttempt" AS "attempt"
      SET
        "status" = 'FAILED',
        "finishedAt" = "databaseClock"."now",
        "failureCode" = ${input.failureCode},
        "cleanupEligibleAt" = CASE
          WHEN "attempt"."stagedFileAssetId" IS NOT NULL
            THEN "databaseClock"."now" + (${quarantineMilliseconds} * interval '1 millisecond')
          ELSE NULL
        END,
        "updatedAt" = "databaseClock"."now"
      FROM "databaseClock", "GrantReportExportArtifact" AS "artifact"
      WHERE "attempt"."id" = ${attempt.id}
        AND "attempt"."artifactId" = "artifact"."id"
        AND "attempt"."status" = 'GENERATING'
        AND "attempt"."generationToken" = ${input.generationToken}
        AND "attempt"."attemptNumber" = ${input.attemptNumber}
        AND "artifact"."status" = 'GENERATING'
        AND "artifact"."latestAttemptNumber" = "attempt"."attemptNumber"
        AND "attempt"."leaseExpiresAt" > "databaseClock"."now"
      RETURNING "attempt"."id"
    `);
    if (failed.length !== 1) return { kind: "stale" as const };
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
  const token = options.token ?? createLifecycleToken;
  const leaseMilliseconds = requirePositiveDuration(
    options.cleanupLeaseMilliseconds ?? grantReportExportLifecycleDefaults.cleanupLeaseMilliseconds,
    "cleanup lease duration",
  );
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
      || attempt.cleanedAt
    ) {
      throw new GrantReportExportLifecycleError("CLEANUP_NOT_AVAILABLE", "The export attempt is not eligible for cleanup.");
    }
    const cleanupToken = token();
    const claimed = await tx.$queryRaw<Array<{ cleanupLeaseExpiresAt: Date }>>(Prisma.sql`
      WITH "databaseClock" AS MATERIALIZED (
        SELECT date_trunc('milliseconds', timezone('UTC', clock_timestamp())) AS "now"
      )
      UPDATE "GrantReportExportAttempt" AS "attempt"
      SET
        "cleanupToken" = ${cleanupToken},
        "cleanupLeaseExpiresAt" = "databaseClock"."now" + (${leaseMilliseconds} * interval '1 millisecond'),
        "updatedAt" = "databaseClock"."now"
      FROM "databaseClock"
      WHERE "attempt"."id" = ${attempt.id}
        AND "attempt"."status" IN ('FAILED', 'ABANDONED')
        AND "attempt"."stagedFileAssetId" = ${attempt.stagedFileAssetId}
        AND "attempt"."cleanedAt" IS NULL
        AND "attempt"."cleanupEligibleAt" <= "databaseClock"."now"
        AND (
          "attempt"."cleanupToken" IS NULL
          OR "attempt"."cleanupLeaseExpiresAt" <= "databaseClock"."now"
        )
      RETURNING "attempt"."cleanupLeaseExpiresAt"
    `);
    if (claimed.length !== 1 || !(claimed[0].cleanupLeaseExpiresAt instanceof Date)) {
      throw new GrantReportExportLifecycleError("CLEANUP_NOT_AVAILABLE", "The export attempt cleanup was claimed concurrently.");
    }
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
      || attempt.stagedFileAssetId !== input.fileAssetId
    ) {
      throw new GrantReportExportLifecycleError("CLEANUP_NOT_AVAILABLE", "The export cleanup claim is no longer current.");
    }
    const completed = await tx.$queryRaw<Array<{ cleanedAt: Date }>>(Prisma.sql`
      WITH "databaseClock" AS MATERIALIZED (
        SELECT date_trunc('milliseconds', timezone('UTC', clock_timestamp())) AS "now"
      )
      UPDATE "GrantReportExportAttempt" AS "attempt"
      SET
        "stagedFileAssetId" = NULL,
        "cleanupToken" = NULL,
        "cleanupLeaseExpiresAt" = NULL,
        "cleanedAt" = "databaseClock"."now",
        "updatedAt" = "databaseClock"."now"
      FROM "databaseClock"
      WHERE "attempt"."id" = ${input.attemptId}
        AND "attempt"."status" IN ('FAILED', 'ABANDONED')
        AND "attempt"."cleanupToken" = ${input.cleanupToken}
        AND "attempt"."stagedFileAssetId" = ${input.fileAssetId}
        AND "attempt"."cleanedAt" IS NULL
        AND "attempt"."cleanupLeaseExpiresAt" > "databaseClock"."now"
      RETURNING "attempt"."cleanedAt"
    `);
    if (completed.length !== 1) {
      throw new GrantReportExportLifecycleError("CLEANUP_NOT_AVAILABLE", "The export cleanup claim is no longer current.");
    }
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

export async function renewGrantReportExportCleanupLease(
  input: GrantReportExportCleanupClaim,
  options: RepositoryOptions = {},
) {
  const database = options.database ?? prisma;
  const leaseMilliseconds = requirePositiveDuration(
    options.cleanupLeaseMilliseconds ?? grantReportExportLifecycleDefaults.cleanupLeaseMilliseconds,
    "cleanup lease duration",
  );
  return serializable(database, async (tx) => {
    const renewed = await tx.$queryRaw<Array<{ cleanupLeaseExpiresAt: Date }>>(Prisma.sql`
      WITH "databaseClock" AS MATERIALIZED (
        SELECT date_trunc('milliseconds', timezone('UTC', clock_timestamp())) AS "now"
      )
      UPDATE "GrantReportExportAttempt" AS "attempt"
      SET
        "cleanupLeaseExpiresAt" = "databaseClock"."now" + (${leaseMilliseconds} * interval '1 millisecond'),
        "updatedAt" = "databaseClock"."now"
      FROM "databaseClock"
      WHERE "attempt"."id" = ${input.attemptId}
        AND "attempt"."attemptNumber" = ${input.attemptNumber}
        AND "attempt"."generationToken" = ${input.generationToken}
        AND "attempt"."status" IN ('FAILED', 'ABANDONED')
        AND "attempt"."cleanupToken" = ${input.cleanupToken}
        AND "attempt"."stagedFileAssetId" = ${input.fileAssetId}
        AND "attempt"."cleanedAt" IS NULL
        AND "attempt"."cleanupLeaseExpiresAt" > "databaseClock"."now"
      RETURNING "attempt"."cleanupLeaseExpiresAt"
    `);
    if (renewed.length !== 1 || !(renewed[0].cleanupLeaseExpiresAt instanceof Date)) {
      throw new GrantReportExportLifecycleError("CLEANUP_NOT_AVAILABLE", "The export cleanup claim is no longer current.");
    }
    return renewed[0].cleanupLeaseExpiresAt;
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
