import assert from "node:assert/strict";
import test from "node:test";
import { StorageValidationError } from "@/lib/storage/errors";
import { validateStorageFile } from "@/lib/storage/validation";

function file(name: string, type: string, bytes: number[]) {
  const content = Uint8Array.from(bytes);
  return { name, type, size: content.byteLength, arrayBuffer: async () => content.buffer };
}

test("accepts a PDF with matching MIME type, extension and signature", async () => {
  const result = await validateStorageFile(file("evidence.pdf", "application/pdf", [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]));
  assert.equal(result.mimeType, "application/pdf");
  assert.equal(result.sanitizedFilename, "evidence.pdf");
});

test("rejects an empty file", async () => {
  await assert.rejects(() => validateStorageFile(file("empty.pdf", "application/pdf", [])), StorageValidationError);
});

test("rejects an unsupported MIME type", async () => {
  await assert.rejects(() => validateStorageFile(file("script.js", "text/javascript", [1])), StorageValidationError);
});

test("rejects an extension and MIME mismatch", async () => {
  await assert.rejects(() => validateStorageFile(file("image.png", "application/pdf", [0x25, 0x50, 0x44, 0x46, 0x2d])), StorageValidationError);
});

test("rejects content whose signature does not match its MIME type", async () => {
  await assert.rejects(() => validateStorageFile(file("fake.pdf", "application/pdf", [1, 2, 3, 4, 5])), StorageValidationError);
});

test("rejects an oversized file before reading its content", async () => {
  let read = false;
  await assert.rejects(
    () => validateStorageFile({ name: "large.pdf", type: "application/pdf", size: 11, arrayBuffer: async () => { read = true; return new ArrayBuffer(11); } }, { allowedMimeTypes: ["application/pdf"], allowedExtensions: [".pdf"], maxBytes: 10 }),
    StorageValidationError
  );
  assert.equal(read, false);
});
