import "server-only";

import { getGrantReportVersionExportData } from "@/lib/grant-report-export/repository";

type Authorize = () => Promise<{ error: Response } | { internalUser: unknown; [key: string]: unknown }>;
type Load = typeof getGrantReportVersionExportData;

async function authorizeExportRead() {
  const { requireReportAdmin } = await import("@/lib/api/report-auth");
  return requireReportAdmin();
}

export async function loadGrantReportVersionExportForAdmin(
  input: { reportId: string; versionId: string },
  dependencies: { authorize?: Authorize; load?: Load } = {},
) {
  const authorization = await (dependencies.authorize ?? authorizeExportRead)();
  if ("error" in authorization) return authorization;
  const data = await (dependencies.load ?? getGrantReportVersionExportData)(input);
  if (!data) return { error: Response.json({ ok: false, error: "Grant report version not found." }, { status: 404 }) };
  return { data };
}
