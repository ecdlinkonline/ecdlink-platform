import assert from "node:assert/strict";
import test from "node:test";
import { buildGrantReportExportFixture } from "@/lib/grant-report-export/fixtures";
import { loadGrantReportVersionExportForAdmin } from "@/lib/grant-report-export/service";

test("database-backed authorization completes before export repository access", async () => {
  const order: string[] = [];
  const result = await loadGrantReportVersionExportForAdmin(
    { reportId: "report-1", versionId: "version-1" },
    {
      authorize: async () => { order.push("authorize"); return { internalUser: { id: "admin-1", role: "SUPER_ADMIN", status: "ACTIVE" } } as never; },
      load: async () => { order.push("load"); return buildGrantReportExportFixture({ status: "SUBMITTED" }); },
    },
  );
  assert.deepEqual(order, ["authorize", "load"]);
  assert.ok("data" in result);
});
test("authorization failure prevents any export data lookup", async () => {
  let loaded = false;
  const response = new Response(JSON.stringify({ ok: false }), { status: 403 });
  const result = await loadGrantReportVersionExportForAdmin(
    { reportId: "report-1", versionId: "version-1" },
    {
      authorize: async () => ({ error: response }) as never,
      load: async () => { loaded = true; return buildGrantReportExportFixture(); },
    },
  );
  assert.equal(loaded, false);
  assert.equal("error" in result, true);
});
