import { ZodError } from "zod";
import { apiError, apiSuccess, validationError } from "@/lib/api/responses";
import { GrantReportingServiceError } from "@/lib/services/grant-reports";
import { saveGrantReportSectionSchema, type SaveGrantReportSectionInput } from "@/lib/validators/grant-reports";

type EditorAuthorization = { error: Response } | { internalUser: { id: string } };

export type GrantReportSectionRouteDependencies = {
  authorize: () => Promise<EditorAuthorization>;
  checkOrigin: (request: Request) => Response | null;
  save: (reportId: string, input: SaveGrantReportSectionInput, actorUserId: string) => Promise<unknown>;
};

export function createGrantReportSectionHandler(dependencies: GrantReportSectionRouteDependencies) {
  return async function handleGrantReportSection(request: Request, context: { params: Promise<{ reportId: string }> }) {
    const auth = await dependencies.authorize();
    if ("error" in auth) return auth.error;
    const originError = dependencies.checkOrigin(request);
    if (originError) return originError;
    try {
      const { reportId } = await context.params;
      const input = saveGrantReportSectionSchema.parse(await request.json());
      return apiSuccess(await dependencies.save(reportId, input, auth.internalUser.id));
    } catch (error) {
      if (error instanceof ZodError) return validationError(error);
      if (error instanceof GrantReportingServiceError) return apiError(error.message, error.status);
      return apiError("The report section could not be saved.", 500);
    }
  };
}
