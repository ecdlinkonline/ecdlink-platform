import { getStorageConfig } from "../../lib/storage/config";
import { verifySupabaseStorageBucket } from "../../lib/storage/supabase-storage-provider";
import { defaultDocumentPolicy } from "../../lib/storage/validation";

async function main() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log("Supabase storage verification skipped: credentials are not configured.");
    return;
  }

  const config = getStorageConfig();
  const bucket = await verifySupabaseStorageBucket(config);
  const configuredMimeTypes = new Set(bucket.allowedMimeTypes ?? []);
  const missingMimeTypes = defaultDocumentPolicy.allowedMimeTypes.filter((mimeType) => !configuredMimeTypes.has(mimeType));
  const problems = [
    bucket.public ? "bucket must be private" : null,
    bucket.fileSizeLimit === null || bucket.fileSizeLimit === undefined
      ? "bucket has no file-size restriction"
      : bucket.fileSizeLimit > defaultDocumentPolicy.maxBytes
        ? `bucket file-size limit exceeds ${defaultDocumentPolicy.maxBytes} bytes`
        : null,
    missingMimeTypes.length ? `bucket is missing MIME restrictions for: ${missingMimeTypes.join(", ")}` : null,
  ].filter(Boolean);

  if (problems.length) {
    console.error(`Supabase storage verification failed: ${problems.join("; ")}.`);
    process.exitCode = 1;
  } else {
    console.log(`Supabase storage bucket "${bucket.name}" is private and matches the document policy.`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Supabase storage verification failed.");
  process.exitCode = 1;
});
