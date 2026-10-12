import assert from "node:assert/strict";
import test from "node:test";
import { buildGrantReportExportFixture } from "@/lib/grant-report-export/fixtures";
import { createGrantReportSubmissionPackForAdmin } from "@/lib/grant-report-export/pack-service";

test("database-backed authorization completes before version-scoped pack reads", async () => {
  const order: string[] = [];
  const artifact = { stream: null, byteSize: 1, manifest: {}, cleanup: async () => undefined };
  const result = await createGrantReportSubmissionPackForAdmin(
    { reportId: "report-1", versionId: "version-1" },
    {
      authorize: async () => { order.push("authorize"); return { internalUser: { role: "SUPER_ADMIN", status: "ACTIVE" } } as never; },
      load: async () => { order.push("load"); return { data: buildGrantReportExportFixture(), evidenceFiles: [] }; },
      assemble: async () => { order.push("assemble"); return artifact as never; },
    },
  );
  assert.deepEqual(order, ["authorize", "load", "assemble"]);
  assert.equal("artifact" in result, true);
});

test("authorization denial prevents report, storage and ZIP work", async () => {
  let loaded = false;
  let assembled = false;
  const response = new Response(null, { status: 403 });
  const result = await createGrantReportSubmissionPackForAdmin(
    { reportId: "report-1", versionId: "version-1" },
    {
      authorize: async () => ({ error: response }) as never,
      load: async () => { loaded = true; return null; },
      assemble: async () => { assembled = true; throw new Error("must not run"); },
    },
  );
  assert.equal(loaded, false);
  assert.equal(assembled, false);
  assert.equal("error" in result, true);
});
