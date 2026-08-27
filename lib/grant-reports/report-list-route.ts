import { ZodError } from "zod";
import { apiError, apiSuccess, validationError } from "@/lib/api/responses";
import type { getGrantReportWorkspace } from "@/lib/repositories/grant-reports";
import { grantReportFiltersSchema } from "@/lib/validators/grant-reports";

export type ReportListAuthorization =
  | { error: Response }
  | { internalUser: { id: string; role: string; status: string } };

export type ReportListRouteDependencies = {
  authorize: () => Promise<ReportListAuthorization>;
  load: typeof getGrantReportWorkspace;
};

export function createGrantReportListHandler(dependencies: ReportListRouteDependencies) {
  return async function handleGrantReportList(request: Request) {
    const context = await dependencies.authorize();
    if ("error" in context) return context.error;

    try {
      const searchParams = new URL(request.url).searchParams;
      const filters = grantReportFiltersSchema.parse({
        query: searchParams.get("query") ?? undefined,
        status: searchParams.get("status") ?? undefined,
        type: searchParams.get("type") ?? undefined,
        centreId: searchParams.get("centreId") ?? undefined,
        organisationId: searchParams.get("organisationId") ?? undefined,
      });
      return apiSuccess(await dependencies.load(filters));
    } catch (error) {
      if (error instanceof ZodError) return validationError(error);
      return apiError("Grant reports could not be loaded.", 500);
    }
  };
}
