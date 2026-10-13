import "server-only";

import { z } from "zod";
import { GrantReportExportStorageError } from "@/lib/grant-report-export/supabase-export-storage-errors";

const bucketName = /^[A-Za-z0-9][A-Za-z0-9._-]{1,98}[A-Za-z0-9]$/;

function isSecureBaseUrl(value: string) {
  try {
    const url = new URL(value);
    const local = ["localhost", "127.0.0.1"].includes(url.hostname);
    return (url.protocol === "https:" || (local && url.protocol === "http:"))
      && (url.pathname === "/" || url.pathname === "")
      && !url.username
      && !url.password
      && !url.search
      && !url.hash;
  } catch {
    return false;
  }
}

const exportStorageEnvironment = z.object({
  SUPABASE_URL: z.string().url().refine(isSecureBaseUrl, "Supabase URL must be a secure project base URL."),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  SUPABASE_EXPORT_STORAGE_BUCKET: z.string().regex(bucketName),
});

export type GrantReportExportStorageConfig = {
  supabaseUrl: string;
  serviceRoleKey: string;
  bucket: string;
  tusEndpoint: string;
};

export function buildSupabaseTusEndpoint(baseUrl: string) {
  const url = new URL(baseUrl);
  if (/\.supabase\.(co|in|red)$/i.test(url.hostname) && !url.hostname.includes(".storage.supabase.")) {
    url.hostname = url.hostname.replace(/\.supabase\.(co|in|red)$/i, ".storage.supabase.$1");
  }
  url.pathname = "/storage/v1/upload/resumable";
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function getGrantReportExportStorageConfig(
  environment: Record<string, string | undefined> = process.env,
): GrantReportExportStorageConfig {
  const result = exportStorageEnvironment.safeParse(environment);
  if (!result.success) {
    throw new GrantReportExportStorageError("INVALID_CONFIGURATION", "Export storage is not configured.");
  }
  return {
    supabaseUrl: result.data.SUPABASE_URL,
    serviceRoleKey: result.data.SUPABASE_SERVICE_ROLE_KEY,
    bucket: result.data.SUPABASE_EXPORT_STORAGE_BUCKET,
    tusEndpoint: buildSupabaseTusEndpoint(result.data.SUPABASE_URL),
  };
}

export function grantReportExportStorageConfigDiagnostic(
  environment: Record<string, string | undefined> = process.env,
) {
  return {
    urlConfigured: Boolean(environment.SUPABASE_URL?.trim()),
    serviceRoleConfigured: Boolean(environment.SUPABASE_SERVICE_ROLE_KEY?.trim()),
    exportBucketConfigured: Boolean(environment.SUPABASE_EXPORT_STORAGE_BUCKET?.trim()),
  };
}
