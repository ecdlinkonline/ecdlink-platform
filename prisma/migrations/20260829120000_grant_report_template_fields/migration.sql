-- CreateEnum
CREATE TYPE "GrantReportBeneficiaryCategory" AS ENUM (
  'CHILDREN_0_18',
  'YOUTH_18_35',
  'ADULTS_35_65',
  'OLDER_PERSONS_65_PLUS',
  'PEOPLE_WITH_DISABILITIES'
);

CREATE TYPE "GrantReportRacialGroup" AS ENUM (
  'AFRICAN',
  'COLOURED',
  'INDIAN_ASIAN',
  'WHITE'
);

CREATE TYPE "GrantReportCertificationParty" AS ENUM (
  'COMPILER',
  'APPROVER'
);

-- AlterEnum
ALTER TYPE "GrantReportDocumentType" ADD VALUE 'AUDITED_FINANCIAL_STATEMENTS';

-- AlterTable: nullable fields preserve all existing report versions.
ALTER TABLE "GrantReportVersion"
  ADD COLUMN "organisationalChanges" TEXT,
  ADD COLUMN "communityChanges" TEXT;

-- AlterTable: nullable fields preserve all existing financial lines.
ALTER TABLE "GrantReportFinancialLine"
  ADD COLUMN "costingFrameworkPercentage" DECIMAL(5,2),
  ADD COLUMN "fundingSourceActual" DECIMAL(14,2),
  ADD COLUMN "otherSourceActual" DECIMAL(14,2),
  ADD CONSTRAINT "GrantReportFinancialLine_costing_percentage_check" CHECK (
    "costingFrameworkPercentage" IS NULL OR
    "costingFrameworkPercentage" BETWEEN 0 AND 100
  ),
  ADD CONSTRAINT "GrantReportFinancialLine_source_amounts_check" CHECK (
    ("fundingSourceActual" IS NULL OR "fundingSourceActual" >= 0) AND
    ("otherSourceActual" IS NULL OR "otherSourceActual" >= 0)
  );

-- CreateTable
CREATE TABLE "GrantReportBeneficiaryBreakdown" (
  "id" TEXT NOT NULL,
  "grantReportVersionId" TEXT NOT NULL,
  "category" "GrantReportBeneficiaryCategory" NOT NULL,
  "total" INTEGER NOT NULL DEFAULT 0,
  "male" INTEGER NOT NULL DEFAULT 0,
  "female" INTEGER NOT NULL DEFAULT 0,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GrantReportBeneficiaryBreakdown_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GrantReportBeneficiary_counts_check" CHECK (
    "total" >= 0 AND "male" >= 0 AND "female" >= 0
  )
);

CREATE TABLE "GrantReportRacialProfileRow" (
  "id" TEXT NOT NULL,
  "grantReportVersionId" TEXT NOT NULL,
  "racialGroup" "GrantReportRacialGroup" NOT NULL,
  "children" INTEGER NOT NULL DEFAULT 0,
  "youth" INTEGER NOT NULL DEFAULT 0,
  "men" INTEGER NOT NULL DEFAULT 0,
  "women" INTEGER NOT NULL DEFAULT 0,
  "olderPersons" INTEGER NOT NULL DEFAULT 0,
  "peopleWithDisabilities" INTEGER NOT NULL DEFAULT 0,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GrantReportRacialProfileRow_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GrantReportRacial_counts_check" CHECK (
    "children" >= 0 AND
    "youth" >= 0 AND
    "men" >= 0 AND
    "women" >= 0 AND
    "olderPersons" >= 0 AND
    "peopleWithDisabilities" >= 0
  )
);

CREATE TABLE "GrantReportSustainabilityItem" (
  "id" TEXT NOT NULL,
  "grantReportVersionId" TEXT NOT NULL,
  "plan" TEXT NOT NULL,
  "progressToDate" TEXT NOT NULL,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GrantReportSustainabilityItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GrantReportCertification" (
  "id" TEXT NOT NULL,
  "grantReportVersionId" TEXT NOT NULL,
  "party" "GrantReportCertificationParty" NOT NULL,
  "nameSnapshot" TEXT NOT NULL,
  "designationSnapshot" TEXT NOT NULL,
  "certificationDate" TIMESTAMP(3),
  "digitallyConfirmed" BOOLEAN NOT NULL DEFAULT false,
  "confirmedByUserId" TEXT,
  "confirmedAt" TIMESTAMP(3),
  "confirmationTextSnapshot" TEXT,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GrantReportCertification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GrantReportCertification_confirmation_check" CHECK (
    NOT "digitallyConfirmed" OR "confirmedAt" IS NOT NULL
  )
);

-- CreateIndex
CREATE UNIQUE INDEX "GrantReportBeneficiary_version_category_key"
  ON "GrantReportBeneficiaryBreakdown"("grantReportVersionId", "category");
CREATE INDEX "GrantReportBeneficiary_version_order_idx"
  ON "GrantReportBeneficiaryBreakdown"("grantReportVersionId", "displayOrder");

CREATE UNIQUE INDEX "GrantReportRacial_version_group_key"
  ON "GrantReportRacialProfileRow"("grantReportVersionId", "racialGroup");
CREATE INDEX "GrantReportRacial_version_order_idx"
  ON "GrantReportRacialProfileRow"("grantReportVersionId", "displayOrder");

CREATE INDEX "GrantReportSustainability_version_order_idx"
  ON "GrantReportSustainabilityItem"("grantReportVersionId", "displayOrder");

CREATE INDEX "GrantReportCertification_version_party_order_idx"
  ON "GrantReportCertification"("grantReportVersionId", "party", "displayOrder");
CREATE INDEX "GrantReportCertification_confirmer_time_idx"
  ON "GrantReportCertification"("confirmedByUserId", "confirmedAt");

-- AddForeignKey
ALTER TABLE "GrantReportBeneficiaryBreakdown"
  ADD CONSTRAINT "GrantReportBeneficiary_version_fkey"
  FOREIGN KEY ("grantReportVersionId") REFERENCES "GrantReportVersion"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GrantReportRacialProfileRow"
  ADD CONSTRAINT "GrantReportRacial_version_fkey"
  FOREIGN KEY ("grantReportVersionId") REFERENCES "GrantReportVersion"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GrantReportSustainabilityItem"
  ADD CONSTRAINT "GrantReportSustainability_version_fkey"
  FOREIGN KEY ("grantReportVersionId") REFERENCES "GrantReportVersion"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GrantReportCertification"
  ADD CONSTRAINT "GrantReportCertification_version_fkey"
  FOREIGN KEY ("grantReportVersionId") REFERENCES "GrantReportVersion"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GrantReportCertification"
  ADD CONSTRAINT "GrantReportCertification_confirmer_fkey"
  FOREIGN KEY ("confirmedByUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
