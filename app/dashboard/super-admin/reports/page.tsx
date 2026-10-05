export const dynamic = "force-dynamic";

import { RoleDashboardShell } from "@/components/app-shell/role-dashboard-shell";
import { GrantReportsWorkspace } from "@/components/reports/grant-reports-workspace";
import { requireSuperAdmin } from "@/lib/auth/permissions";
import { loadGrantReportsDashboard, resolveGrantReportsTab } from "@/lib/grant-reports/dashboard-loader";
import { grantReportFiltersSchema, grantReportingCalendarFiltersSchema, grantReportingMonitoringFiltersSchema } from "@/lib/validators/grant-reports";

type ReportsPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export default async function SuperAdminReportsPage({ searchParams }: ReportsPageProps) {
  await requireSuperAdmin();
  const params = await searchParams;
  const filters = grantReportFiltersSchema.safeParse({ query: first(params.query), status: first(params.status), type: first(params.type), centreId: first(params.centreId), organisationId: first(params.organisationId) });
  const monitoringFilters = grantReportingMonitoringFiltersSchema.safeParse({ monitor: first(params.monitor), query: first(params.query), centreId: first(params.centreId), type: first(params.type), financialYear: first(params.financialYear), quarter: first(params.quarter), page: first(params.page) });
  const calendarFilters = grantReportingCalendarFiltersSchema.safeParse({ query: first(params.query), centreId: first(params.centreId), awardId: first(params.awardId), type: first(params.type), state: first(params.state), financialYear: first(params.financialYear), quarter: first(params.quarter), page: first(params.page) });
  const validatedFilters = filters.success ? filters.data : {};
  const validatedMonitoringFilters = monitoringFilters.success ? monitoringFilters.data : grantReportingMonitoringFiltersSchema.parse({});
  const validatedCalendarFilters = calendarFilters.success ? calendarFilters.data : grantReportingCalendarFiltersSchema.parse({});
  const activeTab = resolveGrantReportsTab(first(params.tab));
  const loaded = await loadGrantReportsDashboard(activeTab, validatedFilters, validatedMonitoringFilters, validatedCalendarFilters);

  return <RoleDashboardShell role="super_admin"><GrantReportsWorkspace data={loaded.workspace} monitoring={loaded.monitoring} monitoringCentres={loaded.monitoringCentres} calendar={loaded.calendar} initialTab={activeTab} filters={validatedFilters} monitoringFilters={validatedMonitoringFilters} calendarFilters={validatedCalendarFilters} /></RoleDashboardShell>;
}
