import type { StoredObject, UploadStorageInput } from "@/lib/storage/types";

export interface StorageProviderAdapter {
  upload(input: UploadStorageInput): Promise<StoredObject>;
  createSignedUrl(input: { path: string; expiresInSeconds: number; downloadFilename?: string }): Promise<string>;
  exists(path: string): Promise<boolean>;

  // Provider removal is intentionally internal and exists only to roll back a failed metadata transaction.
  removeForRollback(path: string): Promise<void>;
}
