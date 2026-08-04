import assert from "node:assert/strict";
import test from "node:test";
import { buildContentSecurityPolicy } from "./content-security-policy";
import { buildSecurityHeaders } from "./headers";

test("production CSP is static, restrictive and provider-compatible", () => {
  const policy = buildContentSecurityPolicy("production");
  for (const directive of ["default-src 'self'", "base-uri 'self'", "object-src 'none'", "frame-ancestors 'none'", "form-action 'self'", "worker-src 'self' blob:", "upgrade-insecure-requests"]) assert.ok(policy.includes(directive));
  assert.ok(policy.includes("https://*.clerk.com"));
  assert.ok(policy.includes("https://*.clerk.accounts.dev"));
  assert.ok(policy.includes("https://*.supabase.co"));
  assert.equal(policy.includes("'unsafe-eval'"), false);
  assert.ok(policy.includes("script-src 'self' 'unsafe-inline' https://*.clerk.com https://*.clerk.accounts.dev"));
  assert.equal(policy.split(/\s+/).includes("*"), false);
});

test("development adds only unsafe-eval to the production policy", () => {
  const production = buildContentSecurityPolicy("production");
  const development = buildContentSecurityPolicy("development");
  assert.equal(development, production.replace("script-src 'self' 'unsafe-inline' https://*.clerk.com https://*.clerk.accounts.dev;", "script-src 'self' 'unsafe-inline' https://*.clerk.com https://*.clerk.accounts.dev 'unsafe-eval';"));
});

test("required headers are present and HSTS is production-only", () => {
  const production = new Map(buildSecurityHeaders("production").map((header) => [header.key, header.value]));
  for (const header of ["Content-Security-Policy", "X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy", "Cross-Origin-Opener-Policy", "Cross-Origin-Resource-Policy", "Strict-Transport-Security"]) assert.ok(production.has(header));
  assert.equal(production.get("X-Content-Type-Options"), "nosniff");
  assert.equal(new Map(buildSecurityHeaders("development").map((header) => [header.key, header.value])).has("Strict-Transport-Security"), false);
});
