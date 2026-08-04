export const DEFAULT_UPLOAD_REQUEST_MAX_BYTES = 12_000_000;

export type UploadRequestValidation = { valid: true } | { valid: false; status: 413 | 415; message: string };

export function validateUploadRequest(request: Request, maximumBytes = Number(process.env.UPLOAD_REQUEST_MAX_BYTES) || DEFAULT_UPLOAD_REQUEST_MAX_BYTES): UploadRequestValidation {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("multipart/form-data;") || !contentType.includes("boundary=")) return { valid: false, status: 415, message: "A multipart form upload is required." };
  const declaredLength = request.headers.get("content-length");
  if (declaredLength != null) {
    const bytes = Number(declaredLength);
    if (!Number.isSafeInteger(bytes) || bytes < 0) return { valid: false, status: 413, message: "The upload request size is invalid." };
    if (bytes > maximumBytes) return { valid: false, status: 413, message: "The upload request is too large." };
  }
  return { valid: true };
}
