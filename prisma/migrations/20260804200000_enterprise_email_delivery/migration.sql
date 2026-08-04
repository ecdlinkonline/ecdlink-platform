CREATE TYPE "EmailStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');
CREATE TYPE "EmailProviderName" AS ENUM ('NOOP', 'RESEND');

ALTER TABLE "Notification" ADD COLUMN "inAppVisible" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "EmailDeliveryLog" (
  "id" TEXT NOT NULL,
  "notificationId" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "provider" "EmailProviderName" NOT NULL,
  "status" "EmailStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "providerMessageId" TEXT,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "sentAt" TIMESTAMP(3),
  CONSTRAINT "EmailDeliveryLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailDeliveryLog_notificationId_key" ON "EmailDeliveryLog"("notificationId");
CREATE INDEX "EmailDeliveryLog_status_createdAt_idx" ON "EmailDeliveryLog"("status", "createdAt");
CREATE INDEX "EmailDeliveryLog_recipient_createdAt_idx" ON "EmailDeliveryLog"("recipient", "createdAt");
ALTER TABLE "EmailDeliveryLog" ADD CONSTRAINT "EmailDeliveryLog_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
