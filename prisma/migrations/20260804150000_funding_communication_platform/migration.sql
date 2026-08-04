CREATE TYPE "FundingCommunicationType" AS ENUM ('CLARIFICATION_REQUESTED', 'APPLICATION_APPROVED', 'APPLICATION_REJECTED', 'DOCUMENT_VERIFIED', 'DOCUMENT_RESUBMISSION', 'MANUAL', 'EMAIL');
ALTER TYPE "NotificationType" ADD VALUE 'FUNDING_MANUAL_COMMUNICATION';

CREATE TABLE "FundingReviewerNote" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "authorUserId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "FundingReviewerNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FundingCommunication" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "type" "FundingCommunicationType" NOT NULL,
  "authorUserId" TEXT,
  "recipientUserId" TEXT,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "metadata" JSONB,
  "sourceEventKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FundingCommunication_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FundingReviewerNote_applicationId_deletedAt_createdAt_idx" ON "FundingReviewerNote"("applicationId", "deletedAt", "createdAt");
CREATE INDEX "FundingReviewerNote_authorUserId_createdAt_idx" ON "FundingReviewerNote"("authorUserId", "createdAt");
CREATE UNIQUE INDEX "FundingCommunication_sourceEventKey_key" ON "FundingCommunication"("sourceEventKey");
CREATE INDEX "FundingCommunication_applicationId_createdAt_idx" ON "FundingCommunication"("applicationId", "createdAt");
CREATE INDEX "FundingCommunication_recipientUserId_createdAt_idx" ON "FundingCommunication"("recipientUserId", "createdAt");
CREATE INDEX "FundingCommunication_type_createdAt_idx" ON "FundingCommunication"("type", "createdAt");

ALTER TABLE "FundingReviewerNote" ADD CONSTRAINT "FundingReviewerNote_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "FundingApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FundingReviewerNote" ADD CONSTRAINT "FundingReviewerNote_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FundingCommunication" ADD CONSTRAINT "FundingCommunication_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "FundingApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FundingCommunication" ADD CONSTRAINT "FundingCommunication_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FundingCommunication" ADD CONSTRAINT "FundingCommunication_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
