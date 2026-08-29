import "server-only";
import { z } from "zod";
import { StorageConfigurationError } from "@/lib/storage/errors";

function isSecureSupabaseUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || ["localhost", "127.0.0.1"].includes(url.hostname);
  } catch {
    return false;
  }
}

const storageEnvSchema = z.object({
  SUPABASE_URL: z.string().url().refine(isSecureSupabaseUrl, "Supabase URL must use HTTPS outside local development."),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  SUPABASE_STORAGE_BUCKET: z.string().min(3).default("ecdlink-private"),
  SUPABASE_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(900).default(300),
});

export type StorageConfig = {
  supabaseUrl: string;
  serviceRoleKey: string;
  bucket: string;
  signedUrlTtlSeconds: number;
};

export type StorageConfigDiagnostic = {
  urlConfigured: boolean;
  serviceRoleConfigured: boolean;
  bucketConfigured: boolean;
};

export function storageConfigDiagnostic(): StorageConfigDiagnostic {
  return {
    urlConfigured: Boolean(process.env.SUPABASE_URL?.trim()),
    serviceRoleConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
    bucketConfigured: Boolean(process.env.SUPABASE_STORAGE_BUCKET?.trim()),
  };
}

function configurationFailureCode(): "missing_supabase_url" | "missing_service_role_key" | "malformed_supabase_url" | "invalid_storage_configuration" {
  if (!process.env.SUPABASE_URL?.trim()) return "missing_supabase_url";
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) return "missing_service_role_key";
  try {
    new URL(process.env.SUPABASE_URL);
  } catch {
    return "malformed_supabase_url";
  }
  return "invalid_storage_configuration";
}

export function getStorageConfig(): StorageConfig {
  const result = storageEnvSchema.safeParse({
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_STORAGE_BUCKET: process.env.SUPABASE_STORAGE_BUCKET ?? "ecdlink-private",
    SUPABASE_SIGNED_URL_TTL_SECONDS: process.env.SUPABASE_SIGNED_URL_TTL_SECONDS ?? "300",
  });
  if (!result.success) {
    throw new StorageConfigurationError({
      cause: result.error,
      diagnostic: { failureCode: configurationFailureCode() },
    });
  }
  return {
    supabaseUrl: result.data.SUPABASE_URL,
    serviceRoleKey: result.data.SUPABASE_SERVICE_ROLE_KEY,
    bucket: result.data.SUPABASE_STORAGE_BUCKET,
    signedUrlTtlSeconds: result.data.SUPABASE_SIGNED_URL_TTL_SECONDS,
  };
}
