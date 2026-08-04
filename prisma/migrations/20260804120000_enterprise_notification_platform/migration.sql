CREATE TYPE "NotificationModule" AS ENUM ('FUNDING', 'COMPLIANCE', 'PROCUREMENT', 'MEMBERSHIP', 'SUPPLIERS', 'CENTRES', 'PARTNERS', 'PLATFORM');
CREATE TYPE "NotificationType" AS ENUM ('FUNDING_APPLICATION_SUBMITTED', 'FUNDING_APPLICATION_CLARIFICATION_REQUESTED', 'FUNDING_APPLICATION_APPROVED', 'FUNDING_APPLICATION_REJECTED', 'FUNDING_APPLICATION_REVIEWER_ASSIGNED', 'FUNDING_DOCUMENT_RESUBMISSION_REQUESTED', 'FUNDING_DOCUMENT_VERIFIED', 'PLATFORM_GENERAL');
CREATE TYPE "NotificationDeliveryPreference" AS ENUM ('EMAIL', 'IN_APP', 'BOTH', 'NONE');

ALTER TABLE "Notification"
ADD COLUMN "recipientUserId" TEXT,
ADD COLUMN "actorUserId" TEXT,
ADD COLUMN "module" "NotificationModule" NOT NULL DEFAULT 'PLATFORM',
ADD COLUMN "type" "NotificationType" NOT NULL DEFAULT 'PLATFORM_GENERAL',
ADD COLUMN "href" TEXT,
ADD COLUMN "metadata" JSONB;

CREATE TABLE "NotificationPreference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "NotificationType" NOT NULL,
  "delivery" "NotificationDeliveryPreference" NOT NULL DEFAULT 'BOTH',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_recipientUserId_readAt_createdAt_idx" ON "Notification"("recipientUserId", "readAt", "createdAt");
CREATE INDEX "Notification_recipientUserId_module_createdAt_idx" ON "Notification"("recipientUserId", "module", "createdAt");
CREATE INDEX "Notification_recipientUserId_type_createdAt_idx" ON "Notification"("recipientUserId", "type", "createdAt");
CREATE INDEX "Notification_centreId_createdAt_idx" ON "Notification"("centreId", "createdAt");
CREATE UNIQUE INDEX "NotificationPreference_userId_type_key" ON "NotificationPreference"("userId", "type");
CREATE INDEX "NotificationPreference_userId_idx" ON "NotificationPreference"("userId");

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
