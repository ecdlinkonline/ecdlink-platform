import assert from "node:assert/strict";
import test from "node:test";
import { createLatestSearchRequestGuard } from "./latest-search-request";

test("only the latest query generation may publish results or state", () => {
  const guard = createLatestSearchRequestGuard();
  const queryA = guard.begin();
  const queryB = guard.begin();

  assert.equal(guard.isCurrent(queryB), true);
  assert.equal(guard.isCurrent(queryA), false);

  const visibleResults: string[] = [];
  if (guard.isCurrent(queryB)) visibleResults.push("query B result");
  if (guard.isCurrent(queryA)) visibleResults.push("query A result");
  assert.deepEqual(visibleResults, ["query B result"]);
});

test("invalidating outstanding work prevents it from publishing", () => {
  const guard = createLatestSearchRequestGuard();
  const query = guard.begin();
  guard.invalidate();
  assert.equal(guard.isCurrent(query), false);
});
