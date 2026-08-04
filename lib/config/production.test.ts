import assert from "node:assert/strict";
import test from "node:test";
import { parseProductionEnvironment, validateProductionEnvironment } from "./production";

function validEnvironment(): Record<string, string> {
  return {
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://user:password@pool.example.test/app?sslmode=require",
    DIRECT_URL: "postgresql://user:password@direct.example.test/app?sslmode=require",
    USE_MOCK_DATA: "false",
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_production_test_key",
    CLERK_SECRET_KEY: "sk_live_production_test_key",
    CLERK_WEBHOOK_SECRET: "whsec_production_test_secret",
    AUTH_SECRET: "a-production-auth-secret-with-32-characters",
    SUPABASE_URL: "https://project.example.test",
    SUPABASE_SERVICE_ROLE_KEY: "server-only-storage-key-for-tests",
    SUPABASE_STORAGE_BUCKET: "ecdlink-private",
    SUPABASE_SIGNED_URL_TTL_SECONDS: "300",
    EMAIL_PROVIDER: "noop",
    EMAIL_FROM: "",
    EMAIL_REPLY_TO: "",
    APP_BASE_URL: "https://app.example.test",
    RESEND_API_KEY: "",
    EMAIL_REQUEST_TIMEOUT_MS: "10000",
    EMAIL_MAX_ATTEMPTS: "3",
    READINESS_CHECK_TIMEOUT_MS: "5000",
    RATE_LIMIT_PROVIDER: "upstash",
    RATE_LIMIT_FAIL_MODE: "closed",
    RATE_LIMIT_IDENTIFIER_SECRET: "rate-limit-identifier-secret-for-tests",
    UPSTASH_REDIS_REST_URL: "https://redis.example.test",
    UPSTASH_REDIS_REST_TOKEN: "upstash-rest-token-for-tests",
    ECDLINK_ENABLE_FALLBACK_ADMIN: "false",
    TRUSTED_APP_ORIGINS: "https://app.example.test",
    UPLOAD_REQUEST_MAX_BYTES: "12000000",
    ECDLINK_FALLBACK_ADMIN_EMAIL: "",
    ECDLINK_FALLBACK_ADMIN_PASSWORD: "",
  };
}

test("accepts a complete production environment and returns typed numeric settings", () => {
  const configuration = parseProductionEnvironment(validEnvironment());
  assert.equal(configuration.SUPABASE_SIGNED_URL_TTL_SECONDS, 300);
  assert.equal(configuration.EMAIL_MAX_ATTEMPTS, 3);
});

test("rejects test Clerk keys, mock data and non-HTTPS application URLs", () => {
  const environment = { ...validEnvironment(), NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_unsafe", USE_MOCK_DATA: "true", APP_BASE_URL: "http://localhost:3000" };
  const result = validateProductionEnvironment(environment);
  assert.equal(result.valid, false);
  if (!result.valid) assert.deepEqual(new Set(result.invalidFields), new Set(["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "USE_MOCK_DATA", "APP_BASE_URL"]));
});

test("requires Resend sender and API key only when Resend is enabled", () => {
  const result = validateProductionEnvironment({ ...validEnvironment(), EMAIL_PROVIDER: "resend" });
  assert.equal(result.valid, false);
  if (!result.valid) assert.deepEqual(new Set(result.invalidFields), new Set(["RESEND_API_KEY", "EMAIL_FROM"]));
});

test("rejects fallback credentials unless emergency access is explicitly enabled", () => {
  const result = validateProductionEnvironment({ ...validEnvironment(), ECDLINK_FALLBACK_ADMIN_EMAIL: "admin@example.test", ECDLINK_FALLBACK_ADMIN_PASSWORD: "a-strong-fallback-password" });
  assert.equal(result.valid, false);
});

test("requires a shared fail-closed production rate-limit provider", () => {
  const result = validateProductionEnvironment({ ...validEnvironment(), RATE_LIMIT_PROVIDER: "memory", RATE_LIMIT_FAIL_MODE: "open" });
  assert.equal(result.valid, false);
  if (!result.valid) assert.ok(result.invalidFields.includes("RATE_LIMIT_PROVIDER") && result.invalidFields.includes("RATE_LIMIT_FAIL_MODE"));
});

test("requires a bounded integer readiness timeout", () => {
  for (const value of ["499", "15001", "1000.5"]) {
    const result = validateProductionEnvironment({ ...validEnvironment(), READINESS_CHECK_TIMEOUT_MS: value });
    assert.equal(result.valid, false);
    if (!result.valid) assert.ok(result.invalidFields.includes("READINESS_CHECK_TIMEOUT_MS"));
  }
});
