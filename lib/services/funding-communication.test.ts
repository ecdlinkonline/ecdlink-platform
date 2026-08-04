import assert from "node:assert/strict";
import test from "node:test";
import { canAccessFundingApplication } from "./funding-communication";
import { fundingManualCommunicationSchema, fundingReviewerNoteSchema } from "@/lib/validators/funding-communication";
import { projectFundingCommunicationTimeline } from "@/lib/repositories/funding-communication";

test("Super Admin can access every funding application", () => assert.equal(canAccessFundingApplication({ status: "ACTIVE", role: "SUPER_ADMIN", fundingOrganisationIds: [] }, "org-1"), true));
test("Funding Partner access is scoped to its funding organisation", () => {
  const actor = { status: "ACTIVE", role: "FUNDING_ORGANISATION", fundingOrganisationIds: ["org-1"] };
  assert.equal(canAccessFundingApplication(actor, "org-1"), true);
  assert.equal(canAccessFundingApplication(actor, "org-2"), false);
  assert.equal(canAccessFundingApplication(actor, null), false);
});
test("inactive and unrelated users cannot access collaboration", () => assert.equal(canAccessFundingApplication({ status: "ARCHIVED", role: "SUPER_ADMIN", fundingOrganisationIds: [] }, "org-1"), false));
test("note and manual communication validation trims required plain text", () => {
  assert.deepEqual(fundingReviewerNoteSchema.parse({ body: "  note  " }), { body: "note" });
  assert.deepEqual(fundingManualCommunicationSchema.parse({ type: "MANUAL", title: " Update ", body: " Body " }), { type: "MANUAL", title: "Update", body: "Body" });
  assert.equal(fundingManualCommunicationSchema.safeParse({ type: "EMAIL", title: "No", body: "No" }).success, false);
});
test("timeline projection excludes soft-deleted notes and retains communication keys", () => {
  const now = new Date("2026-08-04T10:00:00Z");
  const result = projectFundingCommunicationTimeline([{ id: "c1", type: "APPLICATION_APPROVED", title: "Approved", body: "Done", createdAt: now, sourceEventKey: "funding.application.approved:a1:event" }], [{ id: "n1", body: "Visible", createdAt: now, updatedAt: now, deletedAt: null }, { id: "n2", body: "Hidden", createdAt: now, updatedAt: now, deletedAt: now }]);
  assert.equal(result.length, 2);
  assert.equal(result.some((item) => item.description === "Hidden"), false);
  assert.equal(result[0].sourceEventKey, "funding.application.approved:a1:event");
});
