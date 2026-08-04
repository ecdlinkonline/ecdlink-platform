import assert from "node:assert/strict";
import test from "node:test";
import { StorageAccessError } from "@/lib/storage/errors";
import {
  assertFundingDocumentAccess,
  buildFundingDocumentResubmissionUpdate,
  buildFundingDocumentUploadAuditMetadata,
  buildFundingDocumentUploadUpdate,
  buildFundingDocumentVerificationUpdate,
  FundingDocumentService,
  FundingDocumentServiceError,
  type AuthorizedFundingDocument,
  type FundingDocumentAccessRecord,
  type FundingDocumentPersistence,
  type FundingDocumentStorage,
} from "@/lib/services/funding-documents";

const document: AuthorizedFundingDocument = {
  id: "document-1",
  label: "Bank letter",
  fundingProfileId: "profile-1",
  status: "IN_PROGRESS",
  fileId: "file-old",
  note: "Existing note",
  uploadedAt: new Date("2026-08-01T00:00:00Z"),
  verifiedAt: new Date("2026-08-02T00:00:00Z"),
  profile: { centreId: "centre-1", fundingOrganisationIds: ["organisation-1"] },
};

function accessRecord(role: "SUPER_ADMIN" | "FUNDING_ORGANISATION", organisationIds: string[] = []): FundingDocumentAccessRecord {
  return { actor: { id: "actor-1", role, status: "ACTIVE", fundingOrganisationIds: organisationIds }, document };
}

function serviceMocks(record: FundingDocumentAccessRecord = accessRecord("SUPER_ADMIN")) {
  let previewCalls = 0;
  let linked: Parameters<FundingDocumentPersistence["linkUploadedFile"]>[0] | undefined;
  const persistence: FundingDocumentPersistence = {
    loadAccessRecord: async () => record,
    linkUploadedFile: async (input) => { linked = input; return input; },
    verifyDocument: async (input) => input,
    requestResubmission: async (input) => input,
  };
  const file = { id: "file-new", originalFilename: "bank.pdf", mimeType: "application/pdf", fileSize: 6, checksum: "checksum", createdAt: new Date() };
  const storage: FundingDocumentStorage = {
    uploadFileAsset: async () => file,
    createPreviewAccess: async () => { previewCalls += 1; return { url: "https://signed.example", expiresAt: new Date(), originalFilename: "bank.pdf", mimeType: "application/pdf", previewable: true }; },
    createDownloadAccess: async () => ({ url: "https://signed.example", expiresAt: new Date(), originalFilename: "bank.pdf", mimeType: "application/pdf", previewable: true }),
  };
  return { service: new FundingDocumentService(persistence, storage), storage, file, linked: () => linked, previewCalls: () => previewCalls };
}

test("Super Admin can access any funding document", () => {
  assert.equal(assertFundingDocumentAccess(accessRecord("SUPER_ADMIN")).id, document.id);
});

test("Funding Partner can access a matching organisation document", () => {
  assert.equal(assertFundingDocumentAccess(accessRecord("FUNDING_ORGANISATION", ["organisation-1"])).id, document.id);
});

test("Funding Partner is denied for an unrelated organisation", () => {
  assert.throws(() => assertFundingDocumentAccess(accessRecord("FUNDING_ORGANISATION", ["organisation-2"])), FundingDocumentServiceError);
});

test("upload links the new FileAsset and exposes complete audit metadata", async () => {
  const mocks = serviceMocks();
  const bytes = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
  await mocks.service.uploadFundingSupportingDocument({ documentId: document.id, actorUserId: "actor-1", file: { name: "bank.pdf", type: "application/pdf", size: bytes.byteLength, arrayBuffer: async () => bytes.buffer } });
  assert.equal(mocks.linked()?.document.fileId, "file-old");
  assert.equal(mocks.linked()?.file.id, "file-new");
  assert.deepEqual(buildFundingDocumentUploadAuditMetadata(document, mocks.file, "actor-1"), {
    documentId: "document-1", previousFileId: "file-old", newFileId: "file-new", actorUserId: "actor-1", mimeType: "application/pdf", fileSize: 6,
  });
  const update = buildFundingDocumentUploadUpdate("file-new", new Date(0));
  assert.equal(update.status, "COMPLETE");
  assert.equal(update.verifiedAt, null);
});

test("verification requires a linked file", async () => {
  const mocks = serviceMocks({ ...accessRecord("SUPER_ADMIN"), document: { ...document, fileId: null } });
  await assert.rejects(() => mocks.service.verifyFundingSupportingDocument({ documentId: document.id, actorUserId: "actor-1" }), FundingDocumentServiceError);
});

test("verification appends notes without changing fileId or uploadedAt", () => {
  const update = buildFundingDocumentVerificationUpdate(document, "Looks valid", new Date(0));
  assert.equal(update.note, "Existing note\nReviewer comment: Looks valid");
  assert.equal("fileId" in update, false);
  assert.equal("uploadedAt" in update, false);
});

test("resubmission preserves the file, clears verification and appends labelled notes", () => {
  const update = buildFundingDocumentResubmissionUpdate(document, "Page is illegible", "Please rescan");
  assert.equal(update.status, "IN_PROGRESS");
  assert.equal(update.verifiedAt, null);
  assert.equal("fileId" in update, false);
  assert.equal(update.note, "Existing note\nResubmission requested: Page is illegible\nReviewer comment: Please rescan");
});

test("unsupported previews are safely denied by the storage boundary", async () => {
  const mocks = serviceMocks();
  mocks.storage.createPreviewAccess = async () => { throw new StorageAccessError("This file type is download-only.", 422); };
  await assert.rejects(() => mocks.service.getFundingDocumentPreviewAccess({ documentId: document.id, actorUserId: "actor-1" }), StorageAccessError);
});

test("unauthorized access never creates a signed URL", async () => {
  const mocks = serviceMocks(accessRecord("FUNDING_ORGANISATION", ["organisation-2"]));
  await assert.rejects(() => mocks.service.getFundingDocumentPreviewAccess({ documentId: document.id, actorUserId: "actor-1" }), FundingDocumentServiceError);
  assert.equal(mocks.previewCalls(), 0);
});
