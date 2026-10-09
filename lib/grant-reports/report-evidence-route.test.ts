import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("evidence list and upload authorize through the database-backed report admin before repository access", () => {
  const source = readFileSync("app/api/grant-reports/[reportId]/documents/route.ts", "utf8");
  const getSource = source.slice(source.indexOf("export async function GET"), source.indexOf("export async function POST"));
  const postSource = source.slice(source.indexOf("export async function POST"));
  assert.ok(getSource.indexOf("requireReportAdmin()") < getSource.indexOf("getGrantReportEvidenceList"));
  assert.ok(postSource.indexOf("requireReportAdmin()") < postSource.indexOf("uploadGrantReportDocument"));
  assert.match(postSource, /requireTrustedOrigin\(request\)/);
  assert.match(postSource, /enforceRateLimit\("funding_document_upload", context\.internalUser\.id\)/);
  assert.match(postSource, /validateUploadRequest\(request\)/);
  assert.match(postSource, /financialLineId: formData\.get\("financialLineId"\)/);
});

test("evidence access and removal authorize before scoped service calls", () => {
  const source = readFileSync("app/api/grant-reports/[reportId]/documents/[documentId]/route.ts", "utf8");
  const getSource = source.slice(source.indexOf("export async function GET"), source.indexOf("export async function DELETE"));
  const deleteSource = source.slice(source.indexOf("export async function DELETE"));
  assert.ok(getSource.indexOf("requireReportAdmin()") < getSource.indexOf("getGrantReportDocumentPreview"));
  assert.ok(deleteSource.indexOf("requireReportAdmin()") < deleteSource.indexOf("removeGrantReportDocument"));
  assert.match(deleteSource, /requireTrustedOrigin\(request\)/);
  assert.doesNotMatch(source, /storageKey|SUPABASE_SERVICE_ROLE_KEY/);
});
