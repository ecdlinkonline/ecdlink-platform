import assert from "node:assert/strict";
import test from "node:test";
import { internalAuditActorId } from "../../../lib/auth/audit-actor";

test("centre audit actor uses the internal Prisma user id", () => {
  assert.equal(
    internalAuditActorId({ internalUser: { id: "internal-user-id" } }),
    "internal-user-id"
  );
});
