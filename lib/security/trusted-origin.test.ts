import assert from "node:assert/strict";
import test from "node:test";
import { hasTrustedOrigin } from "./trusted-origin";

const environment = { APP_BASE_URL: "https://app.example.test", TRUSTED_APP_ORIGINS: "https://admin.example.test" };
test("allows configured trusted origins and safe methods", () => {
  assert.equal(hasTrustedOrigin(new Request("https://app.example.test/api", { method: "POST", headers: { Origin: "https://admin.example.test" } }), environment), true);
  assert.equal(hasTrustedOrigin(new Request("https://app.example.test/api", { method: "GET" }), environment), true);
});
test("rejects untrusted or missing origins for unsafe methods", () => {
  assert.equal(hasTrustedOrigin(new Request("https://app.example.test/api", { method: "DELETE", headers: { Origin: "https://evil.example" } }), environment), false);
  assert.equal(hasTrustedOrigin(new Request("https://app.example.test/api", { method: "POST" }), environment), false);
});
