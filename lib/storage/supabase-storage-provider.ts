import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getStorageConfig, type StorageConfig } from "@/lib/storage/config";
import {
  StorageAccessError,
  StorageConfigurationError,
  StorageUploadError,
  type StorageFailureDiagnostic,
} from "@/lib/storage/errors";
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

type SupabaseUploadResult = {
  data: { path?: string } | null;
  error: unknown;
};

type SupabaseUploadBucket = {
  upload: (
    path: string,
    content: Uint8Array,
    options: { contentType: string; cacheControl: string; upsert: boolean }
  ) => Promise<SupabaseUploadResult>;
};

function numericStatus(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^\d{3}$/.test(value)) return Number(value);
  return undefined;
}

export function classifySupabaseUploadFailure(error: unknown): StorageFailureDiagnostic {
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const original = record.originalError && typeof record.originalError === "object"
      ? record.originalError as Record<string, unknown>
      : undefined;
    if (record.name === "AbortError" || original?.name === "AbortError") {
      return { failureCode: "request_timeout" };
    }
    const status = numericStatus(record.status) ?? numericStatus(record.statusCode) ?? numericStatus(original?.status);
    const providerCode = typeof record.code === "string" ? record.code : typeof record.statusCode === "string" ? record.statusCode : undefined;
    if (providerCode === "NoSuchBucket") return { failureCode: "bucket_or_storage_endpoint_not_found", httpStatus: status };
    if (providerCode === "AccessDenied") return { failureCode: "storage_permission_or_rls_denied", httpStatus: status };
    if (providerCode === "ResourceAlreadyExists") return { failureCode: "object_conflict", httpStatus: status };
    if (providerCode === "EntityTooLarge") return { failureCode: "payload_too_large", httpStatus: status };
    if (status === 400) return { failureCode: "provider_bad_request", httpStatus: status };
    if (status === 401) return { failureCode: "invalid_or_revoked_service_role_key", httpStatus: status };
    if (status === 403) return { failureCode: "storage_permission_or_rls_denied", httpStatus: status };
    if (status === 404) return { failureCode: "bucket_or_storage_endpoint_not_found", httpStatus: status };
    if (status === 409) return { failureCode: "object_conflict", httpStatus: status };
    if (status === 413) return { failureCode: "payload_too_large", httpStatus: status };
    if (status && status >= 500) return { failureCode: "provider_5xx", httpStatus: status };
    if (record.name === "StorageUnknownError" || original instanceof Error) {
      return { failureCode: "network_failure" };
    }
  }
  return { failureCode: "unknown_provider_failure" };
}

export async function uploadSupabaseObject(bucket: SupabaseUploadBucket, input: UploadStorageInput): Promise<StoredObject> {
  let result: SupabaseUploadResult;
  try {
    result = await bucket.upload(input.path, input.content, {
      contentType: input.contentType,
      cacheControl: input.cacheControl ?? "0",
      upsert: input.upsert ?? false,
    });
  } catch (error) {
    throw new StorageUploadError({ cause: error, diagnostic: classifySupabaseUploadFailure(error) });
  }
  if (result.error) {
    throw new StorageUploadError({ cause: result.error, diagnostic: classifySupabaseUploadFailure(result.error) });
  }
  if (!result.data?.path) {
    throw new StorageUploadError({ diagnostic: { failureCode: "malformed_provider_response" } });
  }
  return { provider: "supabase", path: input.path, contentType: input.contentType, size: input.content.byteLength };
}

export class SupabaseStorageProvider implements StorageProviderAdapter {
  private readonly client: SupabaseClient;

  constructor(private readonly config: StorageConfig = getStorageConfig()) {
    this.client = createServerClient(config);
  }

  async upload(input: UploadStorageInput): Promise<StoredObject> {
    return uploadSupabaseObject(this.client.storage.from(this.config.bucket), input);
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
