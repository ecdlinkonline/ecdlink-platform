import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getStorageConfig, type StorageConfig } from "@/lib/storage/config";
import { StorageAccessError, StorageConfigurationError, StorageUploadError } from "@/lib/storage/errors";
import type { StorageProviderAdapter } from "@/lib/storage/storage-provider";
import type { StoredObject, UploadStorageInput } from "@/lib/storage/types";

function createServerClient(config: StorageConfig) {
  return createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export class SupabaseStorageProvider implements StorageProviderAdapter {
  private readonly client: SupabaseClient;

  constructor(private readonly config: StorageConfig = getStorageConfig()) {
    this.client = createServerClient(config);
  }

  async upload(input: UploadStorageInput): Promise<StoredObject> {
    const { error } = await this.client.storage.from(this.config.bucket).upload(input.path, input.content, {
      contentType: input.contentType,
      cacheControl: input.cacheControl ?? "0",
      upsert: input.upsert ?? false,
    });
    if (error) throw new StorageUploadError({ cause: error });
    return { provider: "supabase", path: input.path, contentType: input.contentType, size: input.content.byteLength };
  }

  async createSignedUrl(input: { path: string; expiresInSeconds: number; downloadFilename?: string }) {
    const { data, error } = await this.client.storage.from(this.config.bucket).createSignedUrl(
      input.path,
      input.expiresInSeconds,
      input.downloadFilename ? { download: input.downloadFilename } : undefined
    );
    if (error || !data?.signedUrl) throw new StorageAccessError("The file access link could not be created.", 502, { cause: error });
    return data.signedUrl;
  }

  async exists(path: string) {
    const separator = path.lastIndexOf("/");
    const folder = separator >= 0 ? path.slice(0, separator) : "";
    const filename = separator >= 0 ? path.slice(separator + 1) : path;
    const { data, error } = await this.client.storage.from(this.config.bucket).list(folder, { search: filename, limit: 100 });
    if (error) throw new StorageAccessError("File storage could not be checked.", 502, { cause: error });
    return data.some((object) => object.name === filename);
  }

  async removeForRollback(path: string) {
    const { error } = await this.client.storage.from(this.config.bucket).remove([path]);
    if (error) throw new StorageUploadError({ cause: error });
  }
}

export async function verifySupabaseStorageBucket(config: StorageConfig = getStorageConfig()) {
  const client = createServerClient(config);
  const { data, error } = await client.storage.getBucket(config.bucket);
  if (error || !data) throw new StorageConfigurationError({ cause: error });
  return {
    name: data.name,
    public: data.public,
    fileSizeLimit: data.file_size_limit,
    allowedMimeTypes: data.allowed_mime_types,
  };
}
