import type { GrantReportFiltersInput, GrantReportingMonitoringFiltersInput } from "@/lib/validators/grant-reports";
import {
  getGrantReportingMonitoring,
  getGrantReportingMonitoringCentres,
  type GrantReportingMonitoringData,
} from "@/lib/repositories/grant-report-monitoring";
import {
  getGrantReportWorkspace,
  type GrantReportWorkspaceScope,
} from "@/lib/repositories/grant-reports";
import type { GrantReportWorkspaceData } from "@/lib/grant-reports/types";

export type GrantReportsTab = "monitoring" | GrantReportWorkspaceScope;

export function resolveGrantReportsTab(value: string | undefined): GrantReportsTab {
  return value === "reports" || value === "awards" || value === "obligations" ? value : "monitoring";
}

type LoaderDependencies = {
  loadMonitoring(filters: GrantReportingMonitoringFiltersInput): Promise<GrantReportingMonitoringData>;
  loadMonitoringCentres(): Promise<GrantReportWorkspaceData["options"]["centres"]>;
  loadWorkspace(filters: GrantReportFiltersInput, scope: GrantReportWorkspaceScope): Promise<GrantReportWorkspaceData>;
};

const defaultDependencies: LoaderDependencies = {
  loadMonitoring: getGrantReportingMonitoring,
  loadMonitoringCentres: getGrantReportingMonitoringCentres,
  loadWorkspace: getGrantReportWorkspace,
};

export async function loadGrantReportsDashboard(
  tab: GrantReportsTab,
  filters: GrantReportFiltersInput,
  monitoringFilters: GrantReportingMonitoringFiltersInput,
  dependencies: LoaderDependencies = defaultDependencies,
) {
  if (tab === "monitoring") {
    const [monitoring, monitoringCentres] = await Promise.all([
      dependencies.loadMonitoring(monitoringFilters),
      dependencies.loadMonitoringCentres(),
    ]);
    return { workspace: null, monitoring, monitoringCentres };
  }

  const workspace = await dependencies.loadWorkspace(filters, tab);
  return { workspace, monitoring: null, monitoringCentres: [] };
}
