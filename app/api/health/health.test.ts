import assert from "node:assert/strict";
import test from "node:test";
import { GET as getHealth } from "./route";
import { createReadinessResponse } from "./ready/route";

test("liveness returns a public-safe no-store response", async () => {
  const response = getHealth();
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(body.status, "ok");
  assert.deepEqual(Object.keys(body).sort(), ["checkedAt", "status"]);
});

test("readiness returns 503 and exposes only safe component states", async () => {
  const response = await createReadinessResponse(async () => ({
    ready: false,
    checkedAt: "2026-08-04T12:00:00.000Z",
    components: [{ component: "database", status: "not_ready" }],
  }));
  const body = await response.json();
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(body, { ready: false, checkedAt: "2026-08-04T12:00:00.000Z", components: [{ component: "database", status: "not_ready" }] });
  assert.equal(JSON.stringify(body).includes("postgresql://"), false);
  assert.equal(JSON.stringify(body).includes("http"), false);
});
