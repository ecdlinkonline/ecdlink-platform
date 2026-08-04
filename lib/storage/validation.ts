import { extname } from "node:path";
import { StorageValidationError } from "@/lib/storage/errors";
import { sanitizeFilename } from "@/lib/storage/path";
import type { FileValidationPolicy } from "@/lib/storage/types";

export const defaultDocumentPolicy: FileValidationPolicy = {
  allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
  allowedExtensions: [".pdf", ".jpg", ".jpeg", ".png"],
  maxBytes: 10_000_000,
};

export type StorageUploadFile = {
  name: string;
  type: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
};

const mimeExtensions: Record<string, readonly string[]> = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
};

function matchesKnownSignature(mimeType: string, content: Uint8Array) {
  if (mimeType === "application/pdf") {
    return content.length >= 5 && String.fromCharCode(...content.slice(0, 5)) === "%PDF-";
  }
  if (mimeType === "image/jpeg") {
    return content.length >= 3 && content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff;
  }
  if (mimeType === "image/png") {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return content.length >= signature.length && signature.every((byte, index) => content[index] === byte);
  }
  return true;
}

export async function validateStorageFile(file: StorageUploadFile, policy: FileValidationPolicy = defaultDocumentPolicy) {
  const originalFilename = file.name.trim();
  const sanitizedFilename = sanitizeFilename(originalFilename);
  const mimeType = file.type.trim().toLowerCase();
  const extension = extname(originalFilename).toLowerCase();

  if (!Number.isSafeInteger(file.size) || file.size <= 0) {
    throw new StorageValidationError("The file is empty.");
  }
  if (file.size > policy.maxBytes) {
    throw new StorageValidationError("The file exceeds the maximum allowed size.");
  }
  if (!policy.allowedMimeTypes.includes(mimeType)) {
    throw new StorageValidationError("The file type is not supported.");
  }
  if (!policy.allowedExtensions.includes(extension) || !(mimeExtensions[mimeType] ?? []).includes(extension)) {
    throw new StorageValidationError("The filename extension does not match the file type.");
  }

  const content = new Uint8Array(await file.arrayBuffer());
  if (content.byteLength === 0 || content.byteLength !== file.size) {
    throw new StorageValidationError("The file content is invalid.");
  }
  if (!matchesKnownSignature(mimeType, content)) {
    throw new StorageValidationError("The file content does not match its declared type.");
  }

  return { originalFilename, sanitizedFilename, mimeType, content };
}

export function isPreviewableMimeType(mimeType: string) {
  return defaultDocumentPolicy.allowedMimeTypes.includes(mimeType);
}
