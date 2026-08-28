import { requireReportAdmin } from "@/lib/api/report-auth";
import { enforceRateLimit, requireTrustedOrigin } from "@/lib/api/security";
import { validateUploadRequest } from "@/lib/security/upload-request";
import { stageGrantAwardAgreement } from "@/lib/services/grant-award-agreements";
import { createAgreementStageHandler } from "@/lib/grant-reports/agreement-stage-route";

export const POST = createAgreementStageHandler({
  authorize: requireReportAdmin,
  checkOrigin: requireTrustedOrigin,
  checkRateLimit: (actorUserId) => enforceRateLimit("grant_award_agreement_upload", actorUserId),
  validateRequest: validateUploadRequest,
  stage: stageGrantAwardAgreement,
});
