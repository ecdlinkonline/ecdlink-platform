import assert from "node:assert/strict";
import test from "node:test";
import { StorageUploadError } from "@/lib/storage/errors";
import { classifySupabaseUploadFailure, uploadSupabaseObject } from "@/lib/storage/supabase-storage-provider";

const input = {
  path: "private/object.pdf",
  content: Uint8Array.from([1, 2, 3]),
  contentType: "application/pdf",
};

for (const [status, failureCode] of [
  [400, "provider_bad_request"],
  [401, "invalid_or_revoked_service_role_key"],
  [403, "storage_permission_or_rls_denied"],
  [404, "bucket_or_storage_endpoint_not_found"],
  [409, "object_conflict"],
  [413, "payload_too_large"],
  [500, "provider_5xx"],
] as const) {
  test(`classifies Supabase HTTP ${status} without retaining provider response data`, () => {
    assert.deepEqual(classifySupabaseUploadFailure({ name: "StorageApiError", status, message: "sensitive provider detail" }), {
      failureCode,
      httpStatus: status,
    });
  });
}

test("classifies timeout, network, and malformed provider responses", async () => {
  assert.deepEqual(classifySupabaseUploadFailure({ name: "StorageUnknownError", originalError: { name: "AbortError" } }), { failureCode: "request_timeout" });
  assert.deepEqual(classifySupabaseUploadFailure({ name: "StorageUnknownError", originalError: new TypeError("network failed") }), { failureCode: "network_failure" });
  await assert.rejects(
    () => uploadSupabaseObject({ upload: async () => ({ data: {}, error: null }) }, input),
    (error: unknown) => error instanceof StorageUploadError && error.diagnostic?.failureCode === "malformed_provider_response"
  );
});

test("uses allow-listed provider codes to distinguish bucket, permission, conflict, and size failures", () => {
  assert.equal(classifySupabaseUploadFailure({ status: 400, code: "NoSuchBucket" }).failureCode, "bucket_or_storage_endpoint_not_found");
  assert.equal(classifySupabaseUploadFailure({ status: 400, code: "AccessDenied" }).failureCode, "storage_permission_or_rls_denied");
  assert.equal(classifySupabaseUploadFailure({ status: 400, code: "ResourceAlreadyExists" }).failureCode, "object_conflict");
  assert.equal(classifySupabaseUploadFailure({ status: 400, code: "EntityTooLarge" }).failureCode, "payload_too_large");
});

test("successful private upload returns only the provider object contract", async () => {
  const stored = await uploadSupabaseObject(
    { upload: async (_path, _content, options) => {
      assert.equal(options.upsert, false);
      return { data: { path: input.path }, error: null };
    } },
    input
  );
  assert.deepEqual(stored, {
    provider: "supabase",
    path: input.path,
    contentType: "application/pdf",
    size: 3,
  });
});

test("wrapped upload errors expose only sanitized diagnostic fields", async () => {
  const secret = "service-role-secret-value";
  await assert.rejects(
    () => uploadSupabaseObject({ upload: async () => ({ data: null, error: { status: 401, message: secret } }) }, input),
    (error: unknown) => {
      assert.ok(error instanceof StorageUploadError);
      assert.doesNotMatch(JSON.stringify(error.diagnostic), new RegExp(secret));
      assert.deepEqual(error.diagnostic, { failureCode: "invalid_or_revoked_service_role_key", httpStatus: 401 });
      return true;
    }
  );
});
