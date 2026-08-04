import assert from "node:assert/strict";
import test from "node:test";
import { authorizeFallbackAdmin, fallbackAdminEnabled, timingSafeMatches } from "./fallback-auth";

const enabled = { ECDLINK_ENABLE_FALLBACK_ADMIN: "true", ECDLINK_FALLBACK_ADMIN_EMAIL: "admin@example.test", ECDLINK_FALLBACK_ADMIN_PASSWORD: "a-strong-password", RATE_LIMIT_IDENTIFIER_SECRET: "test-secret" };
const request = new Request("https://app.example.test/api/auth", { headers: { "x-forwarded-for": "192.0.2.1" } });
test("fallback authentication is disabled by default", () => { assert.equal(fallbackAdminEnabled({}), false); });
test("timing-safe comparisons preserve exact credential behavior", () => { assert.equal(timingSafeMatches("same", "same"), true); assert.equal(timingSafeMatches("one", "two"), false); });
test("explicitly enabled fallback access still requires valid credentials", async () => {
  const rateLimiter = { check: async () => ({ allowed: true, remaining: 1, resetAt: new Date(), retryAfterSeconds: 0 }) };
  assert.equal(await authorizeFallbackAdmin({ email: "admin@example.test", password: "a-strong-password", request }, enabled, rateLimiter), true);
  assert.equal(await authorizeFallbackAdmin({ email: "admin@example.test", password: "wrong", request }, enabled, rateLimiter), false);
});
test("fallback rate denial stops authentication", async () => {
  const rateLimiter = { check: async () => ({ allowed: false, remaining: 0, resetAt: new Date(), retryAfterSeconds: 30 }) };
  assert.equal(await authorizeFallbackAdmin({ email: "admin@example.test", password: "a-strong-password", request }, enabled, rateLimiter), false);
});
