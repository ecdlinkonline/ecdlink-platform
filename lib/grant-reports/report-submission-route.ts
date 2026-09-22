import { ZodError } from "zod";
import { apiError, apiSuccess, validationError } from "@/lib/api/responses";
import { GrantReportingServiceError } from "@/lib/services/grant-reports";
import { submitGrantReportSchema, type SubmitGrantReportInput } from "@/lib/validators/grant-reports";

type SubmissionAuthorization = { error: Response } | { internalUser: { id: string } };

export type GrantReportSubmissionRouteDependencies = {
  authorize: () => Promise<SubmissionAuthorization>;
  checkOrigin: (request: Request) => Response | null;
  submit: (reportId: string, input: SubmitGrantReportInput, actorUserId: string) => Promise<unknown>;
};

export function createGrantReportSubmissionHandler(dependencies: GrantReportSubmissionRouteDependencies) {
  return async function handleGrantReportSubmission(request: Request, context: { params: Promise<{ reportId: string }> }) {
    const auth = await dependencies.authorize();
    if ("error" in auth) return auth.error;
    const originError = dependencies.checkOrigin(request);
    if (originError) return originError;
    try {
      const { reportId } = await context.params;
      const input = submitGrantReportSchema.parse(await request.json());
      return apiSuccess(await dependencies.submit(reportId, input, auth.internalUser.id));
    } catch (error) {
      if (error instanceof ZodError) return validationError(error);
      if (error instanceof GrantReportingServiceError) return apiError(error.message, error.status);
      return apiError("The report could not be submitted.", 500);
    }
  };
}
