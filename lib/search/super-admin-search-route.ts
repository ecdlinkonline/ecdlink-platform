import { ZodError } from "zod";
import { apiError, apiSuccess, validationError } from "@/lib/api/responses";
import { searchSuperAdminWorkspace } from "@/lib/repositories/super-admin-search";
import { superAdminSearchQuerySchema } from "@/lib/validators/super-admin-search";

export type SuperAdminSearchAuthorization =
  | { error: Response }
  | { internalUser: { id: string; role: "SUPER_ADMIN"; status: "ACTIVE" } };

export type SuperAdminSearchRouteDependencies = {
  authorize: () => Promise<SuperAdminSearchAuthorization>;
  search: typeof searchSuperAdminWorkspace;
  reportError: (message: string, error: unknown) => void;
};

export function createSuperAdminSearchHandler(dependencies: SuperAdminSearchRouteDependencies) {
  return async function handleSuperAdminSearch(request: Request) {
    const context = await dependencies.authorize();
    if ("error" in context) return context.error;

    try {
      const { q } = superAdminSearchQuerySchema.parse({ q: new URL(request.url).searchParams.get("q") });
      return apiSuccess({ query: q, results: await dependencies.search(q) });
    } catch (error) {
      if (error instanceof ZodError) return validationError(error);
      dependencies.reportError("Super Admin workspace search failed.", error);
      return apiError("Workspace search is temporarily unavailable.", 500);
    }
  };
}
