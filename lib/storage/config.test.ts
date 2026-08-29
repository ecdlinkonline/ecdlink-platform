import assert from "node:assert/strict";
import test from "node:test";
import { getStorageConfig, storageConfigDiagnostic } from "@/lib/storage/config";
import { StorageConfigurationError } from "@/lib/storage/errors";

test("storage configuration diagnostics expose presence booleans and no values", () => {
  const before = {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY,
    bucket: process.env.SUPABASE_STORAGE_BUCKET,
  };
  process.env.SUPABASE_URL = "https://private-project.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "private-service-role-secret";
  process.env.SUPABASE_STORAGE_BUCKET = "ecdlink-private";
  try {
    const diagnostic = storageConfigDiagnostic();
    assert.deepEqual(diagnostic, { urlConfigured: true, serviceRoleConfigured: true, bucketConfigured: true });
    const serialized = JSON.stringify(diagnostic);
    assert.doesNotMatch(serialized, /private-project|private-service-role-secret|ecdlink-private/);
  } finally {
    if (before.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = before.url;
    if (before.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = before.key;
    if (before.bucket === undefined) delete process.env.SUPABASE_STORAGE_BUCKET; else process.env.SUPABASE_STORAGE_BUCKET = before.bucket;
  }
});

test("missing storage configuration is represented safely", () => {
  const before = {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY,
    bucket: process.env.SUPABASE_STORAGE_BUCKET,
  };
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_STORAGE_BUCKET;
  try {
    assert.deepEqual(storageConfigDiagnostic(), { urlConfigured: false, serviceRoleConfigured: false, bucketConfigured: false });
    assert.throws(
      () => getStorageConfig(),
      (error: unknown) => error instanceof StorageConfigurationError && error.diagnostic?.failureCode === "missing_supabase_url"
    );
  } finally {
    if (before.url !== undefined) process.env.SUPABASE_URL = before.url;
    if (before.key !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = before.key;
    if (before.bucket !== undefined) process.env.SUPABASE_STORAGE_BUCKET = before.bucket;
  }
});

test("malformed Supabase URL and missing service-role key are classified without exposing values", () => {
  const before = {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY,
    bucket: process.env.SUPABASE_STORAGE_BUCKET,
  };
  try {
    process.env.SUPABASE_URL = "not-a-url";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "valid-length-service-role-key";
    process.env.SUPABASE_STORAGE_BUCKET = "ecdlink-private";
    assert.throws(
      () => getStorageConfig(),
      (error: unknown) => error instanceof StorageConfigurationError && error.diagnostic?.failureCode === "malformed_supabase_url"
    );

    process.env.SUPABASE_URL = "https://project.example.test";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    assert.throws(
      () => getStorageConfig(),
      (error: unknown) => error instanceof StorageConfigurationError && error.diagnostic?.failureCode === "missing_service_role_key"
    );
  } finally {
    if (before.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = before.url;
    if (before.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = before.key;
    if (before.bucket === undefined) delete process.env.SUPABASE_STORAGE_BUCKET; else process.env.SUPABASE_STORAGE_BUCKET = before.bucket;
  }
});
