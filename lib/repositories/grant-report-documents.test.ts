import assert from "node:assert/strict";
import test from "node:test";
import { listGrantReportEvidence } from "./grant-report-documents";

test("evidence listing is version scoped, paginated and uses one bounded query", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const client = { grantReportVersion: { findFirst: async (args: Record<string, unknown>) => {
    calls.push(args);
    return {
      id: "version-2", status: "DRAFT", report: { status: "DRAFT", currentVersionNumber: 2 }, _count: { documents: 23 },
      documents: [{
        id: "document-1", documentType: "INVOICE", title: "Nutrition invoice", description: "April supplies",
        originalFilenameSnapshot: "invoice.pdf", mimeTypeSnapshot: "application/pdf", fileSizeSnapshot: 1024,
        uploadedAt: new Date("2026-10-01T10:00:00.000Z"),
        indicator: null, financialLine: { id: "line-1", lineType: "EXPENDITURE", categoryName: "Nutrition" },
        uploadedBy: { firstName: "Admin", lastName: "User", email: "admin@example.test" },
      }],
    };
  } } };

  const result = await listGrantReportEvidence({ reportId: "report-1", versionNumber: 2, page: 2, pageSize: 20 }, client as never);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].where, { grantReportId: "report-1", versionNumber: 2 });
  const select = calls[0].select as { documents: { skip: number; take: number; select: Record<string, unknown> }; _count: unknown };
  assert.equal(select.documents.skip, 20);
  assert.equal(select.documents.take, 20);
  assert.ok(select._count);
  assert.equal("file" in select.documents.select, false);
  assert.equal("storageKey" in select.documents.select, false);
  assert.equal(result?.documents[0].financialLine?.label, "Nutrition");
  assert.deepEqual(result?.pagination, { page: 2, pageSize: 20, total: 23, totalPages: 2, hasPreviousPage: true, hasNextPage: false });
  assert.equal(result?.version.editable, true);
});

test("evidence listing caps page size and marks submitted versions read-only", async () => {
  const client = { grantReportVersion: { findFirst: async (args: { select: { documents: { take: number } } }) => {
    assert.equal(args.select.documents.take, 50);
    return { id: "version-1", status: "SUBMITTED", report: { status: "SUBMITTED", currentVersionNumber: 1 }, _count: { documents: 0 }, documents: [] };
  } } };
  const result = await listGrantReportEvidence({ reportId: "report-1", versionNumber: 1, page: 1, pageSize: 500 }, client as never);
  assert.equal(result?.version.editable, false);
  assert.equal(result?.pagination.pageSize, 50);
});

test("unknown report versions return no evidence without a fallback lookup", async () => {
  let calls = 0;
  const client = { grantReportVersion: { findFirst: async () => { calls += 1; return null; } } };
  assert.equal(await listGrantReportEvidence({ reportId: "missing", versionNumber: 1, page: 1, pageSize: 20 }, client as never), null);
  assert.equal(calls, 1);
});
