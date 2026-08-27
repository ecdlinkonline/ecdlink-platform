import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { StorageAccessError, StorageValidationError } from "@/lib/storage/errors";
import { StorageService, type StoragePersistence } from "@/lib/storage/storage-service";
import type { StorageProviderAdapter } from "@/lib/storage/storage-provider";
import { validateStorageFile } from "@/lib/storage/validation";
import { grantAwardAgreementPolicy } from "@/lib/services/grant-award-agreements";

function file(name: string, type: string, content: Uint8Array, declaredSize = content.byteLength) {
  const buffer = new ArrayBuffer(content.byteLength);
  new Uint8Array(buffer).set(content);
  return { name, type, size: declaredSize, arrayBuffer: async () => buffer };
}

test("signed agreement validation accepts PDF and rejects non-PDF and oversized files", async () => {
  const pdf = Uint8Array.from([0x25,0x50,0x44,0x46,0x2d,0x31]);
  assert.equal((await validateStorageFile(file("award.pdf", "application/pdf", pdf), grantAwardAgreementPolicy)).mimeType, "application/pdf");
  await assert.rejects(() => validateStorageFile(file("award.png", "image/png", Uint8Array.from([1,2,3])), grantAwardAgreementPolicy), StorageValidationError);
  await assert.rejects(() => validateStorageFile(file("award.pdf", "application/pdf", pdf, grantAwardAgreementPolicy.maxBytes + 1), grantAwardAgreementPolicy), StorageValidationError);
});

test("staged rollback rejects a different uploader before deleting metadata or storage", async () => {
  let deleted = false;
  let removed = false;
  const provider: StorageProviderAdapter = { upload: async () => { throw new Error("unused"); }, createSignedUrl: async () => "unused", exists: async () => true, removeForRollback: async () => { removed = true; } };
  const persistence: StoragePersistence = {
    createFileAsset: async () => { throw new Error("unused"); },
    findFileAsset: async (id) => ({ id, storageProvider:"supabase",storageKey:`funding/owner/grant-award-staging/${id}/award.pdf`,originalFilename:"award.pdf",mimeType:"application/pdf",fileSize:6,checksum:"hash",uploadedByUserId:"owner",createdAt:new Date(0) }),
    deleteFileAssetForRollback: async () => { deleted = true; return null; },
    recordAccess: async () => undefined,
  };
  const service = new StorageService(provider,persistence,{signedUrlTtlSeconds:300});
  await assert.rejects(() => service.rollbackStagedFileAsset({fileAssetId:"asset-1",uploadedByUserId:"attacker",module:"funding",ownerId:"attacker",entityId:"grant-award-staging"}),StorageAccessError);
  assert.equal(deleted,false);
  assert.equal(removed,false);
});

test("valid staged rollback removes metadata before invoking provider rollback", async () => {
  const events: string[]=[];
  const provider: StorageProviderAdapter = { upload:async()=>{throw new Error("unused");},createSignedUrl:async()=>"unused",exists:async()=>true,removeForRollback:async()=>{events.push("storage");} };
  const record={id:"asset-1",storageProvider:"supabase",storageKey:"funding/owner/grant-award-staging/asset-1/award.pdf",originalFilename:"award.pdf",mimeType:"application/pdf",fileSize:6,checksum:"hash",uploadedByUserId:"owner",createdAt:new Date(0)};
  const persistence: StoragePersistence={createFileAsset:async()=>{throw new Error("unused");},findFileAsset:async()=>record,deleteFileAssetForRollback:async()=>{events.push("metadata");return record;},recordAccess:async()=>undefined};
  await new StorageService(provider,persistence,{signedUrlTtlSeconds:300}).rollbackStagedFileAsset({fileAssetId:"asset-1",uploadedByUserId:"owner",module:"funding",ownerId:"owner",entityId:"grant-award-staging"});
  assert.deepEqual(events,["metadata","storage"]);
});

test("the business-facing form hides technical organisation controls and exposes agreement sections", () => {
  const source = readFileSync("components/reports/grant-award-dialog.tsx","utf8");
  assert.doesNotMatch(source,/Lead Organisation Type|Organisation Role/);
  assert.match(source,/Lead Funder/);
  assert.match(source,/Lead Donor/);
  assert.match(source,/Funding Partner Type/);
  assert.match(source,/Signed Grant Agreement \/ Award Contract/);
  assert.match(source,/1\. Funding Source[\s\S]*2\. Award Details[\s\S]*3\. Signed Agreement[\s\S]*4\. Reporting Permissions/);
});

test("agreement upload and private access routes use database-backed Super Admin authorization and return no storage paths", () => {
  const uploadRoute = readFileSync("app/api/grant-awards/agreements/stage/route.ts","utf8");
  const uploadHandler = readFileSync("lib/grant-reports/agreement-stage-route.ts","utf8");
  const accessRoute = readFileSync("app/api/grant-awards/[awardId]/agreement/route.ts","utf8");
  assert.match(uploadRoute,/authorize: requireReportAdmin/);
  assert.match(uploadHandler,/dependencies\.authorize\(\)/);
  assert.match(uploadHandler,/context\.internalUser\.id/);
  assert.match(accessRoute,/requireReportAdmin\(\)/);
  assert.doesNotMatch(uploadRoute + uploadHandler + accessRoute,/unsafeMetadata|publicMetadata|storageKey|DATABASE_URL/);
  assert.match(accessRoute,/NextResponse\.redirect\(access\.url, 302\)/);
});
