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
