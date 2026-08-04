export type StorageProvider = "uploadthing" | "s3" | "supabase" | "local-placeholder";

export type FileAssetInput = {
  storageProvider: StorageProvider;
  storageKey: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  checksum?: string;
  uploadedByUserId?: string;
};

export async function createUploadPlaceholder(input: Omit<FileAssetInput, "storageProvider">): Promise<FileAssetInput> {
  return { ...input, storageProvider: "local-placeholder" };
}

// Temporary compatibility exports while feature modules migrate to the shared storage platform.
export { getStorageService, storage } from "@/lib/storage/storage-service";
export type { StorageModule } from "@/lib/storage/types";
