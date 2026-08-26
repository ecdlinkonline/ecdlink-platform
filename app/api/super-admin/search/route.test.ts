import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createSuperAdminSearchHandler, type SuperAdminSearchRouteDependencies } from "@/lib/search/super-admin-search-route";

function authorizationError(status: number, message: string) {
  return { error: Response.json({ ok: false, error: message }, { status }) } as const;
}

function authorizedSuperAdmin() {
  return {
    internalUser: { id: "user-super-admin", role: "SUPER_ADMIN", status: "ACTIVE" }
  } as const;
}

function createDependencies(overrides: Partial<SuperAdminSearchRouteDependencies> = {}): SuperAdminSearchRouteDependencies {
  return {
    authorize: async () => authorizedSuperAdmin(),
    search: async () => [],
    reportError: () => undefined,
    ...overrides
  };
}

function request(query = "?q=bright") {
  return new Request(`https://ecdlink.test/api/super-admin/search${query}`);
}

test("the production route is wired to requireIdentityAdmin", () => {
  const routeSource = readFileSync("app/api/super-admin/search/route.ts", "utf8");
  assert.match(routeSource, /authorize:\s*async[\s\S]*requireIdentityAdmin\(\)/);
});

test("the actual route handler rejects unauthenticated requests before search", async () => {
  let searchCalled = false;
  const handler = createSuperAdminSearchHandler(createDependencies({
    authorize: async () => authorizationError(401, "Authentication required."),
    search: async () => {
      searchCalled = true;
      return [];
    }
  }));

  const response = await handler(request());
  assert.equal(response.status, 401);
  assert.equal(searchCalled, false);
});

test("the actual route handler rejects an authenticated database non-Super Admin", async () => {
  let searchCalled = false;
  const handler = createSuperAdminSearchHandler(createDependencies({
    authorize: async () => authorizationError(403, "Only Super Admin users can manage identity records."),
    search: async () => {
      searchCalled = true;
      return [];
    }
  }));

  const response = await handler(request());
  assert.equal(response.status, 403);
  assert.equal(searchCalled, false);
});

test("the actual route handler allows an active database Super Admin", async () => {
  const handler = createSuperAdminSearchHandler(createDependencies({
    search: async (query) => [{ id: "centre-1", module: "centres", moduleLabel: "Centres", title: query, context: "Centre", href: "/dashboard/super-admin/centres/centre-1" }]
  }));

  const response = await handler(request("?q=bright%20futures"));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.data.results[0].title, "bright futures");
});

test("missing, whitespace-only, short and oversized queries return 422 without searching", async () => {
  let searchCalls = 0;
  const handler = createSuperAdminSearchHandler(createDependencies({
    search: async () => {
      searchCalls += 1;
      return [];
    }
  }));

  for (const query of ["", "?q=%20%20%20", "?q=a", `?q=${"x".repeat(101)}`]) {
    const response = await handler(request(query));
    assert.equal(response.status, 422);
  }
  assert.equal(searchCalls, 0);
});

test("a valid query reaches the real route search boundary after trimming", async () => {
  const receivedQueries: string[] = [];
  const handler = createSuperAdminSearchHandler(createDependencies({
    search: async (query) => {
      receivedQueries.push(query);
      return [];
    }
  }));

  const response = await handler(request("?q=%20%20supplier%20%20"));
  assert.equal(response.status, 200);
  assert.deepEqual(receivedQueries, ["supplier"]);
});

test("repository failures return a safe 500 response without Prisma details", async () => {
  const reported: unknown[] = [];
  const handler = createSuperAdminSearchHandler(createDependencies({
    search: async () => {
      throw new Error("P2003 DATABASE_URL secret-detail");
    },
    reportError: (_message, error) => reported.push(error)
  }));

  const response = await handler(request());
  const bodyText = await response.text();
  assert.equal(response.status, 500);
  assert.match(bodyText, /Workspace search is temporarily unavailable/);
  assert.doesNotMatch(bodyText, /P2003|DATABASE_URL|secret-detail/);
  assert.equal(reported.length, 1);
});
