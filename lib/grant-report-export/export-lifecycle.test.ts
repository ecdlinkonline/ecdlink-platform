import assert from "node:assert/strict";
import test from "node:test";
import {
  assertGrantReportExportStoragePath,
  buildGrantReportExportStoragePath,
  GrantReportExportLifecycleError,
} from "@/lib/grant-report-export/export-lifecycle";

const ownership = {
  reportId: "report-1",
  versionId: "version-1",
  artifactId: "artifact-1",
  attemptNumber: 2,
  generationToken: "a".repeat(64),
  fileAssetId: "file-1",
};

test("export storage paths are deterministic and attempt-specific without exposing generation tokens", () => {
  const first = buildGrantReportExportStoragePath(ownership);
  const second = buildGrantReportExportStoragePath({ ...ownership, attemptNumber: 3 });
  assert.equal(first, buildGrantReportExportStoragePath(ownership));
  assert.notEqual(first, second);
  assert.match(first, /^grant-report-exports\/report-1\/version-1\/artifact-1\/attempt-2-[0-9a-f]{16}\/file-1\/ECDLink-Submission-Pack\.zip$/);
  assert.doesNotMatch(first, new RegExp(ownership.generationToken));
});

test("cleanup path validation rejects cross-attempt and traversal paths", () => {
  const path = buildGrantReportExportStoragePath(ownership);
  assert.equal(assertGrantReportExportStoragePath(path, ownership), path);
  assert.throws(
    () => assertGrantReportExportStoragePath(path, { ...ownership, attemptNumber: 3 }),
    (error: unknown) => error instanceof GrantReportExportLifecycleError && error.code === "INVALID_STORAGE_PATH",
  );
  assert.throws(
    () => buildGrantReportExportStoragePath({ ...ownership, reportId: "../other-report" }),
    (error: unknown) => error instanceof GrantReportExportLifecycleError && error.code === "INVALID_STORAGE_PATH",
  );
});
