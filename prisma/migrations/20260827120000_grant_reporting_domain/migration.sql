-- CreateEnum
CREATE TYPE "GrantAwardStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'COMPLETED', 'CANCELLED', 'ARCHIVED');
CREATE TYPE "GrantAwardSourceType" AS ENUM ('FUNDING_APPLICATION', 'SPONSORSHIP_COMMITMENT', 'MANUAL');
CREATE TYPE "GrantAwardOrganisationType" AS ENUM ('FUNDING_ORGANISATION', 'DONOR_ORGANISATION');
CREATE TYPE "GrantAwardOrganisationRole" AS ENUM ('LEAD_FUNDER', 'CO_FUNDER', 'IMPLEMENTATION_PARTNER', 'OVERSIGHT_PARTNER');
CREATE TYPE "GrantAwardAccessRole" AS ENUM ('VIEWER', 'PREPARER', 'REVIEWER', 'APPROVER', 'ADMINISTRATOR');
CREATE TYPE "GrantAwardPermission" AS ENUM ('REPORT_READ', 'REPORT_PREPARE', 'REPORT_SUBMIT', 'REPORT_REVIEW', 'REPORT_RETURN', 'REPORT_APPROVE', 'DOCUMENT_READ', 'DOCUMENT_UPLOAD', 'FINANCIAL_READ');
CREATE TYPE "GrantObligationType" AS ENUM ('INTERIM', 'FINAL', 'QUARTERLY_EXPENDITURE', 'QUARTERLY_CASH_FLOW', 'CUSTOM');
CREATE TYPE "GrantObligationBasis" AS ENUM ('QUARTER', 'TRANCHE', 'PERIOD', 'FINAL', 'CUSTOM');
CREATE TYPE "GrantObligationStatus" AS ENUM ('PENDING', 'OPEN', 'SUBMITTED', 'OVERDUE', 'SATISFIED', 'WAIVED', 'CANCELLED', 'ARCHIVED');
CREATE TYPE "GrantReportStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'RETURNED', 'APPROVED', 'ARCHIVED');
CREATE TYPE "GrantReportVersionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'RETURNED', 'APPROVED', 'SUPERSEDED', 'ARCHIVED');
CREATE TYPE "GrantFinancialLineType" AS ENUM ('FUNDING_RECEIVED', 'OTHER_INCOME', 'EXPENDITURE', 'BUDGET', 'BALANCE', 'ADJUSTMENT');
CREATE TYPE "GrantIndicatorStatus" AS ENUM ('NOT_STARTED', 'ON_TRACK', 'AT_RISK', 'DELAYED', 'COMPLETED', 'NOT_APPLICABLE');
CREATE TYPE "GrantReportDocumentType" AS ENUM ('INVOICE', 'BANK_STATEMENT', 'PROOF_OF_PAYMENT', 'RECEIPT', 'PROCUREMENT_EVIDENCE', 'INDICATOR_EVIDENCE', 'BENEFICIARY_EVIDENCE', 'SIGNED_REPORT', 'OTHER');
CREATE TYPE "GrantReviewDecision" AS ENUM ('COMMENT', 'RETURNED', 'APPROVED');
CREATE TYPE "GrantReviewStage" AS ENUM ('FUNDER', 'SUPER_ADMIN', 'OTHER');
CREATE TYPE "GrantExpenseSourceType" AS ENUM ('PROCUREMENT_ORDER_ITEM', 'PROCUREMENT_INVOICE', 'SUPPLIER_INVOICE', 'MANUAL');
CREATE TYPE "FundingOrganisationUserRole" AS ENUM ('MEMBER', 'REVIEWER', 'APPROVER', 'ADMINISTRATOR');
CREATE TYPE "FundingOrganisationUserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REMOVED');

-- AlterTable: safe defaults preserve all existing FundingOrganisationUser rows.
ALTER TABLE "FundingOrganisationUser"
  ADD COLUMN "role" "FundingOrganisationUserRole" NOT NULL DEFAULT 'MEMBER',
  ADD COLUMN "status" "FundingOrganisationUserStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "permissions" "GrantAwardPermission"[] NOT NULL DEFAULT ARRAY[]::"GrantAwardPermission"[],
  ADD COLUMN "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "removedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "GrantAward" (
  "id" TEXT NOT NULL,
  "centreId" TEXT NOT NULL,
  "fundingProjectId" TEXT NOT NULL,
  "sourceType" "GrantAwardSourceType" NOT NULL,
  "fundingApplicationId" TEXT,
  "sponsorshipCommitmentId" TEXT,
  "awardNumber" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'ZAR',
  "awardedAmount" DECIMAL(14,2) NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3),
  "status" "GrantAwardStatus" NOT NULL DEFAULT 'DRAFT',
  "confirmedByUserId" TEXT NOT NULL,
  "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "suspendedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "cancellationReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GrantAward_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GrantAward_source_consistency_check" CHECK (
    ("sourceType" = 'FUNDING_APPLICATION' AND "fundingApplicationId" IS NOT NULL AND "sponsorshipCommitmentId" IS NULL) OR
    ("sourceType" = 'SPONSORSHIP_COMMITMENT' AND "sponsorshipCommitmentId" IS NOT NULL AND "fundingApplicationId" IS NULL) OR
    ("sourceType" = 'MANUAL' AND "fundingApplicationId" IS NULL AND "sponsorshipCommitmentId" IS NULL)
  ),
  CONSTRAINT "GrantAward_awarded_amount_check" CHECK ("awardedAmount" >= 0),
  CONSTRAINT "GrantAward_date_range_check" CHECK ("endDate" IS NULL OR "endDate" >= "startDate")
);

CREATE TABLE "GrantAwardOrganisation" (
  "id" TEXT NOT NULL,
  "grantAwardId" TEXT NOT NULL,
  "organisationType" "GrantAwardOrganisationType" NOT NULL,
  "fundingOrganisationId" TEXT,
  "donorOrganisationId" TEXT,
  "role" "GrantAwardOrganisationRole" NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "canReview" BOOLEAN NOT NULL DEFAULT true,
  "canApprove" BOOLEAN NOT NULL DEFAULT false,
  "addedByUserId" TEXT NOT NULL,
  "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "removedAt" TIMESTAMP(3),
  CONSTRAINT "GrantAwardOrganisation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GrantAwardOrganisation_source_check" CHECK (
    ("organisationType" = 'FUNDING_ORGANISATION' AND "fundingOrganisationId" IS NOT NULL AND "donorOrganisationId" IS NULL) OR
    ("organisationType" = 'DONOR_ORGANISATION' AND "donorOrganisationId" IS NOT NULL AND "fundingOrganisationId" IS NULL)
  )
);

CREATE TABLE "GrantAwardAccess" (
  "id" TEXT NOT NULL,
  "grantAwardId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "GrantAwardAccessRole" NOT NULL,
  "permissions" "GrantAwardPermission"[] NOT NULL DEFAULT ARRAY[]::"GrantAwardPermission"[],
  "grantedByUserId" TEXT NOT NULL,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "revokedByUserId" TEXT,
  CONSTRAINT "GrantAwardAccess_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GrantTranche" (
  "id" TEXT NOT NULL,
  "grantAwardId" TEXT NOT NULL,
  "trancheNumber" INTEGER NOT NULL,
  "title" TEXT,
  "scheduledAmount" DECIMAL(14,2) NOT NULL,
  "scheduledDate" TIMESTAMP(3),
  "conditions" TEXT,
  "notes" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GrantTranche_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GrantTranche_number_check" CHECK ("trancheNumber" > 0),
  CONSTRAINT "GrantTranche_scheduled_amount_check" CHECK ("scheduledAmount" >= 0)
);

CREATE TABLE "GrantDisbursement" (
  "id" TEXT NOT NULL,
  "grantAwardId" TEXT NOT NULL,
  "grantTrancheId" TEXT,
  "amountReceived" DECIMAL(14,2) NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL,
  "reference" TEXT,
  "notes" TEXT,
  "evidenceFileAssetId" TEXT,
  "recordedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GrantDisbursement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GrantDisbursement_amount_received_check" CHECK ("amountReceived" > 0)
);

CREATE TABLE "GrantReportingObligation" (
  "id" TEXT NOT NULL,
  "grantAwardId" TEXT NOT NULL,
  "grantTrancheId" TEXT,
  "type" "GrantObligationType" NOT NULL,
  "basis" "GrantObligationBasis" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "reportingPeriodStart" TIMESTAMP(3),
  "reportingPeriodEnd" TIMESTAMP(3),
  "financialYear" TEXT,
  "quarter" INTEGER,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "status" "GrantObligationStatus" NOT NULL DEFAULT 'PENDING',
  "customRequirements" TEXT,
  "requiresFunderApproval" BOOLEAN NOT NULL DEFAULT true,
  "requiresSuperAdminApproval" BOOLEAN NOT NULL DEFAULT false,
  "createdByUserId" TEXT NOT NULL,
  "waivedByUserId" TEXT,
  "waivedAt" TIMESTAMP(3),
  "waiverReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GrantReportingObligation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GrantReportingObligation_quarter_check" CHECK ("quarter" IS NULL OR "quarter" BETWEEN 1 AND 4),
  CONSTRAINT "GrantReportingObligation_period_check" CHECK ("reportingPeriodStart" IS NULL OR "reportingPeriodEnd" IS NULL OR "reportingPeriodEnd" >= "reportingPeriodStart"),
  CONSTRAINT "GrantReportingObligation_basis_check" CHECK (
    ("basis" = 'TRANCHE' AND "grantTrancheId" IS NOT NULL) OR
    ("basis" = 'QUARTER' AND "financialYear" IS NOT NULL AND "quarter" IS NOT NULL AND "reportingPeriodStart" IS NOT NULL AND "reportingPeriodEnd" IS NOT NULL) OR
    ("basis" IN ('PERIOD', 'FINAL', 'CUSTOM') AND "grantTrancheId" IS NULL)
  )
);

CREATE TABLE "GrantReport" (
  "id" TEXT NOT NULL,
  "grantAwardId" TEXT NOT NULL,
  "obligationId" TEXT NOT NULL,
  "status" "GrantReportStatus" NOT NULL DEFAULT 'DRAFT',
  "currentVersionNumber" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" TEXT NOT NULL,
  "archivedByUserId" TEXT,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GrantReport_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GrantReport_version_number_check" CHECK ("currentVersionNumber" > 0)
);

CREATE TABLE "GrantReportVersion" (
  "id" TEXT NOT NULL,
  "grantReportId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "status" "GrantReportVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "reportType" "GrantObligationType" NOT NULL,
  "reportingPeriodStart" TIMESTAMP(3),
  "reportingPeriodEnd" TIMESTAMP(3),
  "financialYear" TEXT,
  "quarter" INTEGER,
  "trancheNumberSnapshot" INTEGER,
  "trancheAmountSnapshot" DECIMAL(14,2),
  "previousTrancheBalance" DECIMAL(14,2),
  "currency" TEXT NOT NULL DEFAULT 'ZAR',
  "fundingReceivedTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "otherIncomeTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "totalIncome" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "quarterlyExpenditureTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "cumulativeExpenditureTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "totalExpenditure" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "surplusDeficit" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "openingBankBalance" DECIMAL(14,2),
  "closingBankBalance" DECIMAL(14,2),
  "executiveSummary" TEXT,
  "objectivesNarrative" TEXT,
  "deliverablesNarrative" TEXT,
  "challenges" TEXT,
  "lessonsLearned" TEXT,
  "nextSteps" TEXT,
  "financialNarrative" TEXT,
  "centreSnapshot" JSONB,
  "fundingOrganisationSnapshot" JSONB,
  "awardSnapshot" JSONB,
  "projectSnapshot" JSONB,
  "trancheSnapshot" JSONB,
  "preparedByUserId" TEXT NOT NULL,
  "preparerNameSnapshot" TEXT NOT NULL,
  "preparerDesignationSnapshot" TEXT NOT NULL,
  "certificationAcknowledged" BOOLEAN NOT NULL DEFAULT false,
  "certificationTextSnapshot" TEXT,
  "submittedByUserId" TEXT,
  "submittedAt" TIMESTAMP(3),
  "returnedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GrantReportVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GrantReportVersion_number_check" CHECK ("versionNumber" > 0),
  CONSTRAINT "GrantReportVersion_quarter_check" CHECK ("quarter" IS NULL OR "quarter" BETWEEN 1 AND 4),
  CONSTRAINT "GrantReportVersion_period_check" CHECK ("reportingPeriodStart" IS NULL OR "reportingPeriodEnd" IS NULL OR "reportingPeriodEnd" >= "reportingPeriodStart"),
  CONSTRAINT "GrantReportVersion_tranche_number_check" CHECK ("trancheNumberSnapshot" IS NULL OR "trancheNumberSnapshot" > 0),
  CONSTRAINT "GrantReportVersion_tranche_amount_check" CHECK ("trancheAmountSnapshot" IS NULL OR "trancheAmountSnapshot" >= 0),
  CONSTRAINT "GrantReportVersion_totals_check" CHECK (
    "fundingReceivedTotal" >= 0 AND "otherIncomeTotal" >= 0 AND "totalIncome" >= 0 AND
    "quarterlyExpenditureTotal" >= 0 AND "cumulativeExpenditureTotal" >= 0 AND "totalExpenditure" >= 0
  )
);

CREATE TABLE "GrantReportFinancialLine" (
  "id" TEXT NOT NULL,
  "grantReportVersionId" TEXT NOT NULL,
  "lineType" "GrantFinancialLineType" NOT NULL,
  "categoryCode" TEXT,
  "categoryName" TEXT NOT NULL,
  "description" TEXT,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "approvedBudget" DECIMAL(14,2),
  "quarterlyBudget" DECIMAL(14,2),
  "quarterlyActual" DECIMAL(14,2),
  "cumulativeActual" DECIMAL(14,2),
  "estimatedExpenditure" DECIMAL(14,2),
  "variance" DECIMAL(14,2),
  "reasonForVariance" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GrantReportFinancialLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GrantReportFinancialLine_amounts_check" CHECK (
    ("approvedBudget" IS NULL OR "approvedBudget" >= 0) AND
    ("quarterlyBudget" IS NULL OR "quarterlyBudget" >= 0) AND
    ("quarterlyActual" IS NULL OR "quarterlyActual" >= 0) AND
    ("cumulativeActual" IS NULL OR "cumulativeActual" >= 0) AND
    ("estimatedExpenditure" IS NULL OR "estimatedExpenditure" >= 0)
  )
);

CREATE TABLE "GrantReportIndicator" (
  "id" TEXT NOT NULL,
  "grantReportVersionId" TEXT NOT NULL,
  "objective" TEXT NOT NULL,
  "deliverable" TEXT,
  "indicator" TEXT NOT NULL,
  "baseline" TEXT,
  "target" TEXT,
  "achieved" TEXT,
  "status" "GrantIndicatorStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "progressNarrative" TEXT,
  "meansOfVerification" TEXT,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GrantReportIndicator_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GrantReportDocument" (
  "id" TEXT NOT NULL,
  "grantReportVersionId" TEXT NOT NULL,
  "indicatorId" TEXT,
  "financialLineId" TEXT,
  "fileAssetId" TEXT NOT NULL,
  "documentType" "GrantReportDocumentType" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "originalFilenameSnapshot" TEXT NOT NULL,
  "mimeTypeSnapshot" TEXT NOT NULL,
  "fileSizeSnapshot" INTEGER NOT NULL,
  "checksumSnapshot" TEXT,
  "uploadedByUserId" TEXT NOT NULL,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GrantReportDocument_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GrantReportDocument_file_size_check" CHECK ("fileSizeSnapshot" >= 0)
);

CREATE TABLE "GrantReportReview" (
  "id" TEXT NOT NULL,
  "grantReportVersionId" TEXT NOT NULL,
  "reviewerUserId" TEXT NOT NULL,
  "grantAwardOrganisationId" TEXT,
  "stage" "GrantReviewStage" NOT NULL,
  "stageSequence" INTEGER NOT NULL DEFAULT 1,
  "decision" "GrantReviewDecision" NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GrantReportReview_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GrantReportReview_stage_sequence_check" CHECK ("stageSequence" > 0)
);

CREATE TABLE "GrantExpenseAllocation" (
  "id" TEXT NOT NULL,
  "grantAwardId" TEXT NOT NULL,
  "sourceType" "GrantExpenseSourceType" NOT NULL,
  "procurementOrderItemId" TEXT,
  "invoiceId" TEXT,
  "supplierInvoiceId" TEXT,
  "manualReference" TEXT,
  "allocatedAmount" DECIMAL(14,2) NOT NULL,
  "allocationDate" TIMESTAMP(3) NOT NULL,
  "description" TEXT,
  "allocatedByUserId" TEXT NOT NULL,
  "reversedAt" TIMESTAMP(3),
  "reversedByUserId" TEXT,
  "reversalReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GrantExpenseAllocation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GrantExpenseAllocation_amount_check" CHECK ("allocatedAmount" > 0),
  CONSTRAINT "GrantExpenseAllocation_source_check" CHECK (
    ("sourceType" = 'PROCUREMENT_ORDER_ITEM' AND "procurementOrderItemId" IS NOT NULL AND "invoiceId" IS NULL AND "supplierInvoiceId" IS NULL AND "manualReference" IS NULL) OR
    ("sourceType" = 'PROCUREMENT_INVOICE' AND "invoiceId" IS NOT NULL AND "procurementOrderItemId" IS NULL AND "supplierInvoiceId" IS NULL AND "manualReference" IS NULL) OR
    ("sourceType" = 'SUPPLIER_INVOICE' AND "supplierInvoiceId" IS NOT NULL AND "procurementOrderItemId" IS NULL AND "invoiceId" IS NULL AND "manualReference" IS NULL) OR
    ("sourceType" = 'MANUAL' AND "procurementOrderItemId" IS NULL AND "invoiceId" IS NULL AND "supplierInvoiceId" IS NULL AND NULLIF(BTRIM("manualReference"), '') IS NOT NULL)
  )
);

CREATE TABLE "GrantReportExpenseEntry" (
  "id" TEXT NOT NULL,
  "grantReportVersionId" TEXT NOT NULL,
  "financialLineId" TEXT NOT NULL,
  "grantExpenseAllocationId" TEXT,
  "sourceTypeSnapshot" "GrantExpenseSourceType" NOT NULL,
  "sourceReferenceSnapshot" TEXT,
  "descriptionSnapshot" TEXT,
  "expenseDateSnapshot" TIMESTAMP(3),
  "allocatedAmountSnapshot" DECIMAL(14,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GrantReportExpenseEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GrantReportExpenseEntry_amount_check" CHECK ("allocatedAmountSnapshot" > 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "GrantAward_fundingApplicationId_key" ON "GrantAward"("fundingApplicationId");
CREATE UNIQUE INDEX "GrantAward_sponsorshipCommitmentId_key" ON "GrantAward"("sponsorshipCommitmentId");
CREATE UNIQUE INDEX "GrantAward_awardNumber_key" ON "GrantAward"("awardNumber");
CREATE INDEX "GrantAward_centreId_status_idx" ON "GrantAward"("centreId", "status");
CREATE INDEX "GrantAward_fundingProjectId_status_idx" ON "GrantAward"("fundingProjectId", "status");
CREATE INDEX "GrantAward_status_startDate_endDate_idx" ON "GrantAward"("status", "startDate", "endDate");
CREATE INDEX "GrantAward_confirmedByUserId_confirmedAt_idx" ON "GrantAward"("confirmedByUserId", "confirmedAt");

CREATE UNIQUE INDEX "GrantAwardOrganisation_grantAwardId_fundingOrganisationId_key" ON "GrantAwardOrganisation"("grantAwardId", "fundingOrganisationId");
CREATE UNIQUE INDEX "GrantAwardOrganisation_grantAwardId_donorOrganisationId_key" ON "GrantAwardOrganisation"("grantAwardId", "donorOrganisationId");
CREATE INDEX "GrantAwardOrganisation_fundingOrganisationId_grantAwardId_idx" ON "GrantAwardOrganisation"("fundingOrganisationId", "grantAwardId");
CREATE INDEX "GrantAwardOrganisation_donorOrganisationId_grantAwardId_idx" ON "GrantAwardOrganisation"("donorOrganisationId", "grantAwardId");
CREATE INDEX "GrantAwardOrganisation_grantAwardId_role_removedAt_idx" ON "GrantAwardOrganisation"("grantAwardId", "role", "removedAt");

CREATE UNIQUE INDEX "GrantAwardAccess_grantAwardId_userId_key" ON "GrantAwardAccess"("grantAwardId", "userId");
CREATE INDEX "GrantAwardAccess_userId_revokedAt_expiresAt_idx" ON "GrantAwardAccess"("userId", "revokedAt", "expiresAt");
CREATE INDEX "GrantAwardAccess_grantAwardId_role_revokedAt_idx" ON "GrantAwardAccess"("grantAwardId", "role", "revokedAt");

CREATE UNIQUE INDEX "GrantTranche_grantAwardId_trancheNumber_key" ON "GrantTranche"("grantAwardId", "trancheNumber");
CREATE INDEX "GrantTranche_grantAwardId_scheduledDate_idx" ON "GrantTranche"("grantAwardId", "scheduledDate");
CREATE INDEX "GrantDisbursement_grantAwardId_receivedAt_idx" ON "GrantDisbursement"("grantAwardId", "receivedAt");
CREATE INDEX "GrantDisbursement_grantTrancheId_receivedAt_idx" ON "GrantDisbursement"("grantTrancheId", "receivedAt");
CREATE INDEX "GrantDisbursement_reference_idx" ON "GrantDisbursement"("reference");

CREATE INDEX "GrantReportingObligation_grantAwardId_status_dueAt_idx" ON "GrantReportingObligation"("grantAwardId", "status", "dueAt");
CREATE INDEX "GrantReportingObligation_grantTrancheId_idx" ON "GrantReportingObligation"("grantTrancheId");
CREATE INDEX "GrantReportingObligation_type_status_dueAt_idx" ON "GrantReportingObligation"("type", "status", "dueAt");
CREATE INDEX "GrantReportingObligation_financialYear_quarter_idx" ON "GrantReportingObligation"("financialYear", "quarter");

CREATE UNIQUE INDEX "GrantReport_obligationId_key" ON "GrantReport"("obligationId");
CREATE INDEX "GrantReport_grantAwardId_status_updatedAt_idx" ON "GrantReport"("grantAwardId", "status", "updatedAt");
CREATE INDEX "GrantReport_status_createdAt_idx" ON "GrantReport"("status", "createdAt");
CREATE INDEX "GrantReport_createdByUserId_createdAt_idx" ON "GrantReport"("createdByUserId", "createdAt");

CREATE UNIQUE INDEX "GrantReportVersion_grantReportId_versionNumber_key" ON "GrantReportVersion"("grantReportId", "versionNumber");
CREATE INDEX "GrantReportVersion_grantReportId_status_idx" ON "GrantReportVersion"("grantReportId", "status");
CREATE INDEX "GrantReportVersion_submittedByUserId_submittedAt_idx" ON "GrantReportVersion"("submittedByUserId", "submittedAt");
CREATE INDEX "GrantReportVersion_status_submittedAt_idx" ON "GrantReportVersion"("status", "submittedAt");

CREATE INDEX "GrantReportFinancialLine_grantReportVersionId_lineType_disp_idx" ON "GrantReportFinancialLine"("grantReportVersionId", "lineType", "displayOrder");
CREATE INDEX "GrantReportFinancialLine_categoryCode_idx" ON "GrantReportFinancialLine"("categoryCode");
CREATE INDEX "GrantReportIndicator_grantReportVersionId_status_displayOrd_idx" ON "GrantReportIndicator"("grantReportVersionId", "status", "displayOrder");
CREATE INDEX "GrantReportDocument_grantReportVersionId_documentType_idx" ON "GrantReportDocument"("grantReportVersionId", "documentType");
CREATE INDEX "GrantReportDocument_indicatorId_idx" ON "GrantReportDocument"("indicatorId");
CREATE INDEX "GrantReportDocument_financialLineId_idx" ON "GrantReportDocument"("financialLineId");
CREATE INDEX "GrantReportDocument_fileAssetId_idx" ON "GrantReportDocument"("fileAssetId");
CREATE INDEX "GrantReportReview_grantReportVersionId_stage_stageSequence_idx" ON "GrantReportReview"("grantReportVersionId", "stage", "stageSequence");
CREATE INDEX "GrantReportReview_reviewerUserId_createdAt_idx" ON "GrantReportReview"("reviewerUserId", "createdAt");
CREATE INDEX "GrantReportReview_grantAwardOrganisationId_createdAt_idx" ON "GrantReportReview"("grantAwardOrganisationId", "createdAt");

CREATE UNIQUE INDEX "GrantExpenseAllocation_grantAwardId_procurementOrderItemId_key" ON "GrantExpenseAllocation"("grantAwardId", "procurementOrderItemId");
CREATE UNIQUE INDEX "GrantExpenseAllocation_grantAwardId_invoiceId_key" ON "GrantExpenseAllocation"("grantAwardId", "invoiceId");
CREATE UNIQUE INDEX "GrantExpenseAllocation_grantAwardId_supplierInvoiceId_key" ON "GrantExpenseAllocation"("grantAwardId", "supplierInvoiceId");
CREATE INDEX "GrantExpenseAllocation_grantAwardId_allocationDate_idx" ON "GrantExpenseAllocation"("grantAwardId", "allocationDate");
CREATE INDEX "GrantExpenseAllocation_procurementOrderItemId_idx" ON "GrantExpenseAllocation"("procurementOrderItemId");
CREATE INDEX "GrantExpenseAllocation_invoiceId_idx" ON "GrantExpenseAllocation"("invoiceId");
CREATE INDEX "GrantExpenseAllocation_supplierInvoiceId_idx" ON "GrantExpenseAllocation"("supplierInvoiceId");
CREATE INDEX "GrantReportExpenseEntry_grantReportVersionId_idx" ON "GrantReportExpenseEntry"("grantReportVersionId");
CREATE INDEX "GrantReportExpenseEntry_financialLineId_idx" ON "GrantReportExpenseEntry"("financialLineId");
CREATE INDEX "GrantReportExpenseEntry_grantExpenseAllocationId_idx" ON "GrantReportExpenseEntry"("grantExpenseAllocationId");

CREATE INDEX "FundingOrganisationUser_userId_status_idx" ON "FundingOrganisationUser"("userId", "status");
CREATE INDEX "FundingOrganisationUser_fundingOrganisationId_status_role_idx" ON "FundingOrganisationUser"("fundingOrganisationId", "status", "role");

-- AddForeignKey
ALTER TABLE "GrantAward" ADD CONSTRAINT "GrantAward_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "EcdCentre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrantAward" ADD CONSTRAINT "GrantAward_fundingProjectId_fkey" FOREIGN KEY ("fundingProjectId") REFERENCES "FundingProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrantAward" ADD CONSTRAINT "GrantAward_fundingApplicationId_fkey" FOREIGN KEY ("fundingApplicationId") REFERENCES "FundingApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrantAward" ADD CONSTRAINT "GrantAward_sponsorshipCommitmentId_fkey" FOREIGN KEY ("sponsorshipCommitmentId") REFERENCES "SponsorshipCommitment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrantAward" ADD CONSTRAINT "GrantAward_confirmedByUserId_fkey" FOREIGN KEY ("confirmedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GrantAwardOrganisation" ADD CONSTRAINT "GrantAwardOrganisation_grantAwardId_fkey" FOREIGN KEY ("grantAwardId") REFERENCES "GrantAward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrantAwardOrganisation" ADD CONSTRAINT "GrantAwardOrganisation_fundingOrganisationId_fkey" FOREIGN KEY ("fundingOrganisationId") REFERENCES "FundingOrganisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrantAwardOrganisation" ADD CONSTRAINT "GrantAwardOrganisation_donorOrganisationId_fkey" FOREIGN KEY ("donorOrganisationId") REFERENCES "DonorOrganisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrantAwardOrganisation" ADD CONSTRAINT "GrantAwardOrganisation_addedByUserId_fkey" FOREIGN KEY ("addedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GrantAwardAccess" ADD CONSTRAINT "GrantAwardAccess_grantAwardId_fkey" FOREIGN KEY ("grantAwardId") REFERENCES "GrantAward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrantAwardAccess" ADD CONSTRAINT "GrantAwardAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrantAwardAccess" ADD CONSTRAINT "GrantAwardAccess_grantedByUserId_fkey" FOREIGN KEY ("grantedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrantAwardAccess" ADD CONSTRAINT "GrantAwardAccess_revokedByUserId_fkey" FOREIGN KEY ("revokedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GrantTranche" ADD CONSTRAINT "GrantTranche_grantAwardId_fkey" FOREIGN KEY ("grantAwardId") REFERENCES "GrantAward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrantTranche" ADD CONSTRAINT "GrantTranche_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrantDisbursement" ADD CONSTRAINT "GrantDisbursement_grantAwardId_fkey" FOREIGN KEY ("grantAwardId") REFERENCES "GrantAward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrantDisbursement" ADD CONSTRAINT "GrantDisbursement_grantTrancheId_fkey" FOREIGN KEY ("grantTrancheId") REFERENCES "GrantTranche"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrantDisbursement" ADD CONSTRAINT "GrantDisbursement_evidenceFileAssetId_fkey" FOREIGN KEY ("evidenceFileAssetId") REFERENCES "FileAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrantDisbursement" ADD CONSTRAINT "GrantDisbursement_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GrantReportingObligation" ADD CONSTRAINT "GrantReportingObligation_grantAwardId_fkey" FOREIGN KEY ("grantAwardId") REFERENCES "GrantAward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrantReportingObligation" ADD CONSTRAINT "GrantReportingObligation_grantTrancheId_fkey" FOREIGN KEY ("grantTrancheId") REFERENCES "GrantTranche"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrantReportingObligation" ADD CONSTRAINT "GrantReportingObligation_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrantReportingObligation" ADD CONSTRAINT "GrantReportingObligation_waivedByUserId_fkey" FOREIGN KEY ("waivedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GrantReport" ADD CONSTRAINT "GrantReport_grantAwardId_fkey" FOREIGN KEY ("grantAwardId") REFERENCES "GrantAward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrantReport" ADD CONSTRAINT "GrantReport_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "GrantReportingObligation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrantReport" ADD CONSTRAINT "GrantReport_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrantReport" ADD CONSTRAINT "GrantReport_archivedByUserId_fkey" FOREIGN KEY ("archivedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GrantReportVersion" ADD CONSTRAINT "GrantReportVersion_grantReportId_fkey" FOREIGN KEY ("grantReportId") REFERENCES "GrantReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrantReportVersion" ADD CONSTRAINT "GrantReportVersion_preparedByUserId_fkey" FOREIGN KEY ("preparedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrantReportVersion" ADD CONSTRAINT "GrantReportVersion_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrantReportFinancialLine" ADD CONSTRAINT "GrantReportFinancialLine_grantReportVersionId_fkey" FOREIGN KEY ("grantReportVersionId") REFERENCES "GrantReportVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GrantReportIndicator" ADD CONSTRAINT "GrantReportIndicator_grantReportVersionId_fkey" FOREIGN KEY ("grantReportVersionId") REFERENCES "GrantReportVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GrantReportDocument" ADD CONSTRAINT "GrantReportDocument_grantReportVersionId_fkey" FOREIGN KEY ("grantReportVersionId") REFERENCES "GrantReportVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GrantReportDocument" ADD CONSTRAINT "GrantReportDocument_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "GrantReportIndicator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrantReportDocument" ADD CONSTRAINT "GrantReportDocument_financialLineId_fkey" FOREIGN KEY ("financialLineId") REFERENCES "GrantReportFinancialLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrantReportDocument" ADD CONSTRAINT "GrantReportDocument_fileAssetId_fkey" FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrantReportDocument" ADD CONSTRAINT "GrantReportDocument_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrantReportReview" ADD CONSTRAINT "GrantReportReview_grantReportVersionId_fkey" FOREIGN KEY ("grantReportVersionId") REFERENCES "GrantReportVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrantReportReview" ADD CONSTRAINT "GrantReportReview_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrantReportReview" ADD CONSTRAINT "GrantReportReview_grantAwardOrganisationId_fkey" FOREIGN KEY ("grantAwardOrganisationId") REFERENCES "GrantAwardOrganisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GrantExpenseAllocation" ADD CONSTRAINT "GrantExpenseAllocation_grantAwardId_fkey" FOREIGN KEY ("grantAwardId") REFERENCES "GrantAward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrantExpenseAllocation" ADD CONSTRAINT "GrantExpenseAllocation_procurementOrderItemId_fkey" FOREIGN KEY ("procurementOrderItemId") REFERENCES "ProcurementOrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrantExpenseAllocation" ADD CONSTRAINT "GrantExpenseAllocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrantExpenseAllocation" ADD CONSTRAINT "GrantExpenseAllocation_supplierInvoiceId_fkey" FOREIGN KEY ("supplierInvoiceId") REFERENCES "SupplierInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrantExpenseAllocation" ADD CONSTRAINT "GrantExpenseAllocation_allocatedByUserId_fkey" FOREIGN KEY ("allocatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrantExpenseAllocation" ADD CONSTRAINT "GrantExpenseAllocation_reversedByUserId_fkey" FOREIGN KEY ("reversedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrantReportExpenseEntry" ADD CONSTRAINT "GrantReportExpenseEntry_grantReportVersionId_fkey" FOREIGN KEY ("grantReportVersionId") REFERENCES "GrantReportVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GrantReportExpenseEntry" ADD CONSTRAINT "GrantReportExpenseEntry_financialLineId_fkey" FOREIGN KEY ("financialLineId") REFERENCES "GrantReportFinancialLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GrantReportExpenseEntry" ADD CONSTRAINT "GrantReportExpenseEntry_grantExpenseAllocationId_fkey" FOREIGN KEY ("grantExpenseAllocationId") REFERENCES "GrantExpenseAllocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
