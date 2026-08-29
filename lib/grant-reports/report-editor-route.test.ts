import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { GrantReportingServiceError } from "@/lib/services/grant-reports";
import { createGrantReportSectionHandler, type GrantReportSectionRouteDependencies } from "./report-editor-route";

const validBody = { section: "general", data: { reportingPeriodStart: "2026-01-01", reportingPeriodEnd: "2026-06-30", previousTrancheBalance: "0.00" } };
function dependencies(overrides: Partial<GrantReportSectionRouteDependencies> = {}): GrantReportSectionRouteDependencies {
  return { authorize: async () => ({ internalUser: { id: "internal-admin" } }), checkOrigin: () => null, save: async () => ({ id: "report-1" }), ...overrides };
}
const request = (body: unknown = validBody) => new Request("https://ecdlink.test/api/grant-reports/report-1/sections", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const context = { params: Promise.resolve({ reportId: "report-1" }) };

test("report section API is wired to database-backed report authorization and trusted origin validation", () => {
  const source = readFileSync("app/api/grant-reports/[reportId]/sections/route.ts", "utf8");
  assert.match(source, /authorize:\s*requireReportAdmin/);
  assert.match(source, /checkOrigin:\s*requireTrustedOrigin/);
  assert.doesNotMatch(source, /unsafeMetadata|publicMetadata|sessionClaims/);
});

test("report document routes preserve private authenticated storage access", () => {
  const upload = readFileSync("app/api/grant-reports/[reportId]/documents/route.ts", "utf8");
  const access = readFileSync("app/api/grant-reports/[reportId]/documents/[documentId]/route.ts", "utf8");
  assert.match(upload, /requireReportAdmin\(\)/);
  assert.match(upload, /requireTrustedOrigin\(request\)/);
  assert.match(upload, /enforceRateLimit\("funding_document_upload"/);
  assert.match(upload, /validateUploadRequest\(request\)/);
  assert.match(access, /requireReportAdmin\(\)/);
  assert.match(access, /NextResponse\.redirect\(access\.url, 302\)/);
  assert.doesNotMatch(upload + access, /storageKey|publicUrl|unsafeMetadata|publicMetadata/);
});

test("unauthenticated and non-admin requests are rejected before section persistence", async () => {
  for (const status of [401, 403]) {
    let saved = false;
    const handler = createGrantReportSectionHandler(dependencies({ authorize: async () => ({ error: Response.json({ ok: false }, { status }) }), save: async () => { saved = true; } }));
    assert.equal((await handler(request(), context)).status, status);
    assert.equal(saved, false);
  }
});

test("valid section payload reaches persistence with the internal actor", async () => {
  let captured: unknown;
  const handler = createGrantReportSectionHandler(dependencies({ save: async (reportId, input, actorUserId) => { captured = { reportId, input, actorUserId }; return {}; } }));
  assert.equal((await handler(request(), context)).status, 200);
  assert.deepEqual(captured, { reportId: "report-1", input: validBody, actorUserId: "internal-admin" });
});

test("invalid payload and invalid report access fail safely", async () => {
  const invalid = createGrantReportSectionHandler(dependencies());
  assert.equal((await invalid(request({ section: "beneficiaries", data: {} }), context)).status, 422);
  const inaccessible = createGrantReportSectionHandler(dependencies({ save: async () => { throw new GrantReportingServiceError("Grant report not found.", 404); } }));
  assert.equal((await inaccessible(request(), context)).status, 404);
  const failing = createGrantReportSectionHandler(dependencies({ save: async () => { throw new Error("P2003 DATABASE_URL secret"); } }));
  const response = await failing(request(), context);
  assert.equal(response.status, 500);
  assert.doesNotMatch(await response.text(), /P2003|DATABASE_URL|secret/);
});
