import { requireReportAdmin } from "@/lib/api/report-auth";
import { requireTrustedOrigin } from "@/lib/api/security";
import { createGrantReportSubmissionHandler } from "@/lib/grant-reports/report-submission-route";
import { submitGrantReport } from "@/lib/services/grant-reports";

export const POST = createGrantReportSubmissionHandler({
  authorize: requireReportAdmin,
  checkOrigin: requireTrustedOrigin,
  submit: submitGrantReport,
});
