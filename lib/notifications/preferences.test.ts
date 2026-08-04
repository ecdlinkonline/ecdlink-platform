import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_NOTIFICATION_PREFERENCE, includesInAppDelivery } from "./preferences";

test("defaults notification delivery to both channels", () => assert.equal(DEFAULT_NOTIFICATION_PREFERENCE, "BOTH"));
test("only BOTH and IN_APP enable Sprint 10A in-app delivery", () => {
  assert.equal(includesInAppDelivery("BOTH"), true);
  assert.equal(includesInAppDelivery("IN_APP"), true);
  assert.equal(includesInAppDelivery("EMAIL"), false);
  assert.equal(includesInAppDelivery("NONE"), false);
});
