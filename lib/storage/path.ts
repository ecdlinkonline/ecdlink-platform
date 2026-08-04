import { StorageValidationError } from "@/lib/storage/errors";
import type { StorageModule } from "@/lib/storage/types";

const unsafePathPattern = /(?:\.\.|[\\/\u0000-\u001f\u007f])/;

export function sanitizeFilename(filename: string) {
  const trimmed = filename.trim();
  if (!trimmed || unsafePathPattern.test(trimmed)) {
    throw new StorageValidationError("The filename is invalid.");
  }
  const sanitized = trimmed
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 180);
  if (!sanitized) throw new StorageValidationError("The filename is invalid.");
  return sanitized;
}

function safeIdentifier(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed || unsafePathPattern.test(trimmed) || !/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    throw new StorageValidationError(`${label} is invalid.`);
  }
  return trimmed;
}

export function buildStorageObjectPath(input: {
  module: StorageModule;
  ownerId: string;
  entityId: string;
  fileAssetId: string;
  filename: string;
}) {
  return [
    input.module,
    safeIdentifier(input.ownerId, "Storage owner"),
    safeIdentifier(input.entityId, "Storage entity"),
    safeIdentifier(input.fileAssetId, "File identifier"),
    sanitizeFilename(input.filename),
  ].join("/");
}
