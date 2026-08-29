import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { grantReportEmptyStateMessage } from "./presentation";

test("the report empty state explains the persisted obligation-to-draft lifecycle", () => {
  const message = grantReportEmptyStateMessage();
  assert.match(message, /reporting obligation/i);
  assert.match(message, /Draft/);
});

test("the reports register uses business-facing copy and a collapsible filter panel", () => {
  const source = readFileSync("components/reports/grant-reports-workspace.tsx", "utf8");
  assert.match(source, />All Reports</);
  assert.match(source, /View, search and open grant reports\./);
  assert.match(source, /aria-expanded=\{filtersOpen\}/);
  assert.match(source, /aria-controls="grant-report-filters"/);
  assert.match(source, /setFiltersOpen\(\(open\) => !open\)/);
  assert.doesNotMatch(source, /Full editing begins in Phase 2|persisted grant reports/);
});
