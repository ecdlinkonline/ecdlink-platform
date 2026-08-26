import assert from "node:assert/strict";
import test from "node:test";
import { authoritativeApplicationRole, hasAuthoritativeRole } from "./authorization";
import { clerkIdentityUpdate } from "./clerk-sync";
import { isSelfServiceRole } from "./role-mapping";

test("client metadata cannot grant Super Admin or ECDLink Staff authorization", () => {
  const databaseUser = { role: "ECD_CENTRE" as const, status: "ACTIVE" as const };
  const untrustedMetadata = { unsafeMetadata: { role: "super_admin" }, publicMetadata: { role: "ecdlink_staff" } };

  assert.equal(authoritativeApplicationRole(databaseUser), "ecd_centre");
  assert.equal(hasAuthoritativeRole(databaseUser, "super_admin"), false);
  assert.equal(hasAuthoritativeRole(databaseUser, "ecdlink_staff"), false);
  assert.deepEqual(untrustedMetadata.unsafeMetadata, { role: "super_admin" });
});

test("database Super Admin is authorized and database non-admin is denied", () => {
  assert.equal(hasAuthoritativeRole({ role: "SUPER_ADMIN", status: "ACTIVE" }, "super_admin"), true);
  assert.equal(hasAuthoritativeRole({ role: "SUPPLIER", status: "ACTIVE" }, "super_admin"), false);
});

test("self-service onboarding excludes privileged roles", () => {
  assert.equal(isSelfServiceRole("super_admin"), false);
  assert.equal(isSelfServiceRole("ecdlink_staff"), false);
  assert.equal(isSelfServiceRole("ecd_centre"), true);
  assert.equal(isSelfServiceRole("supplier"), true);
});

test("inactive users have no authoritative role", () => {
  assert.equal(authoritativeApplicationRole({ role: "SUPER_ADMIN", status: "SUSPENDED" }), null);
  assert.equal(authoritativeApplicationRole({ role: "SUPER_ADMIN", status: "ARCHIVED" }), null);
  assert.equal(authoritativeApplicationRole({ role: "SUPER_ADMIN", status: "INVITED" }), null);
});

test("Clerk identity synchronization cannot overwrite database role or status", () => {
  const webhookIdentity = {
    email: "user@example.org",
    firstName: "User",
    unsafeMetadata: { role: "super_admin" },
    publicMetadata: { role: "ecdlink_staff" },
    status: "ACTIVE"
  };
  const update = clerkIdentityUpdate(webhookIdentity, new Date("2026-08-25T00:00:00.000Z"));
  assert.equal("role" in update, false);
  assert.equal("status" in update, false);
  assert.equal("unsafeMetadata" in update, false);
  assert.equal("publicMetadata" in update, false);
  assert.equal(update.email, "user@example.org");
});
