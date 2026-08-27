import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  createDatabaseIdentityHandler,
  fingerprintConnectionUrl,
  type DatabaseIdentityRouteDependencies
} from "@/lib/diagnostics/database-identity";

function authorizationError(status: number, message: string) {
  return { error: Response.json({ ok: false, error: message }, { status }) } as const;
}

function dependencies(overrides: Partial<DatabaseIdentityRouteDependencies> = {}): DatabaseIdentityRouteDependencies {
  return {
    authorize: async () => ({ internalUser: { id: "user-admin", role: "SUPER_ADMIN", status: "ACTIVE" } }),
    queryIdentity: async () => ({ name: "ecdlink", schema: "public", serverVersion: "17.4" }),
    readConnections: () => ({
      databaseUrl: "postgresql://private-user:private-password@database.internal.example:5432/ecdlink?sslmode=require",
      directUrl: "postgresql://direct-user:direct-password@direct.internal.example:5432/ecdlink"
    }),
    ...overrides
  };
}

test("the production route uses database-backed requireIdentityAdmin authorization", () => {
  const source = readFileSync("app/api/super-admin/database-identity/route.ts", "utf8");
  assert.match(source, /requireIdentityAdmin\(\)/);
  assert.doesNotMatch(source, /unsafeMetadata|publicMetadata|sessionClaims/);
});

test("unauthenticated requests are denied before querying database identity", async () => {
  let queried = false;
  const handler = createDatabaseIdentityHandler(dependencies({
    authorize: async () => authorizationError(401, "Authentication required."),
    queryIdentity: async () => {
      queried = true;
      throw new Error("must not run");
    }
  }));

  const response = await handler();
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  assert.equal(queried, false);
});

test("database non-Super-Admins are denied before querying database identity", async () => {
  let queried = false;
  const handler = createDatabaseIdentityHandler(dependencies({
    authorize: async () => authorizationError(403, "Only Super Admin users can manage identity records."),
    queryIdentity: async () => {
      queried = true;
      throw new Error("must not run");
    }
  }));

  const response = await handler();
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  assert.equal(queried, false);
});

test("an active database Super Admin receives only database identity and connection fingerprints", async () => {
  const handler = createDatabaseIdentityHandler(dependencies());
  const response = await handler();
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body.database, { name: "ecdlink", schema: "public", serverVersion: "17.4" });
  assert.equal(body.connections.databaseUrl.configured, true);
  assert.equal(body.connections.databaseUrl.validUrl, true);
  assert.match(body.connections.databaseUrl.hostnameSha256, /^[a-f0-9]{16}$/);
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");

  const serialized = JSON.stringify(body);
  assert.doesNotMatch(serialized, /database\.internal\.example|direct\.internal\.example/);
  assert.doesNotMatch(serialized, /private-user|private-password|direct-user|direct-password/);
  assert.doesNotMatch(serialized, /5432|sslmode|postgresql:\/\//);
});

test("fingerprints normalize hostname case and do not include credentials or the raw hostname", () => {
  const result = fingerprintConnectionUrl("postgresql://SecretUser:SecretPassword@DB.Example.COM:6543/private?token=secret");
  const serialized = JSON.stringify(result);

  assert.deepEqual(result, fingerprintConnectionUrl("postgresql://other:credentials@db.example.com/another"));
  assert.doesNotMatch(serialized, /db\.example\.com|SecretUser|SecretPassword|6543|private|token|secret/i);
});

test("malformed and missing connection URLs are represented safely", () => {
  assert.deepEqual(fingerprintConnectionUrl("not a database url"), { configured: true, validUrl: false });
  assert.deepEqual(fingerprintConnectionUrl(undefined), { configured: false });
  assert.deepEqual(fingerprintConnectionUrl(""), { configured: false });
});

test("unexpected database errors return a generic 500 without connection details", async () => {
  const handler = createDatabaseIdentityHandler(dependencies({
    queryIdentity: async () => {
      throw new Error("P1001 postgresql://secret:password@database.internal.example:5432/ecdlink");
    }
  }));

  const response = await handler();
  const body = await response.text();
  assert.equal(response.status, 500);
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  assert.match(body, /Database identity is temporarily unavailable/);
  assert.doesNotMatch(body, /P1001|postgresql|secret|password|database\.internal\.example|5432/);
});
