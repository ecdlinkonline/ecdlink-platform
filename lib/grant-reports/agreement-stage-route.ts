import { apiError, apiSuccess, statusFromError } from "@/lib/api/responses";
import { StorageError } from "@/lib/storage/errors";
import type { SafeFileAsset } from "@/lib/storage/types";

export type AgreementStageRouteDependencies = {
  authorize: () => Promise<{ error: Response } | { internalUser: { id: string } }>;
  checkOrigin: (request: Request) => Response | null;
  checkRateLimit: (actorUserId: string) => Promise<Response | null>;
  validateRequest: (request: Request) => { valid: true } | { valid: false; status: number; message: string };
  stage: (input: { actorUserId: string; file: File }) => Promise<SafeFileAsset>;
};

export function createAgreementStageHandler(dependencies: AgreementStageRouteDependencies) {
  return async function handleAgreementStage(request: Request) {
    const context = await dependencies.authorize();
    if ("error" in context) return context.error;
    const originError = dependencies.checkOrigin(request); if (originError) return originError;
    const rateError = await dependencies.checkRateLimit(context.internalUser.id); if (rateError) return rateError;
    const requestValidation = dependencies.validateRequest(request); if (!requestValidation.valid) return apiError(requestValidation.message, requestValidation.status);
    try {
      const file = (await request.formData()).get("file");
      if (!(file instanceof File)) return apiError("A PDF agreement is required.", 422);
      return apiSuccess(await dependencies.stage({ actorUserId: context.internalUser.id, file }), 201);
    } catch (error) {
      return error instanceof StorageError
        ? apiError(error.message, error.status)
        : apiError("The agreement could not be staged.", error instanceof Error ? statusFromError(error, 500) : 500);
    }
  };
}
