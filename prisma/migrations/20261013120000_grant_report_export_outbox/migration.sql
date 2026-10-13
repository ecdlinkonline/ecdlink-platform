-- CreateEnum
CREATE TYPE "GrantReportExportRequestStatus" AS ENUM (
  'QUEUED',
  'DISPATCHING',
  'DISPATCHED',
  'COMPLETED',
  'FAILED'
);

-- The composite key makes an artifact reference prove report, version, and
-- format ownership rather than trusting an artifact ID in isolation.
CREATE UNIQUE INDEX "GrantReportExportArtifact_ownership_key"
  ON "GrantReportExportArtifact"("id", "grantReportVersionId", "grantReportId", "format");

-- CreateTable
CREATE TABLE "GrantReportExportRequest" (
  "id" TEXT NOT NULL,
  "grantReportId" TEXT NOT NULL,
  "grantReportVersionId" TEXT NOT NULL,
  "format" "GrantReportExportFormat" NOT NULL,
  "requestedByUserId" TEXT NOT NULL,
  "status" "GrantReportExportRequestStatus" NOT NULL DEFAULT 'QUEUED',
  "idempotencyKey" CHAR(64) NOT NULL,
  "dispatchAttemptCount" INTEGER NOT NULL DEFAULT 0,
  "nextDispatchAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dispatchToken" CHAR(64),
  "dispatchLeaseExpiresAt" TIMESTAMP(3),
  "queueMessageId" VARCHAR(255),
  "dispatchedAt" TIMESTAMP(3),
  "lastSafeFailureCode" VARCHAR(64),
  "artifactId" TEXT,
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "GrantReportExportRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GrantReportExportRequest_dispatch_attempt_check"
    CHECK ("dispatchAttemptCount" >= 0),
  CONSTRAINT "GrantReportExportRequest_idempotency_key_check"
    CHECK ("idempotencyKey" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "GrantReportExportRequest_dispatch_token_check"
    CHECK ("dispatchToken" IS NULL OR "dispatchToken" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "GrantReportExportRequest_failure_code_check"
    CHECK (
      "lastSafeFailureCode" IS NULL
      OR "lastSafeFailureCode" ~ '^[A-Z][A-Z0-9_]{0,63}$'
    ),
  CONSTRAINT "GrantReportExportRequest_timestamp_check"
    CHECK (
      ("dispatchedAt" IS NULL OR "dispatchedAt" >= "createdAt")
      AND ("completedAt" IS NULL OR "completedAt" >= "createdAt")
      AND ("failedAt" IS NULL OR "failedAt" >= "createdAt")
    ),
  CONSTRAINT "GrantReportExportRequest_state_check"
    CHECK (
      (
        "status" = 'QUEUED'
        AND "dispatchToken" IS NULL
        AND "dispatchLeaseExpiresAt" IS NULL
        AND "queueMessageId" IS NULL
        AND "dispatchedAt" IS NULL
        AND "artifactId" IS NULL
        AND "completedAt" IS NULL
        AND "failedAt" IS NULL
      )
      OR (
        "status" = 'DISPATCHING'
        AND "dispatchAttemptCount" > 0
        AND "dispatchToken" IS NOT NULL
        AND "dispatchLeaseExpiresAt" IS NOT NULL
        AND "dispatchLeaseExpiresAt" > "createdAt"
        AND "queueMessageId" IS NULL
        AND "dispatchedAt" IS NULL
        AND "artifactId" IS NULL
        AND "completedAt" IS NULL
        AND "failedAt" IS NULL
      )
      OR (
        "status" = 'DISPATCHED'
        AND "dispatchAttemptCount" > 0
        AND "dispatchToken" IS NULL
        AND "dispatchLeaseExpiresAt" IS NULL
        AND "queueMessageId" IS NOT NULL
        AND "dispatchedAt" IS NOT NULL
        AND "completedAt" IS NULL
        AND "failedAt" IS NULL
      )
      OR (
        "status" = 'COMPLETED'
        AND "dispatchAttemptCount" > 0
        AND "dispatchToken" IS NULL
        AND "dispatchLeaseExpiresAt" IS NULL
        AND "queueMessageId" IS NOT NULL
        AND "dispatchedAt" IS NOT NULL
        AND "artifactId" IS NOT NULL
        AND "completedAt" IS NOT NULL
        AND "failedAt" IS NULL
        AND "lastSafeFailureCode" IS NULL
      )
      OR (
        "status" = 'FAILED'
        AND "dispatchToken" IS NULL
        AND "dispatchLeaseExpiresAt" IS NULL
        AND "completedAt" IS NULL
        AND "failedAt" IS NOT NULL
        AND "lastSafeFailureCode" IS NOT NULL
      )
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "GrantReportExportRequest_idempotencyKey_key"
  ON "GrantReportExportRequest"("idempotencyKey");

CREATE UNIQUE INDEX "GrantReportExportRequest_dispatchToken_key"
  ON "GrantReportExportRequest"("dispatchToken");

-- At most one logical export request may be queued or in flight for a version
-- and format. Terminal rows remain available as immutable operational history.
CREATE UNIQUE INDEX "GrantReportExportRequest_active_version_format_key"
  ON "GrantReportExportRequest"("grantReportVersionId", "format")
  WHERE "status" IN ('QUEUED', 'DISPATCHING', 'DISPATCHED');

CREATE INDEX "GrantReportExportRequest_status_next_dispatch_idx"
  ON "GrantReportExportRequest"("status", "nextDispatchAt");

CREATE INDEX "GrantReportExportRequest_status_dispatch_lease_idx"
  ON "GrantReportExportRequest"("status", "dispatchLeaseExpiresAt");

CREATE INDEX "GrantReportExportRequest_report_version_created_idx"
  ON "GrantReportExportRequest"("grantReportId", "grantReportVersionId", "createdAt");

CREATE INDEX "GrantReportExportRequest_requested_by_created_idx"
  ON "GrantReportExportRequest"("requestedByUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "GrantReportExportRequest"
  ADD CONSTRAINT "GrantReportExportRequest_version_fkey"
  FOREIGN KEY ("grantReportVersionId", "grantReportId")
  REFERENCES "GrantReportVersion"("id", "grantReportId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GrantReportExportRequest"
  ADD CONSTRAINT "GrantReportExportRequest_requested_by_fkey"
  FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GrantReportExportRequest"
  ADD CONSTRAINT "GrantReportExportRequest_artifact_fkey"
  FOREIGN KEY ("artifactId", "grantReportVersionId", "grantReportId", "format")
  REFERENCES "GrantReportExportArtifact"("id", "grantReportVersionId", "grantReportId", "format")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Identity fields never change. State transitions are deliberately narrow,
-- and durable request history cannot be deleted or terminal rows rewritten.
CREATE FUNCTION "protect_grant_report_export_request"()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Grant report export request history cannot be deleted';
  END IF;

  IF NEW."id" IS DISTINCT FROM OLD."id"
    OR NEW."grantReportId" IS DISTINCT FROM OLD."grantReportId"
    OR NEW."grantReportVersionId" IS DISTINCT FROM OLD."grantReportVersionId"
    OR NEW."format" IS DISTINCT FROM OLD."format"
    OR NEW."requestedByUserId" IS DISTINCT FROM OLD."requestedByUserId"
    OR NEW."idempotencyKey" IS DISTINCT FROM OLD."idempotencyKey"
    OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'Grant report export request ownership is immutable';
  END IF;

  IF OLD."status" IN ('COMPLETED', 'FAILED') THEN
    RAISE EXCEPTION 'Terminal grant report export requests are immutable';
  END IF;

  IF NEW."status" IS DISTINCT FROM OLD."status" AND NOT (
    (OLD."status" = 'QUEUED' AND NEW."status" = 'DISPATCHING')
    OR (OLD."status" = 'DISPATCHING' AND NEW."status" IN ('QUEUED', 'DISPATCHED', 'FAILED'))
    OR (OLD."status" = 'DISPATCHED' AND NEW."status" IN ('COMPLETED', 'FAILED'))
  ) THEN
    RAISE EXCEPTION 'Invalid grant report export request state transition';
  END IF;

  -- A dispatch claim consumes exactly one attempt. Heartbeats, publication,
  -- retry recovery, and terminal transitions preserve the claimed count.
  IF OLD."status" = 'QUEUED' AND NEW."status" = 'DISPATCHING' THEN
    IF NEW."dispatchAttemptCount" <> OLD."dispatchAttemptCount" + 1 THEN
      RAISE EXCEPTION 'Dispatch attempt count must increment exactly once when claimed';
    END IF;
  ELSIF NEW."dispatchAttemptCount" <> OLD."dispatchAttemptCount" THEN
    RAISE EXCEPTION 'Dispatch attempt count is immutable outside a new claim';
  END IF;

  -- A heartbeat may extend the existing claim lease, but it cannot rotate the
  -- token and thereby transfer ownership while the claim remains active.
  IF OLD."status" = 'DISPATCHING'
    AND NEW."status" = 'DISPATCHING'
    AND NEW."dispatchToken" IS DISTINCT FROM OLD."dispatchToken" THEN
    RAISE EXCEPTION 'Active dispatch claim token is immutable';
  END IF;

  -- Queue acceptance evidence becomes historical as soon as publication is
  -- recorded. Completion or failure must retain the exact accepted message.
  IF OLD."status" = 'DISPATCHED' AND (
    NEW."queueMessageId" IS DISTINCT FROM OLD."queueMessageId"
    OR NEW."dispatchedAt" IS DISTINCT FROM OLD."dispatchedAt"
    OR NEW."dispatchAttemptCount" IS DISTINCT FROM OLD."dispatchAttemptCount"
  ) THEN
    RAISE EXCEPTION 'Queue publication evidence is immutable';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "GrantReportExportRequest_integrity"
BEFORE UPDATE OR DELETE ON "GrantReportExportRequest"
FOR EACH ROW
EXECUTE FUNCTION "protect_grant_report_export_request"();
