import { requireReportAdmin } from "@/lib/api/report-auth";
import { createGrantAwardPostHandler } from "@/lib/grant-reports/grant-award-route";
import { createGrantAward } from "@/lib/services/grant-reports";
import { rollbackStagedGrantAwardAgreement } from "@/lib/services/grant-award-agreements";

export const POST = createGrantAwardPostHandler({ authorize: requireReportAdmin, createAward: createGrantAward, rollbackAgreement: rollbackStagedGrantAwardAgreement });
