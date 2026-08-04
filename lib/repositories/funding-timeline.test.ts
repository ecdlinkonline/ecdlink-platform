import assert from "node:assert/strict";
import test from "node:test";
import { buildFundingTimeline } from "@/lib/repositories/funding";

const profile = {
  id: "profile-1",
  centreId: "centre-1",
  readinessScore: 80,
  status: "UNDER_REVIEW",
  readinessStatus: "READY",
  proposalReady: true,
  budgetReady: true,
  adminNotes: null,
  recommendedActions: [],
  lastAssessmentDate: null,
  updatedAt: new Date("2026-08-01T00:00:00Z"),
  projects: [],
  reminders: [],
  supportingDocuments: [{
    id: "document-1",
    label: "Bank letter",
    documentType: "Bank confirmation",
    status: "COMPLETE",
    note: null,
    fileId: "file-1",
    uploadedAt: new Date("2026-08-02T00:00:00Z"),
    verifiedAt: new Date("2026-08-03T00:00:00Z"),
    updatedAt: new Date("2026-08-03T00:00:00Z"),
    file: { id: "file-1", originalFilename: "bank.pdf", mimeType: "application/pdf", fileSize: 100 },
  }],
};

test("document audits replace matching fallback timestamps without suppressing other legacy events", () => {
  const timeline = buildFundingTimeline(profile, [
    { id: "audit-upload", action: "funding.document.uploaded", entityId: "document-1", createdAt: new Date("2026-08-04T00:00:00Z") },
    { id: "audit-resubmit", action: "funding.document.resubmission.requested", entityId: "document-1", createdAt: new Date("2026-08-05T00:00:00Z") },
  ]);
  assert.equal(timeline.filter((item) => item.title === "Supporting document uploaded").length, 1);
  assert.equal(timeline.filter((item) => item.title === "Supporting document verified").length, 1);
  assert.equal(timeline.filter((item) => item.title === "Document resubmission requested").length, 1);
  assert.ok(timeline.some((item) => item.id === "audit-audit-upload"));
  assert.ok(timeline.some((item) => item.id === "document-document-1-verified"));
});
