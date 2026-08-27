import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createGrantReportListHandler, type ReportListRouteDependencies } from "@/lib/grant-reports/report-list-route";

const emptyWorkspace = {
  metrics: { activeAwards: 0, reportsDue: 0, draftReports: 0, submittedReports: 0, returnedReports: 0, approvedReports: 0 },
  reports: [], awards: [], obligations: [],
  options: { centres: [], fundingOrganisations: [], donorOrganisations: [], projects: [], applications: [], commitments: [], awards: [] },
};

function dependencies(overrides: Partial<ReportListRouteDependencies> = {}): ReportListRouteDependencies {
  return {
    authorize: async () => ({ internalUser: { id: "internal-admin", role: "SUPER_ADMIN", status: "ACTIVE" } }),
    load: async () => emptyWorkspace,
    ...overrides,
  };
}

test("the production report route is wired to database-backed report admin authorization", () => {
  const source = readFileSync("app/api/reports/route.ts", "utf8");
  const authSource = readFileSync("lib/api/report-auth.ts", "utf8");
  assert.match(source, /authorize:\s*requireReportAdmin/);
  assert.match(authSource, /requireIdentityAdmin\(\)/);
  assert.doesNotMatch(source + authSource, /unsafeMetadata|publicMetadata|sessionClaims/);
});

test("unauthenticated and database non-Super-Admin requests are denied before report queries", async () => {
  for (const status of [401, 403]) {
    let loaded = false;
    const handler = createGrantReportListHandler(dependencies({
      authorize: async () => ({ error: Response.json({ ok: false }, { status }) }),
      load: async () => { loaded = true; return emptyWorkspace; },
    }));
    const response = await handler(new Request("https://ecdlink.test/api/reports"));
    assert.equal(response.status, status);
    assert.equal(loaded, false);
  }
});

test("an active database Super Admin can load a filtered persisted report list", async () => {
  let received: unknown;
  const handler = createGrantReportListHandler(dependencies({ load: async (filters) => { received = filters; return emptyWorkspace; } }));
  const response = await handler(new Request("https://ecdlink.test/api/reports?status=DRAFT&type=FINAL&query=centre"));
  assert.equal(response.status, 200);
  assert.deepEqual(received, { status: "DRAFT", type: "FINAL", query: "centre", centreId: undefined, organisationId: undefined });
});

test("invalid filters fail safely and repository errors do not leak details", async () => {
  const invalid = createGrantReportListHandler(dependencies());
  assert.equal((await invalid(new Request("https://ecdlink.test/api/reports?status=INVALID"))).status, 422);

  const failing = createGrantReportListHandler(dependencies({ load: async () => { throw new Error("P2003 DATABASE_URL secret"); } }));
  const response = await failing(new Request("https://ecdlink.test/api/reports"));
  const body = await response.text();
  assert.equal(response.status, 500);
  assert.doesNotMatch(body, /P2003|DATABASE_URL|secret/);
});
