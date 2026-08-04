import "server-only";
import { z } from "zod";
import { StorageConfigurationError } from "@/lib/storage/errors";

const storageEnvSchema = z.object({
  SUPABASE_URL: z.string().url().refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" || ["localhost", "127.0.0.1"].includes(url.hostname);
  }, "Supabase URL must use HTTPS outside local development."),
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

export function getStorageConfig(): StorageConfig {
  const result = storageEnvSchema.safeParse({
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_STORAGE_BUCKET: process.env.SUPABASE_STORAGE_BUCKET ?? "ecdlink-private",
    SUPABASE_SIGNED_URL_TTL_SECONDS: process.env.SUPABASE_SIGNED_URL_TTL_SECONDS ?? "300",
  });
  if (!result.success) {
    throw new StorageConfigurationError({ cause: result.error });
  }
  return {
    supabaseUrl: result.data.SUPABASE_URL,
    serviceRoleKey: result.data.SUPABASE_SERVICE_ROLE_KEY,
    bucket: result.data.SUPABASE_STORAGE_BUCKET,
    signedUrlTtlSeconds: result.data.SUPABASE_SIGNED_URL_TTL_SECONDS,
  };
}
