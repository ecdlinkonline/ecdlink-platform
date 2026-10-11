import type { GrantReportFiltersInput, GrantReportingAnnualCoverageFiltersInput, GrantReportingCalendarFiltersInput, GrantReportingMonitoringFiltersInput } from "@/lib/validators/grant-reports";
import { getGrantReportingAnnualCoverage, type GrantReportingAnnualCoverageData } from "@/lib/repositories/grant-report-annual-coverage";
import { getGrantReportingCalendar, type GrantReportingCalendarData } from "@/lib/repositories/grant-report-calendar";
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

export type GrantReportsTab = "monitoring" | "calendar" | "annual" | GrantReportWorkspaceScope;

export function resolveGrantReportsTab(value: string | undefined): GrantReportsTab {
  return value === "calendar" || value === "annual" || value === "reports" || value === "awards" || value === "obligations" ? value : "monitoring";
}

type LoaderDependencies = {
  loadMonitoring(filters: GrantReportingMonitoringFiltersInput): Promise<GrantReportingMonitoringData>;
  loadMonitoringCentres(): Promise<GrantReportWorkspaceData["options"]["centres"]>;
  loadCalendar(filters: GrantReportingCalendarFiltersInput): Promise<GrantReportingCalendarData>;
  loadAnnualCoverage(filters: GrantReportingAnnualCoverageFiltersInput): Promise<GrantReportingAnnualCoverageData>;
  loadWorkspace(filters: GrantReportFiltersInput, scope: GrantReportWorkspaceScope): Promise<GrantReportWorkspaceData>;
};

const defaultDependencies: LoaderDependencies = {
  loadMonitoring: getGrantReportingMonitoring,
  loadMonitoringCentres: getGrantReportingMonitoringCentres,
  loadCalendar: getGrantReportingCalendar,
  loadAnnualCoverage: getGrantReportingAnnualCoverage,
  loadWorkspace: getGrantReportWorkspace,
};

export async function loadGrantReportsDashboard(
  tab: GrantReportsTab,
  filters: GrantReportFiltersInput,
  monitoringFilters: GrantReportingMonitoringFiltersInput,
  calendarFilters: GrantReportingCalendarFiltersInput,
  annualFilters: GrantReportingAnnualCoverageFiltersInput,
  dependencies: LoaderDependencies = defaultDependencies,
) {
  if (tab === "monitoring") {
    const [monitoring, monitoringCentres] = await Promise.all([
      dependencies.loadMonitoring(monitoringFilters),
      dependencies.loadMonitoringCentres(),
    ]);
    return { workspace: null, monitoring, monitoringCentres, calendar: null, annualCoverage: null };
  }

  if (tab === "calendar") {
    const calendar = await dependencies.loadCalendar(calendarFilters);
    return { workspace: null, monitoring: null, monitoringCentres: [], calendar, annualCoverage: null };
  }

  if (tab === "annual") {
    const annualCoverage = await dependencies.loadAnnualCoverage(annualFilters);
    return { workspace: null, monitoring: null, monitoringCentres: [], calendar: null, annualCoverage };
  }

  const workspace = await dependencies.loadWorkspace(filters, tab);
  return { workspace, monitoring: null, monitoringCentres: [], calendar: null, annualCoverage: null };
}
