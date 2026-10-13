import "server-only";

import { createHash } from "node:crypto";
import { once } from "node:events";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Upload, type HttpResponse } from "tus-js-client";
import { assertGrantReportExportStoragePath } from "@/lib/grant-report-export/export-lifecycle";
import { grantReportExportLimits } from "@/lib/grant-report-export/limits";
import type { GrantReportExportStorage } from "@/lib/grant-report-export/lifecycle-service";
import {
  getGrantReportExportStorageConfig,
  type GrantReportExportStorageConfig,
} from "@/lib/grant-report-export/storage-config";
import {
  GrantReportExportStorageError,
  safeExportStorageError,
} from "@/lib/grant-report-export/supabase-export-storage-errors";

export const grantReportExportStorageLimits = {
  chunkBytes: 6 * 1024 * 1024,
  uploadMilliseconds: 10 * 60 * 1000,
  retryDelays: [0, 1_000, 3_000] as readonly number[],
} as const;

type StoredObjectInfo = {
  size?: number;
  contentType?: string;
  version?: string;
  etag?: string;
};

export type GrantReportExportStorageTransport = {
  exists(path: string): Promise<boolean>;
  uploadFile(input: {
    path: string;
    filePath: string;
    byteSize: number;
    contentType: "application/zip";
    signal: AbortSignal;
  }): Promise<{ storageObjectVersion?: string }>;
  info(path: string): Promise<StoredObjectInfo | null>;
  openRead(path: string, signal: AbortSignal): Promise<Readable>;
  remove(path: string): Promise<void>;
};

type TusUploadOptions = ConstructorParameters<typeof Upload>[1];
type TusUploadFactory = (file: Readable, options: TusUploadOptions) => Pick<Upload, "start" | "abort">;

function createServerClient(config: GrantReportExportStorageConfig) {
  return createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function responseHeader(response: HttpResponse, name: string) {
  const value = response.getHeader(name);
  if (!value || value.length > 255 || /[\r\n]/.test(value)) return undefined;
  return value.replace(/^"|"$/g, "");
}

function tusErrorStatus(error: unknown) {
  if (!error || typeof error !== "object" || !("originalResponse" in error)) return undefined;
  const response = (error as { originalResponse?: { getStatus?: () => number } }).originalResponse;
  return response?.getStatus?.();
}

export async function uploadFileWithTus(
  input: {
    filePath: string;
    path: string;
    byteSize: number;
    contentType: "application/zip";
    signal: AbortSignal;
  },
  config: GrantReportExportStorageConfig,
  createUpload: TusUploadFactory = (file, options) => new Upload(file as never, options),
) {
  const file = createReadStream(input.filePath);
  let storageObjectVersion: string | undefined;
  return new Promise<{ storageObjectVersion?: string }>((resolve, reject) => {
    let settled = false;
    let settling = false;
    const closeFile = async () => {
      if (file.closed) return;
      const closed = once(file, "close").catch(() => undefined);
      file.destroy();
      await closed;
    };
    const finish = async (operation: () => void, abortUpload = false) => {
      if (settled || settling) return;
      settling = true;
      input.signal.removeEventListener("abort", abort);
      if (abortUpload) await upload.abort(true).catch(() => undefined);
      await closeFile();
      if (settled) return;
      settled = true;
      operation();
    };
    const upload = createUpload(file, {
      endpoint: config.tusEndpoint,
      uploadSize: input.byteSize,
      chunkSize: grantReportExportStorageLimits.chunkBytes,
      retryDelays: [...grantReportExportStorageLimits.retryDelays],
      uploadDataDuringCreation: true,
      storeFingerprintForResuming: false,
      removeFingerprintOnSuccess: true,
      headers: {
        authorization: `Bearer ${config.serviceRoleKey}`,
        apikey: config.serviceRoleKey,
      },
      metadata: {
        bucketName: config.bucket,
        objectName: input.path,
        contentType: input.contentType,
        cacheControl: "0",
      },
      onShouldRetry: (error) => {
        const status = tusErrorStatus(error);
        return status === undefined || status >= 500 || status === 429;
      },
      onAfterResponse: (_request, response) => {
        storageObjectVersion = responseHeader(response, "x-supabase-version") ?? responseHeader(response, "etag") ?? storageObjectVersion;
      },
      onError: (error) => {
        const status = tusErrorStatus(error);
        void finish(() => reject(safeExportStorageError(status ? { status } : error, "UPLOAD_FAILED")));
      },
      onSuccess: ({ lastResponse }) => {
        storageObjectVersion = responseHeader(lastResponse, "x-supabase-version") ?? responseHeader(lastResponse, "etag") ?? storageObjectVersion;
        void finish(() => resolve({ storageObjectVersion }));
      },
    });
    const abort = () => {
      void finish(
        () => reject(new GrantReportExportStorageError("UPLOAD_ABORTED", "The export upload was cancelled.")),
        true,
      );
    };
    input.signal.addEventListener("abort", abort, { once: true });
    if (input.signal.aborted) abort();
    else upload.start();
  });
}

export class SupabaseGrantReportExportTransport implements GrantReportExportStorageTransport {
  private readonly client: SupabaseClient;

  constructor(
    private readonly config: GrantReportExportStorageConfig,
    client: SupabaseClient = createServerClient(config),
    private readonly tusUploader: typeof uploadFileWithTus = uploadFileWithTus,
  ) {
    this.client = client;
  }

  async exists(path: string) {
    const { data, error } = await this.client.storage.from(this.config.bucket).exists(path);
    if (error) throw safeExportStorageError(error);
    return data;
  }

  uploadFile(input: { path: string; filePath: string; byteSize: number; contentType: "application/zip"; signal: AbortSignal }) {
    return this.tusUploader(input, this.config);
  }

  async info(path: string) {
    const { data, error } = await this.client.storage.from(this.config.bucket).info(path);
    if (error || !data) {
      const safe = safeExportStorageError(error);
      if (safe.code === "OBJECT_NOT_FOUND") return null;
      throw safe;
    }
    return {
      size: data.size,
      contentType: data.contentType,
      version: data.version,
      etag: data.etag,
    };
  }

  async openRead(path: string, signal: AbortSignal) {
    const { data, error } = await this.client.storage.from(this.config.bucket)
      .download(path, {}, { signal, cache: "no-store" })
      .asStream();
    if (error || !data) throw safeExportStorageError(error, "OBJECT_NOT_FOUND");
    return Readable.fromWeb(data as never);
  }

  async remove(path: string) {
    const { error } = await this.client.storage.from(this.config.bucket).remove([path]);
    if (error) throw safeExportStorageError(error);
  }
}

function assertPath(path: string, ownership: Parameters<typeof assertGrantReportExportStoragePath>[1]) {
  try {
    return assertGrantReportExportStoragePath(path, ownership);
  } catch {
    throw new GrantReportExportStorageError("INVALID_STORAGE_PATH", "The export storage path is invalid.");
  }
}

function linkedDeadlineSignal(source: AbortSignal, milliseconds: number) {
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort(source.reason);
  source.addEventListener("abort", abort, { once: true });
  if (source.aborted) abort();
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort(new Error("deadline"));
  }, milliseconds);
  timer.unref();
  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    release: () => {
      clearTimeout(timer);
      source.removeEventListener("abort", abort);
    },
  };
}

async function spoolToTemporaryFile(stream: Readable, path: string, expectedBytes: number, signal: AbortSignal) {
  let bytes = 0;
  const meter = new Transform({
    transform(chunk: Buffer | string, _encoding, callback) {
      const content = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytes += content.byteLength;
      if (bytes > expectedBytes || bytes > grantReportExportLimits.generatedZipBytes) {
        callback(new GrantReportExportStorageError("INVALID_UPLOAD_INPUT", "The export exceeds its declared size."));
      } else {
        callback(null, content);
      }
    },
  });
  await pipeline(stream, meter, createWriteStream(path, { flags: "wx", mode: 0o600 }), { signal });
  if (bytes !== expectedBytes) {
    throw new GrantReportExportStorageError("INVALID_UPLOAD_INPUT", "The export size does not match its declaration.");
  }
}

async function verifyStoredObject(
  transport: GrantReportExportStorageTransport,
  path: string,
  expectedBytes: number,
  expectedSha256: string,
  signal: AbortSignal,
) {
  const info = await transport.info(path);
  if (!info) throw new GrantReportExportStorageError("OBJECT_NOT_FOUND", "The uploaded export object was not found.");
  if (info.size !== expectedBytes) {
    throw new GrantReportExportStorageError("INTEGRITY_MISMATCH", "The stored export size failed verification.");
  }
  if (info.contentType !== "application/zip") {
    throw new GrantReportExportStorageError("INTEGRITY_MISMATCH", "The stored export type failed verification.");
  }
  const stream = await transport.openRead(path, signal);
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of stream) {
    if (signal.aborted) throw signal.reason;
    const content = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    bytes += content.byteLength;
    if (bytes > grantReportExportLimits.generatedZipBytes || bytes > expectedBytes) {
      stream.destroy();
      throw new GrantReportExportStorageError("INTEGRITY_MISMATCH", "The stored export size failed verification.");
    }
    hash.update(content);
  }
  if (bytes !== expectedBytes || hash.digest("hex") !== expectedSha256) {
    throw new GrantReportExportStorageError("INTEGRITY_MISMATCH", "The stored export failed checksum verification.");
  }
  return info.version ?? info.etag;
}

export class SupabaseGrantReportExportStorage implements GrantReportExportStorage {
  constructor(
    private readonly transport: GrantReportExportStorageTransport,
    private readonly uploadMilliseconds = grantReportExportStorageLimits.uploadMilliseconds,
  ) {}

  async uploadAndVerify(input: Parameters<GrantReportExportStorage["uploadAndVerify"]>[0]) {
    assertPath(input.path, input.ownership);
    if (!input.createOnly || input.contentType !== "application/zip" || input.byteSize <= 0 || input.byteSize > grantReportExportLimits.generatedZipBytes || !/^[a-f0-9]{64}$/.test(input.sha256)) {
      throw new GrantReportExportStorageError("INVALID_UPLOAD_INPUT", "The export upload metadata is invalid.");
    }
    const deadline = linkedDeadlineSignal(input.signal, this.uploadMilliseconds);
    const directory = await mkdtemp(join(tmpdir(), "ecdlink-export-upload-"));
    const filePath = join(directory, "submission-pack.zip");
    try {
      if (await this.transport.exists(input.path)) {
        throw new GrantReportExportStorageError("OBJECT_ALREADY_EXISTS", "The export object already exists.");
      }
      await spoolToTemporaryFile(input.stream, filePath, input.byteSize, deadline.signal);
      const uploaded = await this.transport.uploadFile({
        path: input.path,
        filePath,
        byteSize: input.byteSize,
        contentType: input.contentType,
        signal: deadline.signal,
      });
      const verifiedVersion = await verifyStoredObject(this.transport, input.path, input.byteSize, input.sha256, deadline.signal);
      return {
        path: input.path,
        byteSize: input.byteSize,
        sha256: input.sha256,
        storageObjectVersion: verifiedVersion ?? uploaded.storageObjectVersion ?? null,
      };
    } catch (error) {
      if (deadline.timedOut()) throw new GrantReportExportStorageError("UPLOAD_TIMEOUT", "The export upload timed out.");
      if (input.signal.aborted) throw new GrantReportExportStorageError("UPLOAD_ABORTED", "The export upload was cancelled.");
      throw safeExportStorageError(error, "UPLOAD_FAILED");
    } finally {
      deadline.release();
      input.stream.destroy();
      await rm(directory, { recursive: true, force: true });
    }
  }

  async removeOwnedObject(input: Parameters<GrantReportExportStorage["removeOwnedObject"]>[0]) {
    assertPath(input.path, input.ownership);
    if (!input.ignoreMissing) throw new GrantReportExportStorageError("INVALID_UPLOAD_INPUT", "Export cleanup must be idempotent.");
    try {
      if (!(await this.transport.exists(input.path))) return;
      await this.transport.remove(input.path);
      if (await this.transport.exists(input.path)) {
        throw new GrantReportExportStorageError("PROVIDER_UNAVAILABLE", "The export object could not be removed.");
      }
    } catch (error) {
      const safe = safeExportStorageError(error);
      if (safe.code === "OBJECT_NOT_FOUND") return;
      throw safe;
    }
  }
}

export async function verifyGrantReportExportStorageBucket(
  config: GrantReportExportStorageConfig = getGrantReportExportStorageConfig(),
  client: SupabaseClient = createServerClient(config),
) {
  const { data, error } = await client.storage.getBucket(config.bucket);
  if (error || !data) throw safeExportStorageError(error);
  const allowed = data.allowed_mime_types;
  const sizeLimit = data.file_size_limit;
  if (data.public
    || !allowed
    || allowed.length !== 1
    || allowed[0] !== "application/zip"
    || sizeLimit !== grantReportExportLimits.generatedZipBytes) {
    throw new GrantReportExportStorageError("INVALID_CONFIGURATION", "The private export bucket policy is incompatible.");
  }
  return { private: true as const, maximumBytes: sizeLimit, allowedMimeTypes: allowed };
}

let defaultExportStorage: SupabaseGrantReportExportStorage | undefined;

export function getGrantReportExportStorage() {
  if (!defaultExportStorage) {
    const config = getGrantReportExportStorageConfig();
    defaultExportStorage = new SupabaseGrantReportExportStorage(new SupabaseGrantReportExportTransport(config));
  }
  return defaultExportStorage;
}
