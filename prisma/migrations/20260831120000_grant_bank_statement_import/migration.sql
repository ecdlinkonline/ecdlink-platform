-- CreateEnum
CREATE TYPE "GrantBankImportStatus" AS ENUM (
  'UPLOADING',
  'EXTRACTING',
  'NEEDS_REVIEW',
  'READY_FOR_CONFIRMATION',
  'CONFIRMED',
  'FAILED',
  'ARCHIVED'
);

CREATE TYPE "GrantBankStatementStatus" AS ENUM (
  'PENDING',
  'EXTRACTING',
  'EXTRACTED',
  'NEEDS_REVIEW',
  'FAILED'
);

CREATE TYPE "GrantBankProcessingKind" AS ENUM ('EXTRACTION', 'CLASSIFICATION');
CREATE TYPE "GrantBankProcessingStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');
CREATE TYPE "GrantBankTransactionDirection" AS ENUM ('DEBIT', 'CREDIT');
CREATE TYPE "GrantBankTransactionType" AS ENUM (
  'INCOME',
  'EXPENSE',
  'TRANSFER',
  'REVERSAL_REFUND',
  'BANK_CHARGE',
  'UNKNOWN'
);
CREATE TYPE "GrantBankTransactionReviewStatus" AS ENUM ('UNREVIEWED', 'NEEDS_REVIEW', 'REVIEWED');
CREATE TYPE "GrantBankIssueSeverity" AS ENUM ('INFO', 'WARNING', 'BLOCKING');

-- CreateTable
CREATE TABLE "GrantBankImportBatch" (
  "id" TEXT NOT NULL,
  "grantAwardId" TEXT NOT NULL,
  "centreId" TEXT NOT NULL,
  "originatingGrantReportId" TEXT NOT NULL,
  "financialYear" TEXT NOT NULL,
  "quarter" INTEGER NOT NULL,
  "reportingPeriodStart" DATE NOT NULL,
  "reportingPeriodEnd" DATE NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'ZAR',
  "status" "GrantBankImportStatus" NOT NULL DEFAULT 'UPLOADING',
  "safeFailureCode" TEXT,
  "safeFailureSummary" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "confirmedByUserId" TEXT,
  "confirmedAt" TIMESTAMP(3),
  "archivedByUserId" TEXT,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GrantBankImportBatch_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GrantBankImportBatch_quarter_check" CHECK ("quarter" BETWEEN 1 AND 4),
  CONSTRAINT "GrantBankImportBatch_period_check" CHECK ("reportingPeriodEnd" >= "reportingPeriodStart"),
  CONSTRAINT "GrantBankImportBatch_confirmation_check" CHECK (
    ("confirmedByUserId" IS NULL AND "confirmedAt" IS NULL) OR
    ("confirmedByUserId" IS NOT NULL AND "confirmedAt" IS NOT NULL)
  ),
  CONSTRAINT "GrantBankImportBatch_archive_check" CHECK (
    ("archivedByUserId" IS NULL AND "archivedAt" IS NULL) OR
    ("archivedByUserId" IS NOT NULL AND "archivedAt" IS NOT NULL)
  )
);

CREATE TABLE "GrantBankStatement" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "fileAssetId" TEXT NOT NULL,
  "bankName" TEXT,
  "accountHolderName" TEXT,
  "maskedAccountReference" TEXT,
  "accountFingerprint" TEXT,
  "statementNumber" TEXT,
  "statementMonth" DATE,
  "periodStart" DATE,
  "periodEnd" DATE,
  "statementDate" DATE,
  "openingBalance" DECIMAL(14,2),
  "closingBalance" DECIMAL(14,2),
  "serviceFees" DECIMAL(14,2),
  "otherBankCharges" DECIMAL(14,2),
  "currency" TEXT,
  "extractionStatus" "GrantBankStatementStatus" NOT NULL DEFAULT 'PENDING',
  "extractionConfidence" DECIMAL(5,4),
  "extractionStartedAt" TIMESTAMP(3),
  "extractionCompletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GrantBankStatement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GrantBankStatement_period_check" CHECK (
    "periodStart" IS NULL OR "periodEnd" IS NULL OR "periodEnd" >= "periodStart"
  ),
  CONSTRAINT "GrantBankStatement_confidence_check" CHECK (
    "extractionConfidence" IS NULL OR "extractionConfidence" BETWEEN 0 AND 1
  ),
  CONSTRAINT "GrantBankStatement_charges_check" CHECK (
    ("serviceFees" IS NULL OR "serviceFees" >= 0) AND
    ("otherBankCharges" IS NULL OR "otherBankCharges" >= 0)
  ),
  CONSTRAINT "GrantBankStatement_extraction_time_check" CHECK (
    "extractionCompletedAt" IS NULL OR
    ("extractionStartedAt" IS NOT NULL AND "extractionCompletedAt" >= "extractionStartedAt")
  )
);

CREATE TABLE "GrantBankTransaction" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "statementId" TEXT NOT NULL,
  "transactionDate" DATE NOT NULL,
  "originalDescription" TEXT NOT NULL,
  "originalAmount" DECIMAL(14,2) NOT NULL,
  "direction" "GrantBankTransactionDirection" NOT NULL,
  "runningBalance" DECIMAL(14,2),
  "bankCharge" DECIMAL(14,2),
  "sourcePage" INTEGER,
  "sourceRow" INTEGER,
  "sourceReference" TEXT,
  "extractionConfidence" DECIMAL(5,4),
  "transactionFingerprint" TEXT NOT NULL,
  "suggestedType" "GrantBankTransactionType",
  "suggestedCategory" TEXT,
  "suggestedConfidence" DECIMAL(5,4),
  "confirmedType" "GrantBankTransactionType",
  "confirmedCategory" TEXT,
  "correctedDescription" TEXT,
  "reviewStatus" "GrantBankTransactionReviewStatus" NOT NULL DEFAULT 'UNREVIEWED',
  "notes" TEXT,
  "excludedFromReporting" BOOLEAN NOT NULL DEFAULT false,
  "exclusionReason" TEXT,
  "suspectedDuplicateOfTransactionId" TEXT,
  "reviewedByUserId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GrantBankTransaction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GrantBankTransaction_amount_check" CHECK ("originalAmount" >= 0),
  CONSTRAINT "GrantBankTransaction_bank_charge_check" CHECK ("bankCharge" IS NULL OR "bankCharge" >= 0),
  CONSTRAINT "GrantBankTransaction_confidence_check" CHECK (
    ("extractionConfidence" IS NULL OR "extractionConfidence" BETWEEN 0 AND 1) AND
    ("suggestedConfidence" IS NULL OR "suggestedConfidence" BETWEEN 0 AND 1)
  ),
  CONSTRAINT "GrantBankTransaction_source_position_check" CHECK (
    ("sourcePage" IS NULL OR "sourcePage" > 0) AND
    ("sourceRow" IS NULL OR "sourceRow" > 0)
  ),
  CONSTRAINT "GrantBankTransaction_fingerprint_check" CHECK (NULLIF(BTRIM("transactionFingerprint"), '') IS NOT NULL),
  CONSTRAINT "GrantBankTransaction_exclusion_check" CHECK (
    NOT "excludedFromReporting" OR NULLIF(BTRIM("exclusionReason"), '') IS NOT NULL
  ),
  CONSTRAINT "GrantBankTransaction_reviewer_check" CHECK (
    ("reviewedByUserId" IS NULL AND "reviewedAt" IS NULL) OR
    ("reviewedByUserId" IS NOT NULL AND "reviewedAt" IS NOT NULL)
  ),
  CONSTRAINT "GrantBankTransaction_duplicate_self_check" CHECK (
    "suspectedDuplicateOfTransactionId" IS NULL OR "suspectedDuplicateOfTransactionId" <> "id"
  )
);

CREATE TABLE "GrantBankImportIssue" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "statementId" TEXT,
  "relatedStatementId" TEXT,
  "transactionId" TEXT,
  "severity" "GrantBankIssueSeverity" NOT NULL,
  "issueCode" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "resolved" BOOLEAN NOT NULL DEFAULT false,
  "resolvedByUserId" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "resolutionNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GrantBankImportIssue_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GrantBankImportIssue_code_check" CHECK (NULLIF(BTRIM("issueCode"), '') IS NOT NULL),
  CONSTRAINT "GrantBankImportIssue_message_check" CHECK (NULLIF(BTRIM("message"), '') IS NOT NULL),
  CONSTRAINT "GrantBankImportIssue_resolution_check" CHECK (
    (NOT "resolved" AND "resolvedByUserId" IS NULL AND "resolvedAt" IS NULL) OR
    ("resolved" AND "resolvedByUserId" IS NOT NULL AND "resolvedAt" IS NOT NULL)
  )
);

CREATE TABLE "GrantBankProcessingAttempt" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "statementId" TEXT,
  "kind" "GrantBankProcessingKind" NOT NULL,
  "providerName" TEXT,
  "providerVersion" TEXT,
  "attemptNumber" INTEGER NOT NULL,
  "status" "GrantBankProcessingStatus" NOT NULL DEFAULT 'PENDING',
  "safeFailureCode" TEXT,
  "safeFailureSummary" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GrantBankProcessingAttempt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GrantBankProcessingAttempt_number_check" CHECK ("attemptNumber" > 0),
  CONSTRAINT "GrantBankProcessingAttempt_time_check" CHECK (
    "completedAt" IS NULL OR "completedAt" >= "startedAt"
  ),
  CONSTRAINT "GrantBankProcessingAttempt_status_time_check" CHECK (
    ("status" IN ('PENDING', 'RUNNING') AND "completedAt" IS NULL) OR
    ("status" IN ('SUCCEEDED', 'FAILED') AND "completedAt" IS NOT NULL)
  )
);

CREATE TABLE "GrantReportBankTransactionSource" (
  "id" TEXT NOT NULL,
  "grantReportVersionId" TEXT NOT NULL,
  "grantReportFinancialLineId" TEXT NOT NULL,
  "grantBankTransactionId" TEXT NOT NULL,
  "appliedAmount" DECIMAL(14,2) NOT NULL,
  "transactionTypeSnapshot" "GrantBankTransactionType" NOT NULL,
  "categorySnapshot" TEXT NOT NULL,
  "descriptionSnapshot" TEXT NOT NULL,
  "appliedByUserId" TEXT NOT NULL,
  "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GrantReportBankTransactionSource_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GrantReportBankSource_amount_check" CHECK ("appliedAmount" > 0),
  CONSTRAINT "GrantReportBankSource_category_check" CHECK (NULLIF(BTRIM("categorySnapshot"), '') IS NOT NULL),
  CONSTRAINT "GrantReportBankSource_description_check" CHECK (NULLIF(BTRIM("descriptionSnapshot"), '') IS NOT NULL)
);

-- CreateIndex
CREATE INDEX "GrantBankImport_award_period_status_idx"
  ON "GrantBankImportBatch"("grantAwardId", "financialYear", "quarter", "status");
CREATE INDEX "GrantBankImport_centre_status_idx"
  ON "GrantBankImportBatch"("centreId", "status");
CREATE INDEX "GrantBankImport_report_status_idx"
  ON "GrantBankImportBatch"("originatingGrantReportId", "status");
CREATE UNIQUE INDEX "GrantBankImport_one_confirmed_period_key"
  ON "GrantBankImportBatch"("grantAwardId", "financialYear", "quarter")
  WHERE "status" = 'CONFIRMED';

CREATE UNIQUE INDEX "GrantBankStatement_file_key" ON "GrantBankStatement"("fileAssetId");
CREATE INDEX "GrantBankStatement_batch_period_idx"
  ON "GrantBankStatement"("batchId", "periodStart", "periodEnd");
CREATE INDEX "GrantBankStatement_batch_status_idx"
  ON "GrantBankStatement"("batchId", "extractionStatus");

CREATE INDEX "GrantBankTransaction_batch_review_idx"
  ON "GrantBankTransaction"("batchId", "reviewStatus");
CREATE INDEX "GrantBankTransaction_batch_date_idx"
  ON "GrantBankTransaction"("batchId", "transactionDate");
CREATE INDEX "GrantBankTransaction_statement_date_idx"
  ON "GrantBankTransaction"("statementId", "transactionDate");
CREATE INDEX "GrantBankTransaction_fingerprint_idx"
  ON "GrantBankTransaction"("transactionFingerprint");
CREATE INDEX "GrantBankTransaction_duplicate_idx"
  ON "GrantBankTransaction"("suspectedDuplicateOfTransactionId");

CREATE INDEX "GrantBankImportIssue_unresolved_idx"
  ON "GrantBankImportIssue"("batchId", "resolved", "severity");
CREATE INDEX "GrantBankImportIssue_statement_idx" ON "GrantBankImportIssue"("statementId");
CREATE INDEX "GrantBankImportIssue_related_statement_idx" ON "GrantBankImportIssue"("relatedStatementId");
CREATE INDEX "GrantBankImportIssue_transaction_idx" ON "GrantBankImportIssue"("transactionId");

CREATE INDEX "GrantBankProcessing_batch_kind_status_idx"
  ON "GrantBankProcessingAttempt"("batchId", "kind", "status");
CREATE INDEX "GrantBankProcessing_statement_attempt_idx"
  ON "GrantBankProcessingAttempt"("statementId", "kind", "attemptNumber");

CREATE UNIQUE INDEX "GrantReportBankSource_version_transaction_key"
  ON "GrantReportBankTransactionSource"("grantReportVersionId", "grantBankTransactionId");
CREATE INDEX "GrantReportBankSource_line_idx"
  ON "GrantReportBankTransactionSource"("grantReportFinancialLineId");
CREATE INDEX "GrantReportBankSource_transaction_idx"
  ON "GrantReportBankTransactionSource"("grantBankTransactionId");

-- AddForeignKey
ALTER TABLE "GrantBankImportBatch" ADD CONSTRAINT "GrantBankImportBatch_award_fkey"
  FOREIGN KEY ("grantAwardId") REFERENCES "GrantAward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrantBankImportBatch" ADD CONSTRAINT "GrantBankImportBatch_centre_fkey"
  FOREIGN KEY ("centreId") REFERENCES "EcdCentre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrantBankImportBatch" ADD CONSTRAINT "GrantBankImportBatch_report_fkey"
  FOREIGN KEY ("originatingGrantReportId") REFERENCES "GrantReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrantBankImportBatch" ADD CONSTRAINT "GrantBankImportBatch_creator_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrantBankImportBatch" ADD CONSTRAINT "GrantBankImportBatch_confirmer_fkey"
  FOREIGN KEY ("confirmedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrantBankImportBatch" ADD CONSTRAINT "GrantBankImportBatch_archiver_fkey"
  FOREIGN KEY ("archivedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GrantBankStatement" ADD CONSTRAINT "GrantBankStatement_batch_fkey"
  FOREIGN KEY ("batchId") REFERENCES "GrantBankImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrantBankStatement" ADD CONSTRAINT "GrantBankStatement_file_fkey"
  FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GrantBankTransaction" ADD CONSTRAINT "GrantBankTransaction_batch_fkey"
  FOREIGN KEY ("batchId") REFERENCES "GrantBankImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrantBankTransaction" ADD CONSTRAINT "GrantBankTransaction_statement_fkey"
  FOREIGN KEY ("statementId") REFERENCES "GrantBankStatement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrantBankTransaction" ADD CONSTRAINT "GrantBankTransaction_duplicate_fkey"
  FOREIGN KEY ("suspectedDuplicateOfTransactionId") REFERENCES "GrantBankTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrantBankTransaction" ADD CONSTRAINT "GrantBankTransaction_reviewer_fkey"
  FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GrantBankImportIssue" ADD CONSTRAINT "GrantBankImportIssue_batch_fkey"
  FOREIGN KEY ("batchId") REFERENCES "GrantBankImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrantBankImportIssue" ADD CONSTRAINT "GrantBankImportIssue_statement_fkey"
  FOREIGN KEY ("statementId") REFERENCES "GrantBankStatement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrantBankImportIssue" ADD CONSTRAINT "GrantBankImportIssue_related_statement_fkey"
  FOREIGN KEY ("relatedStatementId") REFERENCES "GrantBankStatement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrantBankImportIssue" ADD CONSTRAINT "GrantBankImportIssue_transaction_fkey"
  FOREIGN KEY ("transactionId") REFERENCES "GrantBankTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrantBankImportIssue" ADD CONSTRAINT "GrantBankImportIssue_resolver_fkey"
  FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GrantBankProcessingAttempt" ADD CONSTRAINT "GrantBankProcessingAttempt_batch_fkey"
  FOREIGN KEY ("batchId") REFERENCES "GrantBankImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrantBankProcessingAttempt" ADD CONSTRAINT "GrantBankProcessingAttempt_statement_fkey"
  FOREIGN KEY ("statementId") REFERENCES "GrantBankStatement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GrantReportBankTransactionSource" ADD CONSTRAINT "GrantReportBankSource_version_fkey"
  FOREIGN KEY ("grantReportVersionId") REFERENCES "GrantReportVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrantReportBankTransactionSource" ADD CONSTRAINT "GrantReportBankSource_line_fkey"
  FOREIGN KEY ("grantReportFinancialLineId") REFERENCES "GrantReportFinancialLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrantReportBankTransactionSource" ADD CONSTRAINT "GrantReportBankSource_transaction_fkey"
  FOREIGN KEY ("grantBankTransactionId") REFERENCES "GrantBankTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrantReportBankTransactionSource" ADD CONSTRAINT "GrantReportBankSource_actor_fkey"
  FOREIGN KEY ("appliedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
