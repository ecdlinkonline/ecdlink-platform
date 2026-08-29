import { requireReportAdmin } from "@/lib/api/report-auth";
import { requireTrustedOrigin } from "@/lib/api/security";
import { createGrantReportSectionHandler } from "@/lib/grant-reports/report-editor-route";
import { saveGrantReportSection } from "@/lib/services/grant-reports";

export const PATCH = createGrantReportSectionHandler({ authorize: requireReportAdmin, checkOrigin: requireTrustedOrigin, save: saveGrantReportSection });
