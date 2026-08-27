import { requireReportAdmin } from "@/lib/api/report-auth";
import { createGrantReportListHandler } from "@/lib/grant-reports/report-list-route";
import { getGrantReportWorkspace } from "@/lib/repositories/grant-reports";

export const dynamic = "force-dynamic";

export const GET = createGrantReportListHandler({ authorize: requireReportAdmin, load: getGrantReportWorkspace });
