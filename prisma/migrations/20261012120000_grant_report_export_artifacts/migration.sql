-- CreateEnum
CREATE TYPE "GrantReportExportFormat" AS ENUM ('SUBMISSION_PACK_ZIP');

CREATE TYPE "GrantReportExportStatus" AS ENUM ('GENERATING', 'COMPLETED', 'FAILED');

CREATE TYPE "GrantReportExportAttemptStatus" AS ENUM ('GENERATING', 'COMPLETED', 'FAILED', 'ABANDONED');

CREATE TYPE "GrantReportExportIntegrityStatus" AS ENUM ('PENDING', 'VERIFIED', 'UNAVAILABLE', 'CORRUPT');

-- Preserve exact report/version ownership for export artifacts.
CREATE UNIQUE INDEX "GrantReportVersion_id_grantReportId_key"
  ON "GrantReportVersion"("id", "grantReportId");

-- CreateTable
CREATE TABLE "GrantReportExportArtifact" (
  "id" TEXT NOT NULL,
  "grantReportId" TEXT NOT NULL,
  "grantReportVersionId" TEXT NOT NULL,
  "format" "GrantReportExportFormat" NOT NULL,
  "status" "GrantReportExportStatus" NOT NULL DEFAULT 'GENERATING',
  "integrityStatus" "GrantReportExportIntegrityStatus" NOT NULL DEFAULT 'PENDING',
  "latestAttemptNumber" INTEGER NOT NULL DEFAULT 0,
  "completedFileAssetId" TEXT,
  "sha256" CHAR(64),
  "byteSize" INTEGER,
  "manifestSchemaVersion" INTEGER,
  "storageObjectVersion" VARCHAR(255),
  "completedByUserId" TEXT,
  "completedAt" TIMESTAMP(3),
  "lastIntegrityVerifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "GrantReportExportArtifact_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GrantReportExportArtifact_attempt_number_check" CHECK ("latestAttemptNumber" >= 0),
  CONSTRAINT "GrantReportExportArtifact_sha256_check" CHECK (
    "sha256" IS NULL OR "sha256" ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT "GrantReportExportArtifact_byte_size_check" CHECK (
    "byteSize" IS NULL OR ("byteSize" > 0 AND "byteSize" <= 134217728)
  ),
  CONSTRAINT "GrantReportExportArtifact_manifest_check" CHECK (
    "manifestSchemaVersion" IS NULL OR "manifestSchemaVersion" > 0
  ),
  CONSTRAINT "GrantReportExportArtifact_completion_check" CHECK (
    (
      "status" = 'COMPLETED' AND
      "latestAttemptNumber" > 0 AND
      "completedFileAssetId" IS NOT NULL AND
      "sha256" IS NOT NULL AND
      "byteSize" IS NOT NULL AND
      "manifestSchemaVersion" IS NOT NULL AND
      "completedByUserId" IS NOT NULL AND
      "completedAt" IS NOT NULL AND
      "lastIntegrityVerifiedAt" IS NOT NULL AND
      "lastIntegrityVerifiedAt" >= "completedAt" AND
      "integrityStatus" IN ('VERIFIED', 'UNAVAILABLE', 'CORRUPT')
    ) OR (
      "status" <> 'COMPLETED' AND
      "completedFileAssetId" IS NULL AND
      "sha256" IS NULL AND
      "byteSize" IS NULL AND
      "manifestSchemaVersion" IS NULL AND
      "storageObjectVersion" IS NULL AND
      "completedByUserId" IS NULL AND
      "completedAt" IS NULL AND
      "lastIntegrityVerifiedAt" IS NULL AND
      "integrityStatus" = 'PENDING'
    )
  )
);

CREATE TABLE "GrantReportExportAttempt" (
  "id" TEXT NOT NULL,
  "artifactId" TEXT NOT NULL,
  "attemptNumber" INTEGER NOT NULL,
  "generationToken" VARCHAR(64) NOT NULL,
  "status" "GrantReportExportAttemptStatus" NOT NULL DEFAULT 'GENERATING',
  "stagedFileAssetId" TEXT,
  "expectedSha256" CHAR(64),
  "expectedByteSize" INTEGER,
  "manifestSchemaVersion" INTEGER,
  "startedByUserId" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseExpiresAt" TIMESTAMP(3) NOT NULL,
  "finishedAt" TIMESTAMP(3),
  "failureCode" VARCHAR(64),
  "cleanupEligibleAt" TIMESTAMP(3),
  "cleanupToken" VARCHAR(64),
  "cleanupLeaseExpiresAt" TIMESTAMP(3),
  "cleanedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "GrantReportExportAttempt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GrantReportExportAttempt_number_check" CHECK ("attemptNumber" > 0),
  CONSTRAINT "GrantReportExportAttempt_lease_check" CHECK ("leaseExpiresAt" > "startedAt"),
  CONSTRAINT "GrantReportExportAttempt_sha256_check" CHECK (
    "expectedSha256" IS NULL OR "expectedSha256" ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT "GrantReportExportAttempt_byte_size_check" CHECK (
    "expectedByteSize" IS NULL OR ("expectedByteSize" > 0 AND "expectedByteSize" <= 134217728)
  ),
  CONSTRAINT "GrantReportExportAttempt_manifest_check" CHECK (
    "manifestSchemaVersion" IS NULL OR "manifestSchemaVersion" > 0
  ),
  CONSTRAINT "GrantReportExportAttempt_failure_code_check" CHECK (
    "failureCode" IS NULL OR "failureCode" ~ '^[A-Z0-9_]{1,64}$'
  ),
  CONSTRAINT "GrantReportExportAttempt_status_time_check" CHECK (
    ("status" = 'GENERATING' AND "finishedAt" IS NULL AND "failureCode" IS NULL) OR
    ("status" = 'COMPLETED' AND "finishedAt" IS NOT NULL AND "failureCode" IS NULL) OR
    ("status" = 'FAILED' AND "finishedAt" IS NOT NULL AND "failureCode" IS NOT NULL) OR
    ("status" = 'ABANDONED' AND "finishedAt" IS NOT NULL)
  ),
  CONSTRAINT "GrantReportExportAttempt_completion_check" CHECK (
    "status" <> 'COMPLETED' OR (
      "stagedFileAssetId" IS NOT NULL AND
      "expectedSha256" IS NOT NULL AND
      "expectedByteSize" IS NOT NULL AND
      "manifestSchemaVersion" IS NOT NULL AND
      "cleanupEligibleAt" IS NULL AND
      "cleanupToken" IS NULL AND
      "cleanupLeaseExpiresAt" IS NULL AND
      "cleanedAt" IS NULL
    )
  ),
  CONSTRAINT "GrantReportExportAttempt_cleanup_token_check" CHECK (
    ("cleanupToken" IS NULL AND "cleanupLeaseExpiresAt" IS NULL) OR
    (
      "cleanupToken" IS NOT NULL AND
      "cleanupLeaseExpiresAt" IS NOT NULL AND
      "cleanupEligibleAt" IS NOT NULL AND "cleanupLeaseExpiresAt" > "cleanupEligibleAt" AND
      "cleanedAt" IS NULL AND
      "stagedFileAssetId" IS NOT NULL AND
      "status" IN ('FAILED', 'ABANDONED')
    )
  ),
  CONSTRAINT "GrantReportExportAttempt_cleanup_state_check" CHECK (
    (
      "cleanupEligibleAt" IS NULL AND
      "cleanupToken" IS NULL AND
      "cleanupLeaseExpiresAt" IS NULL AND
      "cleanedAt" IS NULL AND NOT ("status" IN ('FAILED', 'ABANDONED') AND "stagedFileAssetId" IS NOT NULL)
    ) OR (
      "status" IN ('FAILED', 'ABANDONED') AND
      "cleanupEligibleAt" IS NOT NULL AND
      "finishedAt" IS NOT NULL AND
      "cleanupEligibleAt" >= "finishedAt" AND
      (
        (
          "cleanedAt" IS NULL AND
          "stagedFileAssetId" IS NOT NULL
        ) OR (
          "cleanedAt" IS NOT NULL AND
          "cleanedAt" >= "cleanupEligibleAt" AND
          "stagedFileAssetId" IS NULL AND
          "cleanupToken" IS NULL AND
          "cleanupLeaseExpiresAt" IS NULL
        )
      )
    )
  )
);

-- CreateIndex
CREATE UNIQUE INDEX "GrantReportExportArtifact_completedFileAssetId_key"
  ON "GrantReportExportArtifact"("completedFileAssetId");
CREATE UNIQUE INDEX "GrantReportExportArtifact_version_format_key"
  ON "GrantReportExportArtifact"("grantReportVersionId", "format");
CREATE INDEX "GrantReportExportArtifact_report_version_idx"
  ON "GrantReportExportArtifact"("grantReportId", "grantReportVersionId");
CREATE INDEX "GrantReportExportArtifact_status_created_idx"
  ON "GrantReportExportArtifact"("status", "createdAt");

CREATE UNIQUE INDEX "GrantReportExportAttempt_generationToken_key"
  ON "GrantReportExportAttempt"("generationToken");
CREATE UNIQUE INDEX "GrantReportExportAttempt_stagedFileAssetId_key"
  ON "GrantReportExportAttempt"("stagedFileAssetId");
CREATE UNIQUE INDEX "GrantReportExportAttempt_cleanupToken_key"
  ON "GrantReportExportAttempt"("cleanupToken");
CREATE UNIQUE INDEX "GrantReportExportAttempt_artifact_number_key"
  ON "GrantReportExportAttempt"("artifactId", "attemptNumber");
CREATE INDEX "GrantReportExportAttempt_artifact_status_lease_idx"
  ON "GrantReportExportAttempt"("artifactId", "status", "leaseExpiresAt");
CREATE INDEX "GrantReportExportAttempt_status_lease_idx"
  ON "GrantReportExportAttempt"("status", "leaseExpiresAt");
CREATE INDEX "GrantReportExportAttempt_status_cleanup_idx"
  ON "GrantReportExportAttempt"("status", "cleanupEligibleAt");

-- AddForeignKey
ALTER TABLE "GrantReportExportArtifact"
  ADD CONSTRAINT "GrantReportExportArtifact_version_fkey"
  FOREIGN KEY ("grantReportVersionId", "grantReportId")
  REFERENCES "GrantReportVersion"("id", "grantReportId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GrantReportExportArtifact"
  ADD CONSTRAINT "GrantReportExportArtifact_completed_file_fkey"
  FOREIGN KEY ("completedFileAssetId") REFERENCES "FileAsset"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GrantReportExportArtifact"
  ADD CONSTRAINT "GrantReportExportArtifact_completed_by_fkey"
  FOREIGN KEY ("completedByUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GrantReportExportAttempt"
  ADD CONSTRAINT "GrantReportExportAttempt_artifact_fkey"
  FOREIGN KEY ("artifactId") REFERENCES "GrantReportExportArtifact"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GrantReportExportAttempt"
  ADD CONSTRAINT "GrantReportExportAttempt_staged_file_fkey"
  FOREIGN KEY ("stagedFileAssetId") REFERENCES "FileAsset"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GrantReportExportAttempt"
  ADD CONSTRAINT "GrantReportExportAttempt_started_by_fkey"
  FOREIGN KEY ("startedByUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Completed export artifacts retain immutable core identity and file metadata.
CREATE FUNCTION "prevent_completed_grant_report_export_artifact_change"()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" = 'COMPLETED' THEN
      RAISE EXCEPTION 'completed grant report export artifacts are immutable';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD."status" = 'COMPLETED' AND (
    (to_jsonb(NEW) - ARRAY['integrityStatus', 'lastIntegrityVerifiedAt', 'updatedAt'])
      IS DISTINCT FROM
    (to_jsonb(OLD) - ARRAY['integrityStatus', 'lastIntegrityVerifiedAt', 'updatedAt'])
  ) THEN
    RAISE EXCEPTION 'completed grant report export artifact core fields are immutable';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "GrantReportExportArtifact_completed_immutable"
BEFORE UPDATE OR DELETE ON "GrantReportExportArtifact"
FOR EACH ROW
EXECUTE FUNCTION "prevent_completed_grant_report_export_artifact_change"();

-- Completed attempts retain their exact storage ownership and generation evidence.
CREATE FUNCTION "prevent_completed_grant_report_export_attempt_change"()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."status" = 'COMPLETED' THEN
    RAISE EXCEPTION 'completed grant report export attempts are immutable';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "GrantReportExportAttempt_completed_immutable"
BEFORE UPDATE OR DELETE ON "GrantReportExportAttempt"
FOR EACH ROW
EXECUTE FUNCTION "prevent_completed_grant_report_export_attempt_change"();
