import assert from "node:assert/strict";
import test from "node:test";
import { loadGrantReportsDashboard, resolveGrantReportsTab, type GrantReportsTab } from "./dashboard-loader";

const filters = {};
const monitoringFilters = { monitor: "all" as const, page: 1 };
const monitoring = { metrics: {}, rows: [], pagination: {}, options: {} };
const workspace = { reports: [], awards: [], obligations: [], options: {} };
const centres = [{ id: "centre-1", centreName: "Future Leaders" }];

function dependencies(calls: string[]) {
  return {
    loadMonitoring: async () => { calls.push("monitoring"); return monitoring as never; },
    loadMonitoringCentres: async () => { calls.push("monitoring-centres"); return centres; },
    loadWorkspace: async (_filters: unknown, scope: string) => { calls.push(`workspace:${scope}`); return workspace as never; },
  };
}

test("Monitoring is the default and loads no legacy workspace datasets", async () => {
  assert.equal(resolveGrantReportsTab(undefined), "monitoring");
  assert.equal(resolveGrantReportsTab("unknown"), "monitoring");
  const calls: string[] = [];
  const result = await loadGrantReportsDashboard("monitoring", filters, monitoringFilters, dependencies(calls));
  assert.deepEqual(calls, ["monitoring", "monitoring-centres"]);
  assert.equal(result.workspace, null);
  assert.equal(result.monitoring, monitoring);
  assert.deepEqual(result.monitoringCentres, centres);
});

test("each legacy tab loads only its corresponding workspace scope", async () => {
  for (const tab of ["reports", "awards", "obligations"] satisfies GrantReportsTab[]) {
    const calls: string[] = [];
    const result = await loadGrantReportsDashboard(tab, filters, monitoringFilters, dependencies(calls));
    assert.deepEqual(calls, [`workspace:${tab}`]);
    assert.equal(result.workspace, workspace);
    assert.equal(result.monitoring, null);
    assert.deepEqual(result.monitoringCentres, []);
  }
});

test("valid legacy tab URLs remain stable", () => {
  assert.equal(resolveGrantReportsTab("reports"), "reports");
  assert.equal(resolveGrantReportsTab("awards"), "awards");
  assert.equal(resolveGrantReportsTab("obligations"), "obligations");
});
