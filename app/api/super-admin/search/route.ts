import { requireIdentityAdmin } from "@/lib/api/identity-auth";
import { searchSuperAdminWorkspace } from "@/lib/repositories/super-admin-search";
import { createSuperAdminSearchHandler, type SuperAdminSearchRouteDependencies } from "@/lib/search/super-admin-search-route";

const routeDependencies: SuperAdminSearchRouteDependencies = {
  authorize: async () => {
    const context = await requireIdentityAdmin();
    if ("error" in context) return context;
    return {
      internalUser: {
        id: context.internalUser.id,
        role: "SUPER_ADMIN",
        status: "ACTIVE"
      }
    };
  },
  search: searchSuperAdminWorkspace,
  reportError: (message, error) => console.error(message, error)
};

export const GET = createSuperAdminSearchHandler(routeDependencies);
