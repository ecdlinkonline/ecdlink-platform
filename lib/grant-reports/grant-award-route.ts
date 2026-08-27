import { ZodError } from "zod";
import { apiError, apiSuccess, validationError } from "@/lib/api/responses";
import { GrantReportingServiceError } from "@/lib/services/grant-reports";
import { createGrantAwardSchema, type CreateGrantAwardInput } from "@/lib/validators/grant-reports";

export type GrantAwardRouteAuthorization = { error: Response } | { internalUser: { id: string } };
export type GrantAwardRouteDependencies = {
  authorize: () => Promise<GrantAwardRouteAuthorization>;
  createAward: (input: CreateGrantAwardInput, actorUserId: string) => Promise<unknown>;
  rollbackAgreement: (input: { actorUserId: string; fileAssetId: string }) => Promise<unknown>;
};

export function createGrantAwardPostHandler(dependencies: GrantAwardRouteDependencies) {
  return async function handleCreateGrantAward(request: Request) {
    const context = await dependencies.authorize();
    if ("error" in context) return context.error;
    let input: CreateGrantAwardInput | undefined;
    try {
      input = createGrantAwardSchema.parse(await request.json());
      return apiSuccess(await dependencies.createAward(input, context.internalUser.id), 201);
    } catch (error) {
      if (input?.signedAgreementFileAssetId) {
        await dependencies.rollbackAgreement({ actorUserId: context.internalUser.id, fileAssetId: input.signedAgreementFileAssetId }).catch(() => undefined);
      }
      if (error instanceof ZodError) return validationError(error);
      if (error instanceof GrantReportingServiceError) return apiError(error.message, error.status);
      return apiError("Grant award could not be created.", 500);
    }
  };
}
