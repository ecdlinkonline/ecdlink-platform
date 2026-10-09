import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { removeGrantReportDocumentFromMutableVersion, requireDraftVersionMutationFence } from "./grant-report-documents";

test("draft evidence removal is version scoped, audited and retains the private FileAsset", async () => {
  const calls: Array<{ operation: string; args: Record<string, unknown> }> = [];
  const document = { id: "document-1", fileAssetId: "file-1", documentType: "INVOICE", title: "Invoice", indicatorId: null, financialLineId: "line-1" };
  const tx = {
    grantReportVersion: { updateMany: async (args: Record<string, unknown>) => { calls.push({ operation: "fence", args }); return { count: 1 }; } },
    grantReportDocument: {
      findFirst: async (args: Record<string, unknown>) => { calls.push({ operation: "find", args }); return document; },
      delete: async (args: Record<string, unknown>) => { calls.push({ operation: "delete", args }); return document; },
    },
    auditLog: { create: async (args: Record<string, unknown>) => { calls.push({ operation: "audit", args }); return {}; } },
  };
  const result = await removeGrantReportDocumentFromMutableVersion(tx as never, { reportId: "report-1", documentId: "document-1", actorUserId: "user-1", grantReportVersionId: "version-1" });
  assert.deepEqual(calls[0].args.where, { id: "version-1", status: "DRAFT", submittedAt: null });
  assert.deepEqual((calls[1].args.where), { id: "document-1", grantReportVersionId: "version-1" });
  assert.deepEqual(calls.map((call) => call.operation), ["fence", "find", "delete", "audit"]);
  const audit = (calls[3].args.data as { action: string; actorUserId: string; metadata: { retainedPrivateFile: boolean; fileAssetId: string } });
  assert.equal(audit.action, "grant.report.document.removed");
  assert.equal(audit.actorUserId, "user-1");
  assert.deepEqual(audit.metadata, { reportId: "report-1", grantReportVersionId: "version-1", fileAssetId: "file-1", retainedPrivateFile: true });
  assert.deepEqual(result, { id: "document-1", removedFromReport: true, retainedPrivateFile: true });
  assert.equal("fileAsset" in tx, false);
});

test("cross-version document removal is rejected without delete or audit", async () => {
  let deleted = false;
  let audited = false;
  const tx = {
    grantReportVersion: { updateMany: async () => ({ count: 1 }) },
    grantReportDocument: { findFirst: async () => null, delete: async () => { deleted = true; } },
    auditLog: { create: async () => { audited = true; } },
  };
  await assert.rejects(() => removeGrantReportDocumentFromMutableVersion(tx as never, { reportId: "report-1", documentId: "other-version-document", actorUserId: "user-1", grantReportVersionId: "version-1" }), /not found/i);
  assert.equal(deleted, false);
  assert.equal(audited, false);
});

test("a lost submission race blocks evidence mutation before document and audit writes", async () => {
  let documentAccessed = false;
  let audited = false;
  const tx = {
    grantReportVersion: { updateMany: async () => ({ count: 0 }) },
    grantReportDocument: {
      findFirst: async () => { documentAccessed = true; return null; },
      delete: async () => { documentAccessed = true; },
    },
    auditLog: { create: async () => { audited = true; } },
  };
  await assert.rejects(
    () => removeGrantReportDocumentFromMutableVersion(tx as never, { reportId: "report-1", documentId: "document-1", actorUserId: "user-1", grantReportVersionId: "version-1" }),
    /immutable/i,
  );
  assert.equal(documentAccessed, false);
  assert.equal(audited, false);
});

test("draft-version mutation fence requires an unsubmitted DRAFT row", async () => {
  let where: unknown;
  await requireDraftVersionMutationFence({ grantReportVersion: { updateMany: async (args: { where: unknown }) => { where = args.where; return { count: 1 }; } } } as never, "version-1");
  assert.deepEqual(where, { id: "version-1", status: "DRAFT", submittedAt: null });
});

test("report document mutations preserve mutable-version and same-version linkage guards", () => {
  const source = readFileSync(new URL("./grant-report-documents.ts", import.meta.url), "utf8");
  assert.match(source, /requireMutableGrantReport\(tx, input\.reportId\)/);
  assert.match(source, /requireDraftVersionMutationFence\(tx, current\.version\.id\)/);
  assert.ok(source.indexOf("requireDraftVersionMutationFence(tx, current.version.id)") < source.indexOf("grantReportDocument.create"));
  assert.match(source, /grantReportIndicator\.findFirst\(\{ where: \{ id: input\.metadata\.indicatorId, grantReportVersionId: current\.version\.id \}/);
  assert.match(source, /grantReportFinancialLine\.findFirst\(\{ where: \{ id: input\.metadata\.financialLineId, grantReportVersionId: current\.version\.id \}/);
  assert.match(source, /grant\.report\.document\.uploaded/);
  assert.match(source, /grant\.report\.document\.removed/);
  assert.doesNotMatch(source, /removeForRollback\(document|deleteFileAsset/);
});
