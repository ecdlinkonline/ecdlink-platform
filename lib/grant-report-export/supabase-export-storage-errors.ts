export type GrantReportExportStorageFailureCode =
  | "INVALID_CONFIGURATION"
  | "INVALID_STORAGE_PATH"
  | "INVALID_UPLOAD_INPUT"
  | "OBJECT_ALREADY_EXISTS"
  | "OBJECT_NOT_FOUND"
  | "UPLOAD_ABORTED"
  | "UPLOAD_TIMEOUT"
  | "UPLOAD_FAILED"
  | "INTEGRITY_MISMATCH"
  | "PROVIDER_UNAVAILABLE";

export class GrantReportExportStorageError extends Error {
  constructor(
    public readonly code: GrantReportExportStorageFailureCode,
    message: string,
    public readonly httpStatus?: number,
  ) {
    super(message);
    this.name = "GrantReportExportStorageError";
  }
}

export function numericProviderStatus(error: unknown) {
  if (!error || typeof error !== "object") return undefined;
  const value = error as Record<string, unknown>;
  const direct = value.status ?? value.statusCode;
  if (typeof direct === "number" && Number.isInteger(direct)) return direct;
  if (typeof direct === "string" && /^\d{3}$/.test(direct)) return Number(direct);
  return undefined;
}

export function safeExportStorageError(error: unknown, fallback: GrantReportExportStorageFailureCode = "PROVIDER_UNAVAILABLE") {
  if (error instanceof GrantReportExportStorageError) return error;
  const status = numericProviderStatus(error);
  if (status === 409) {
    return new GrantReportExportStorageError("OBJECT_ALREADY_EXISTS", "The export object already exists.", status);
  }
  if (status === 404) return new GrantReportExportStorageError("OBJECT_NOT_FOUND", "The export object was not found.", status);
  return new GrantReportExportStorageError(fallback, "Private export storage is unavailable.", status);
}
