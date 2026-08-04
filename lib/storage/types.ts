export const storageModules = [
  "funding",
  "compliance",
  "procurement",
  "membership",
  "suppliers",
  "centres",
  "donors",
  "intelligence",
] as const;

export type StorageModule = (typeof storageModules)[number];

export type FileValidationPolicy = {
  allowedMimeTypes: readonly string[];
  allowedExtensions: readonly string[];
  maxBytes: number;
};

export type UploadStorageInput = {
  path: string;
  content: Uint8Array;
  contentType: string;
  cacheControl?: string;
  upsert?: boolean;
};

export type StoredObject = {
  provider: "supabase";
  path: string;
  contentType: string;
  size: number;
};

export type SafeFileAsset = {
  id: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  checksum: string | null;
  createdAt: Date;
};

export type StorageAccessContext = {
  actorUserId: string;
  module: StorageModule;
  entityId: string;
};

export type SignedFileAccess = {
  url: string;
  expiresAt: Date;
  originalFilename: string;
  mimeType: string;
  previewable: boolean;
};
