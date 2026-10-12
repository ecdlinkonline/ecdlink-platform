import "server-only";

import { createGrantReportSubmissionPack } from "@/lib/grant-report-export/pack";
import { getGrantReportVersionExportSource } from "@/lib/grant-report-export/repository";

type Authorize = () => Promise<{ error: Response } | { internalUser: unknown; [key: string]: unknown }>;
type Load = typeof getGrantReportVersionExportSource;
type Assemble = typeof createGrantReportSubmissionPack;

async function authorizePackRead() {
  const { requireReportAdmin } = await import("@/lib/api/report-auth");
  return requireReportAdmin();
}

export async function createGrantReportSubmissionPackForAdmin(
  input: { reportId: string; versionId: string },
  dependencies: { authorize?: Authorize; load?: Load; assemble?: Assemble } = {},
) {
  const authorization = await (dependencies.authorize ?? authorizePackRead)();
  if ("error" in authorization) return authorization;
  const source = await (dependencies.load ?? getGrantReportVersionExportSource)(input);
  if (!source) return { error: Response.json({ ok: false, error: "Grant report version not found." }, { status: 404 }) };
  return { artifact: await (dependencies.assemble ?? createGrantReportSubmissionPack)(source) };
}
