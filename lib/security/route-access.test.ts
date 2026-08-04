import assert from "node:assert/strict";
import test from "node:test";
import { isPublicApiPath, requiresAuthentication } from "./route-access";

test("only intended API exceptions are public", () => {
  for (const path of ["/api/health", "/api/health/ready", "/api/auth/callback/credentials", "/api/clerk/webhook"]) assert.equal(isPublicApiPath(path), true);
  for (const path of ["/api/funding/applications", "/api/notifications", "/api/clerk/webhook/extra", "/api/healthcheck"]) assert.equal(requiresAuthentication(path), true);
});

test("all dashboard surfaces remain protected", () => {
  for (const path of ["/dashboard", "/dashboard/funding-partner", "/ecdlink/dashboard", "/admin/users", "/supplier/orders", "/donor/projects", "/funding/review"]) assert.equal(requiresAuthentication(path), true);
});
