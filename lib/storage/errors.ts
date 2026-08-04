export class StorageError extends Error {
  constructor(message: string, public readonly status = 500, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class StorageConfigurationError extends StorageError {
  constructor(options?: ErrorOptions) {
    super("File storage is not configured.", 503, options);
  }
}

export class StorageValidationError extends StorageError {
  constructor(message: string) {
    super(message, 422);
  }
}

export class StorageUploadError extends StorageError {
  constructor(options?: ErrorOptions) {
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
