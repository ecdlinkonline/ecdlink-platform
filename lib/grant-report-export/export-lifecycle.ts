import { createHash, randomBytes } from "node:crypto";

export const grantReportExportLifecycleDefaults = {
  generationLeaseMilliseconds: 5 * 60 * 1000,
  cleanupQuarantineMilliseconds: 10 * 60 * 1000,
  cleanupLeaseMilliseconds: 2 * 60 * 1000,
} as const;

export type GrantReportExportFailureCode =
  | "EXPORT_SOURCE_NOT_FOUND"
  | "PACK_GENERATION_FAILED"
  | "STORAGE_UPLOAD_FAILED"
  | "STORAGE_VERIFICATION_FAILED"
  | "GENERATION_ABORTED"
  | "GENERATION_FAILED"
  | "LEASE_EXPIRED";

export class GrantReportExportLifecycleError extends Error {
  constructor(
    public readonly code:
      | "REPORT_VERSION_NOT_FOUND"
      | "REPORT_VERSION_NOT_SUBMITTED"
      | "STALE_ATTEMPT"
      | "ATTEMPT_EXPIRED"
      | "FILE_ALREADY_STAGED"
      | "INVALID_STORAGE_PATH"
      | "CLEANUP_NOT_AVAILABLE"
      | "STORAGE_VERIFICATION_FAILED"
      | "GENERATION_FAILED"
      | "CLEANUP_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "GrantReportExportLifecycleError";
  }
}

export function safeGrantReportExportError(value: unknown, fallback: "GENERATION_FAILED" | "CLEANUP_FAILED") {
  if (value instanceof GrantReportExportLifecycleError) return value;
  return new GrantReportExportLifecycleError(
    fallback,
    fallback === "CLEANUP_FAILED" ? "The export cleanup could not be completed." : "The export could not be generated.",
  );
}

export function createLifecycleToken() {
  return randomBytes(32).toString("hex");
}

export function normalizeExportFailureCode(value: unknown): GrantReportExportFailureCode {
  if (value instanceof GrantReportExportLifecycleError && value.code === "STORAGE_VERIFICATION_FAILED") return "STORAGE_VERIFICATION_FAILED";
  if (value && typeof value === "object" && "code" in value) {
    const code = String((value as { code: unknown }).code).toUpperCase();
    if (code === "GENERATION_ABORTED") return "GENERATION_ABORTED";
  }
  return "GENERATION_FAILED";
}

function safeIdentifier(value: string) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    throw new GrantReportExportLifecycleError("INVALID_STORAGE_PATH", "Export storage ownership is invalid.");
  }
  return value;
}

function tokenDigest(token: string) {
  return createHash("sha256").update(token).digest("hex").slice(0, 16);
}

export type ExportStorageOwnership = {
  reportId: string;
  versionId: string;
  artifactId: string;
  attemptNumber: number;
  generationToken: string;
  fileAssetId: string;
};

export function buildGrantReportExportStoragePath(input: ExportStorageOwnership) {
  if (!Number.isSafeInteger(input.attemptNumber) || input.attemptNumber <= 0) {
    throw new GrantReportExportLifecycleError("INVALID_STORAGE_PATH", "Export storage ownership is invalid.");
  }
  const reportId = safeIdentifier(input.reportId);
  const versionId = safeIdentifier(input.versionId);
  const artifactId = safeIdentifier(input.artifactId);
  const fileAssetId = safeIdentifier(input.fileAssetId);
  const attempt = `attempt-${input.attemptNumber}-${tokenDigest(input.generationToken)}`;
  return `grant-report-exports/${reportId}/${versionId}/${artifactId}/${attempt}/${fileAssetId}/ECDLink-Submission-Pack.zip`;
}

export function assertGrantReportExportStoragePath(path: string, ownership: ExportStorageOwnership) {
  const expected = buildGrantReportExportStoragePath(ownership);
  if (path !== expected) {
    throw new GrantReportExportLifecycleError("INVALID_STORAGE_PATH", "Export storage ownership is invalid.");
  }
  return expected;
}
