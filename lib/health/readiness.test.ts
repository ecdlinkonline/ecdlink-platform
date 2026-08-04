import assert from "node:assert/strict";
import test from "node:test";
import { checkReadiness, withReadinessTimeout, type ReadinessDependencies } from "./readiness";

const fixedDate = new Date("2026-08-04T12:00:00.000Z");
function dependencies(overrides: Partial<ReadinessDependencies> = {}): ReadinessDependencies {
  return {
    checkConfiguration: () => true,
    checkDatabase: async () => true,
    checkStorage: async () => true,
    checkEmail: async () => true,
    timeoutMs: 50,
    now: () => fixedDate,
    ...overrides,
  };
}

test("reports ready only when every read-only dependency is ready", async () => {
  const result = await checkReadiness(dependencies());
  assert.equal(result.ready, true);
  assert.equal(result.checkedAt, fixedDate.toISOString());
  assert.deepEqual(result.components.map((item) => item.status), ["ready", "ready", "ready", "ready"]);
});

test("returns a successful dependency result before the timeout", async () => {
  assert.equal(await withReadinessTimeout(async () => "ready", 50), "ready");
});

test("rejects a dependency that exceeds its timeout", async () => {
  await assert.rejects(() => withReadinessTimeout(() => new Promise<string>(() => undefined), 10));
});

test("one dependency timeout makes overall readiness false", async () => {
  const result = await checkReadiness(dependencies({ checkDatabase: () => new Promise<boolean>(() => undefined), timeoutMs: 10 }));
  assert.equal(result.ready, false);
  assert.deepEqual(result.components.find((item) => item.component === "database"), { component: "database", status: "not_ready" });
});

test("external readiness checks start concurrently", async () => {
  const started: string[] = [];
  const resolvers: Array<() => void> = [];
  const pending = (name: string) => () => new Promise<boolean>((resolve) => { started.push(name); resolvers.push(() => resolve(true)); });
  const resultPromise = checkReadiness(dependencies({
    checkDatabase: pending("database"),
    checkStorage: pending("storage"),
    checkEmail: pending("email"),
    timeoutMs: 100,
  }));
  assert.deepEqual(started, ["database", "storage", "email"]);
  resolvers.forEach((resolve) => resolve());
  assert.equal((await resultPromise).ready, true);
});

test("converts provider errors into a safe not-ready component", async () => {
  const result = await checkReadiness(dependencies({ checkStorage: async () => { throw new Error("secret provider detail"); } }));
  assert.equal(result.ready, false);
  assert.deepEqual(result.components.find((item) => item.component === "storage"), { component: "storage", status: "not_ready" });
  assert.equal(JSON.stringify(result).includes("secret provider detail"), false);
});
