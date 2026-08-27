import assert from "node:assert/strict";
import test from "node:test";
import { grantReportEmptyStateMessage } from "./presentation";

test("the report empty state explains the persisted obligation-to-draft lifecycle", () => {
  const message = grantReportEmptyStateMessage();
  assert.match(message, /reporting obligation/i);
  assert.match(message, /Draft/);
});
