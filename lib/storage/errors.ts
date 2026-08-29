export class StorageError extends Error {
  constructor(
    message: string,
    public readonly status = 500,
    options?: ErrorOptions & { diagnostic?: StorageFailureDiagnostic }
  ) {
    super(message, options);
    this.name = new.target.name;
    this.diagnostic = options?.diagnostic;
  }

  readonly diagnostic?: StorageFailureDiagnostic;
}

export type StorageFailureCode =
  | "missing_supabase_url"
  | "missing_service_role_key"
  | "malformed_supabase_url"
  | "invalid_storage_configuration"
  | "provider_bad_request"
  | "invalid_or_revoked_service_role_key"
  | "storage_permission_or_rls_denied"
  | "bucket_or_storage_endpoint_not_found"
  | "object_conflict"
  | "payload_too_large"
  | "provider_5xx"
  | "network_failure"
  | "request_timeout"
  | "malformed_provider_response"
  | "file_asset_persistence_failure"
  | "unknown_provider_failure";

export type StorageFailureDiagnostic = {
  failureCode: StorageFailureCode;
  httpStatus?: number;
};

export class StorageConfigurationError extends StorageError {
  constructor(options?: ErrorOptions & { diagnostic?: StorageFailureDiagnostic }) {
    super("File storage is not configured.", 503, options);
  }
}

export class StorageValidationError extends StorageError {
  constructor(message: string) {
    super(message, 422);
  }
}

export class StorageUploadError extends StorageError {
  constructor(options?: ErrorOptions & { diagnostic?: StorageFailureDiagnostic }) {
    super("The file could not be stored.", 502, options);
  }
}

export class StorageAccessError extends StorageError {
  constructor(message = "The file cannot be accessed.", status = 403, options?: ErrorOptions) {
    super(message, status, options);
  }
}

export class StorageNotFoundError extends StorageError {
  constructor() {
    super("The requested file was not found.", 404);
  }
}
