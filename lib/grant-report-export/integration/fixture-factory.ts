import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";

type FixtureDatabase = PrismaClient | Prisma.TransactionClient;

export type GrantReportExportFixture = {
  prefix: string;
  adminUserId: string;
  centreId: string;
  fundingProfileId: string;
  fundingProjectId: string;
  awardId: string;
  obligationId: string;
  reportId: string;
  versionId: string;
};

function stableFragment(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 20);
}

export function createFixtureIds(testId: string): GrantReportExportFixture {
  const prefix = `it_${stableFragment(testId)}`;
  return {
    prefix,
    adminUserId: `${prefix}_admin`,
    centreId: `${prefix}_centre`,
    fundingProfileId: `${prefix}_profile`,
    fundingProjectId: `${prefix}_project`,
    awardId: `${prefix}_award`,
    obligationId: `${prefix}_obligation`,
    reportId: `${prefix}_report`,
    versionId: `${prefix}_version`,
  };
}

export async function createSubmittedReportFixture(database: FixtureDatabase, testId: string) {
  const fixture = createFixtureIds(testId);
  const submittedAt = new Date("2026-10-01T08:00:00.000Z");
  await database.user.create({
    data: {
      id: fixture.adminUserId,
      clerkUserId: `${fixture.prefix}_clerk`,
      email: `${fixture.prefix}@integration.invalid`,
      firstName: "Integration",
      lastName: "Administrator",
      role: "SUPER_ADMIN",
      status: "ACTIVE",
    },
  });
  await database.ecdCentre.create({ data: { id: fixture.centreId, centreName: `Integration Centre ${fixture.prefix}`, slug: fixture.prefix } });
  await database.fundingProfile.create({ data: { id: fixture.fundingProfileId, centreId: fixture.centreId } });
  await database.fundingProject.create({
    data: {
      id: fixture.fundingProjectId,
      fundingProfileId: fixture.fundingProfileId,
      title: `Integration Project ${fixture.prefix}`,
      requestedAmount: "1000.00",
      status: "APPROVED",
    },
  });
  await database.grantAward.create({
    data: {
      id: fixture.awardId,
      centreId: fixture.centreId,
      fundingProjectId: fixture.fundingProjectId,
      sourceType: "MANUAL",
      awardNumber: `IT-${stableFragment(`${testId}:award`)}`,
      title: `Integration Award ${fixture.prefix}`,
      awardedAmount: "1000.00",
      startDate: new Date("2026-04-01T00:00:00.000Z"),
      endDate: new Date("2027-03-31T00:00:00.000Z"),
      status: "ACTIVE",
      confirmedByUserId: fixture.adminUserId,
      confirmedAt: submittedAt,
    },
  });
  await database.grantReportingObligation.create({
    data: {
      id: fixture.obligationId,
      grantAwardId: fixture.awardId,
      type: "QUARTERLY_CASH_FLOW",
      basis: "QUARTER",
      title: "Integration Q1 Cash Flow",
      reportingPeriodStart: new Date("2026-04-01T00:00:00.000Z"),
      reportingPeriodEnd: new Date("2026-06-30T00:00:00.000Z"),
      financialYear: "2026",
      quarter: 1,
      dueAt: new Date("2026-07-07T00:00:00.000Z"),
      status: "SUBMITTED",
      createdByUserId: fixture.adminUserId,
    },
  });
  await database.grantReport.create({
    data: {
      id: fixture.reportId,
      grantAwardId: fixture.awardId,
      obligationId: fixture.obligationId,
      status: "SUBMITTED",
      currentVersionNumber: 1,
      createdByUserId: fixture.adminUserId,
    },
  });
  await database.grantReportVersion.create({
    data: {
      id: fixture.versionId,
      grantReportId: fixture.reportId,
      versionNumber: 1,
      status: "SUBMITTED",
      reportType: "QUARTERLY_CASH_FLOW",
      reportingPeriodStart: new Date("2026-04-01T00:00:00.000Z"),
      reportingPeriodEnd: new Date("2026-06-30T00:00:00.000Z"),
      financialYear: "2026",
      quarter: 1,
      preparedByUserId: fixture.adminUserId,
      preparerNameSnapshot: "Integration Administrator",
      preparerDesignationSnapshot: "Super Administrator",
      certificationAcknowledged: true,
      submittedByUserId: fixture.adminUserId,
      submittedAt,
    },
  });
  return fixture;
}

export async function createGeneratingArtifactFixture(database: FixtureDatabase, fixture: GrantReportExportFixture, suffix = "artifact") {
  const artifactId = `${fixture.prefix}_${suffix}`;
  await database.grantReportExportArtifact.create({
    data: {
      id: artifactId,
      grantReportId: fixture.reportId,
      grantReportVersionId: fixture.versionId,
      format: "SUBMISSION_PACK_ZIP",
      status: "GENERATING",
      integrityStatus: "PENDING",
      latestAttemptNumber: 0,
    },
  });
  return artifactId;
}

export async function createGenerationAttemptFixture(
  database: FixtureDatabase,
  fixture: GrantReportExportFixture,
  artifactId: string,
  input: { attemptNumber?: number; leaseExpiresAt?: Date; generationToken?: string } = {},
) {
  const attemptNumber = input.attemptNumber ?? 1;
  const attemptId = `${artifactId}_attempt_${attemptNumber}`;
  const generationToken = input.generationToken ?? stableFragment(`${attemptId}:token`).padEnd(64, "0");
  const startedAt = new Date("2026-10-01T09:00:00.000Z");
  await database.grantReportExportArtifact.update({ where: { id: artifactId }, data: { latestAttemptNumber: attemptNumber } });
  await database.grantReportExportAttempt.create({
    data: {
      id: attemptId,
      artifactId,
      attemptNumber,
      generationToken,
      status: "GENERATING",
      startedByUserId: fixture.adminUserId,
      startedAt,
      leaseExpiresAt: input.leaseExpiresAt ?? new Date(startedAt.getTime() + 5 * 60_000),
    },
  });
  return { attemptId, attemptNumber, generationToken, startedAt };
}

export async function createQueuedExportRequestFixture(
  database: FixtureDatabase,
  fixture: GrantReportExportFixture,
  suffix = "request",
  input: { dispatchAttemptCount?: number; nextDispatchAt?: Date } = {},
) {
  const requestId = `${fixture.prefix}_${suffix}`;
  await database.grantReportExportRequest.create({
    data: {
      id: requestId,
      grantReportId: fixture.reportId,
      grantReportVersionId: fixture.versionId,
      format: "SUBMISSION_PACK_ZIP",
      requestedByUserId: fixture.adminUserId,
      status: "QUEUED",
      idempotencyKey: stableFragment(`${requestId}:idempotency`).padEnd(64, "0"),
      dispatchAttemptCount: input.dispatchAttemptCount ?? 0,
      nextDispatchAt: input.nextDispatchAt ?? new Date("2026-10-01T09:00:00.000Z"),
    },
  });
  return requestId;
}

export async function createAuditFixture(database: FixtureDatabase, fixture: GrantReportExportFixture, action: string, entityId: string) {
  return database.auditLog.create({
    data: {
      id: `${fixture.prefix}_audit_${stableFragment(`${action}:${entityId}`)}`,
      actorUserId: fixture.adminUserId,
      action,
      entityType: "GrantReportExportIntegrationFixture",
      entityId,
      metadata: { fixture: fixture.prefix },
    },
  });
}
