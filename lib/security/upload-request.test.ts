import assert from "node:assert/strict";
import test from "node:test";
import { validateUploadRequest } from "./upload-request";

const multipart = "multipart/form-data; boundary=ecdlink";
test("rejects oversized requests before multipart parsing", () => { assert.deepEqual(validateUploadRequest(new Request("https://app.test/upload", { method: "POST", headers: { "content-type": multipart, "content-length": "12000001" } }), 12_000_000), { valid: false, status: 413, message: "The upload request is too large." }); });
test("rejects invalid content type", () => { assert.equal(validateUploadRequest(new Request("https://app.test/upload", { method: "POST", headers: { "content-type": "application/json" } })).valid, false); });
test("allows valid multipart requests to continue to authoritative file validation", () => { assert.deepEqual(validateUploadRequest(new Request("https://app.test/upload", { method: "POST", headers: { "content-type": multipart } })), { valid: true }); });
test("declared length is only an early upper-bound check", () => { assert.deepEqual(validateUploadRequest(new Request("https://app.test/upload", { method: "POST", headers: { "content-type": multipart, "content-length": "1" } })), { valid: true }); });
