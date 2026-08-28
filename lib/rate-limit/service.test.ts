import assert from "node:assert/strict";
import test from "node:test";
import { MemoryRateLimitProvider } from "./memory-provider";
import { RateLimitService, rateLimitKey } from "./service";

test("policy and internal user both form the stable rate-limit key", () => {
  assert.equal(rateLimitKey("funding_document_upload", "internal-user"), "ecdlink:funding_document_upload:internal-user");
  assert.equal(rateLimitKey("grant_award_agreement_upload", "internal-user"), "ecdlink:grant_award_agreement_upload:internal-user");
  assert.equal(rateLimitKey("grant_award_agreement_upload", "internal-user"), rateLimitKey("grant_award_agreement_upload", "internal-user"));
  assert.notEqual(rateLimitKey("grant_award_agreement_upload", "internal-user"), rateLimitKey("grant_award_agreement_upload", "other-user"));
});

test("grant agreement staging has an isolated ten-request window", async () => {
  const service = new RateLimitService(new MemoryRateLimitProvider(), "closed", () => new Date("2026-01-01T00:00:00Z"));
  for (let index = 0; index < 10; index++) assert.equal((await service.check("grant_award_agreement_upload", "internal-user")).allowed, true);
  assert.equal((await service.check("grant_award_agreement_upload", "internal-user")).allowed, false);
  assert.equal((await service.check("funding_document_upload", "internal-user")).allowed, true);
});

test("allows under limit and rejects over limit with Retry-After", async () => {
  const service = new RateLimitService(new MemoryRateLimitProvider(), "closed", () => new Date("2026-01-01T00:00:00Z"));
  for (let index = 0; index < 5; index++) assert.equal((await service.check("fallback_auth", "one")).allowed, true);
  const denied = await service.check("fallback_auth", "one");
  assert.equal(denied.allowed, false);
  assert.equal(denied.remaining, 0);
  assert.equal(denied.retryAfterSeconds, 900);
});

test("identifiers have independent counters and windows reset", async () => {
  let now = new Date("2026-01-01T00:00:00Z");
  const service = new RateLimitService(new MemoryRateLimitProvider(), "closed", () => now);
  for (let index = 0; index < 6; index++) await service.check("fallback_auth", "one");
  assert.equal((await service.check("fallback_auth", "two")).allowed, true);
  now = new Date("2026-01-01T00:16:00Z");
  assert.equal((await service.check("fallback_auth", "one")).allowed, true);
});

test("production-style fail-closed behavior denies provider failures", async () => {
  const service = new RateLimitService({ consume: async () => { throw new Error("provider secret"); } }, "closed");
  const result = await service.check("funding_decision", "actor");
  assert.equal(result.allowed, false);
  assert.equal(result.failureReason, "provider_unavailable");
});
