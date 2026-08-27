ALTER TABLE "GrantAward"
ADD COLUMN "signedAgreementFileAssetId" TEXT,
ADD COLUMN "agreementDate" TIMESTAMP(3),
ADD COLUMN "signedByBothParties" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "GrantAward_signedAgreementFileAssetId_key"
ON "GrantAward"("signedAgreementFileAssetId");

ALTER TABLE "GrantAward"
ADD CONSTRAINT "GrantAward_signedAgreementFileAssetId_fkey"
FOREIGN KEY ("signedAgreementFileAssetId") REFERENCES "FileAsset"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
