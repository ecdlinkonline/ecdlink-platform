import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSupabaseTusEndpoint,
  getGrantReportExportStorageConfig,
  grantReportExportStorageConfigDiagnostic,
} from "@/lib/grant-report-export/storage-config";
import { GrantReportExportStorageError } from "@/lib/grant-report-export/supabase-export-storage-errors";

const environment = {
  SUPABASE_URL: "https://project-ref.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "server-only-service-role-key-for-tests",
  SUPABASE_EXPORT_STORAGE_BUCKET: "ecdlink-report-exports",
};

test("export storage uses a separate required private bucket and direct TUS endpoint", () => {
  const config = getGrantReportExportStorageConfig(environment);
  assert.equal(config.bucket, "ecdlink-report-exports");
  assert.equal(config.tusEndpoint, "https://project-ref.storage.supabase.co/storage/v1/upload/resumable");
  assert.equal(buildSupabaseTusEndpoint("http://localhost:54321"), "http://localhost:54321/storage/v1/upload/resumable");
});

test("export storage configuration rejects missing buckets and non-base URLs without exposing values", () => {
  assert.throws(
    () => getGrantReportExportStorageConfig({ ...environment, SUPABASE_EXPORT_STORAGE_BUCKET: undefined }),
    (error: unknown) => error instanceof GrantReportExportStorageError
      && error.code === "INVALID_CONFIGURATION"
      && !error.message.includes(environment.SUPABASE_SERVICE_ROLE_KEY),
  );
  assert.throws(
    () => getGrantReportExportStorageConfig({ ...environment, SUPABASE_URL: "https://project-ref.supabase.co/rest/v1" }),
    (error: unknown) => error instanceof GrantReportExportStorageError && error.code === "INVALID_CONFIGURATION",
  );
});

test("configuration diagnostics expose presence booleans only", () => {
  assert.deepEqual(grantReportExportStorageConfigDiagnostic(environment), {
    urlConfigured: true,
    serviceRoleConfigured: true,
    exportBucketConfigured: true,
  });
});
