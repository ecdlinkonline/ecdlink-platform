export const dynamic = "force-dynamic";

import { RoleDashboardShell } from "@/components/app-shell/role-dashboard-shell";
import { GrantReportsWorkspace } from "@/components/reports/grant-reports-workspace";
import { requireSuperAdmin } from "@/lib/auth/permissions";
import { getGrantReportWorkspace } from "@/lib/repositories/grant-reports";
import { grantReportFiltersSchema } from "@/lib/validators/grant-reports";

type ReportsPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export default async function SuperAdminReportsPage({ searchParams }: ReportsPageProps) {
  await requireSuperAdmin();
  const params = await searchParams;
  const filters = grantReportFiltersSchema.safeParse({ query: first(params.query), status: first(params.status), type: first(params.type), centreId: first(params.centreId), organisationId: first(params.organisationId) });
  const data = await getGrantReportWorkspace(filters.success ? filters.data : {});

  return <RoleDashboardShell role="super_admin"><GrantReportsWorkspace data={data} initialTab={first(params.tab)} filters={filters.success ? filters.data : {}} /></RoleDashboardShell>;
}
