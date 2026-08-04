import assert from "node:assert/strict";
import test from "node:test";
import { buildFundingNotifications } from "./builders";

test("builds typed funding notifications and removes duplicate recipients and the actor", () => {
  const notifications = buildFundingNotifications(
    { type: "FUNDING_APPLICATION_APPROVED", applicationId: "application-1", actorUserId: "actor-1" },
    { recipientUserIds: ["user-1", "user-1", "actor-1"], centreId: "centre-1", centreName: "Sunrise ECD" },
  );
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].module, "FUNDING");
  assert.equal(notifications[0].type, "FUNDING_APPLICATION_APPROVED");
  assert.equal(notifications[0].recipientUserId, "user-1");
  assert.deepEqual(notifications[0].metadata, { entityId: "application-1" });
});

test("does not include workflow free text in notification metadata", () => {
  const [notification] = buildFundingNotifications(
    { type: "FUNDING_DOCUMENT_RESUBMISSION_REQUESTED", documentId: "document-1", actorUserId: "actor-1" },
    { recipientUserIds: ["user-1"], centreId: "centre-1" },
  );
  assert.deepEqual(notification.metadata, { entityId: "document-1" });
});
