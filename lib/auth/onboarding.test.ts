import assert from "node:assert/strict";
import test from "node:test";
import { isAwaitingSelfServiceOnboarding, selfServiceOnboardingCompletionData, selfServiceOnboardingEligibilityWhere } from "./onboarding";

const awaiting = { role: "ECD_CENTRE" as const, roleId: null, status: "INVITED" as const };

test("a genuine newly created user is eligible for first-time onboarding", () => {
  assert.equal(isAwaitingSelfServiceOnboarding(awaiting), true);
  assert.deepEqual(selfServiceOnboardingEligibilityWhere("user-1"), {
    id: "user-1",
    status: "INVITED",
    role: "ECD_CENTRE",
    roleId: null,
    centreUsers: { none: {} },
    supplierUsers: { none: {} },
    donorUsers: { none: {} },
    fundingUsers: { none: {} },
    ecdlinkStaffProfile: null
  });
  assert.deepEqual(selfServiceOnboardingCompletionData("DONOR", "donor-role"), {
    role: "DONOR",
    roleId: "donor-role",
    status: "ACTIVE"
  });
});

test("administrator-assigned DONOR cannot change to FUNDING_ORGANISATION through onboarding", () => {
  assert.equal(isAwaitingSelfServiceOnboarding({ role: "DONOR", roleId: "donor-role", status: "ACTIVE" }), false);
});

test("administrator-assigned SUPPLIER cannot change to DONOR through onboarding", () => {
  assert.equal(isAwaitingSelfServiceOnboarding({ role: "SUPPLIER", roleId: "supplier-role", status: "ACTIVE" }), false);
});

test("administrator-assigned ECD_CENTRE is no longer an onboarding placeholder", () => {
  assert.equal(isAwaitingSelfServiceOnboarding({ role: "ECD_CENTRE", roleId: "centre-role", status: "INVITED" }), false);
});

test("SUPER_ADMIN cannot self-change through onboarding", () => {
  assert.equal(isAwaitingSelfServiceOnboarding({ role: "SUPER_ADMIN", roleId: "admin-role", status: "ACTIVE" }), false);
});

test("ECDLINK_STAFF cannot self-change through onboarding", () => {
  assert.equal(isAwaitingSelfServiceOnboarding({ role: "ECDLINK_STAFF", roleId: "staff-role", status: "ACTIVE" }), false);
});

test("a suspended user cannot onboard", () => {
  assert.equal(isAwaitingSelfServiceOnboarding({ ...awaiting, status: "SUSPENDED" }), false);
});

test("an administrator assignment before the conditional update invalidates the onboarding claim", () => {
  const stateAfterAdministratorAssignment = { role: "DONOR" as const, roleId: "donor-role", status: "ACTIVE" as const };
  assert.equal(isAwaitingSelfServiceOnboarding(stateAfterAdministratorAssignment), false);
});
